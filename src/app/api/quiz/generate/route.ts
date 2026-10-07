import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // 1. Validar autenticação
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 2. Obter bookId da URL
    const { searchParams } = new URL(req.url)
    const bookId = searchParams.get('bookId')

    if (!bookId) {
      return NextResponse.json({ error: 'bookId é obrigatório' }, { status: 400 })
    }

    // 3. Obter perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || (user.user_metadata?.role as string)
    const isStaff = ['admin', 'teacher', 'client', 'superadmin'].includes(role)

    // Se for aluno, verificar se leu as páginas do livro
    if (!isStaff) {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      const studentId = student?.id || user.id

      const { data: readingProgress } = await supabase
        .from('reading_progress')
        .select('current_page, total_pages, completed')
        .eq('student_id', studentId)
        .eq('book_id', bookId)
        .maybeSingle()

      const hasReadPages = readingProgress && (
        readingProgress.completed || 
        readingProgress.current_page >= readingProgress.total_pages ||
        (readingProgress.total_pages > 1 && readingProgress.current_page >= readingProgress.total_pages - 1)
      )

      if (!hasReadPages) {
        return NextResponse.json({ 
          error: 'Você precisa ler até a última página deste livro para liberar o questionário de validação.' 
        }, { status: 400 })
      }
    }

    // 4. Carregar configuração do quiz
    const { data: quizConfig } = await supabase
      .from('quiz_config')
      .select('num_questions, num_choices')
      .limit(1)
      .maybeSingle()

    const numQuestions = quizConfig?.num_questions || 5
    const numChoices = quizConfig?.num_choices || 4

    // 5. Verificar se já existem questões no banco de 50 questões do livro
    const adminSupabase = createAdminClient()
    const { data: bankQuestions } = await adminSupabase
      .from('book_quiz_questions')
      .select('id, question, choices, correct_index')
      .eq('book_id', bookId)

    let questionPool: any[] = []

    if (bankQuestions && bankQuestions.length > 0) {
      questionPool = bankQuestions
    } else {
      // Se ainda não tiver banco de questões gerado para este livro, gerar agora
      const { data: book } = await adminSupabase
        .from('books')
        .select('id, title, author, synopsis, genre, tags, pdf_url')
        .eq('id', bookId)
        .single()

      if (!book) {
        return NextResponse.json({ error: 'Livro não encontrado' }, { status: 404 })
      }

      // Gerar o banco de 50 questões
      questionPool = await generateAndSave50QuestionBank(book, adminSupabase)
    }

    // 6. Sorteio randômico de `numQuestions` a partir do banco de questões
    const shuffledBank = [...questionPool].sort(() => Math.random() - 0.5)
    const selectedQuestions = shuffledBank.slice(0, Math.min(numQuestions, shuffledBank.length))

    // 7. Embaralhar as alternativas de cada questão sorteada
    const formattedQuestions = selectedQuestions.map((q) => {
      const rawChoices: string[] = Array.isArray(q.choices) ? q.choices : []
      const originalCorrectIndex: number = typeof q.correct_index === 'number' ? q.correct_index : (q.correctIndex || 0)
      const correctAnswerText = rawChoices[originalCorrectIndex] || rawChoices[0] || 'Opção Correta'

      // Ajustar quantidade de alternativas para numChoices
      let choicesSubset = [...rawChoices]
      if (choicesSubset.length > numChoices) {
        // Manter a correta e selecionar aleatoriamente as outras
        const wrongChoices = choicesSubset.filter((_, idx) => idx !== originalCorrectIndex)
        const shuffledWrongs = wrongChoices.sort(() => Math.random() - 0.5).slice(0, numChoices - 1)
        choicesSubset = [correctAnswerText, ...shuffledWrongs]
      }

      // Embaralhar alternativas
      const finalShuffledChoices = [...choicesSubset].sort(() => Math.random() - 0.5)
      const newCorrectIndex = finalShuffledChoices.indexOf(correctAnswerText)

      return {
        question: q.question,
        choices: finalShuffledChoices,
        correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0
      }
    })

    return NextResponse.json(formattedQuestions)

  } catch (error: any) {
    console.error("Quiz generate error:", error)
    return NextResponse.json({ error: error.message || 'Erro interno ao processar questionário' }, { status: 500 })
  }
}

// Função auxiliar para gerar e persistir 50 questões do livro
async function generateAndSave50QuestionBank(book: any, adminSupabase: any) {
  let fullText = ''

  if (book.pdf_url) {
    try {
      const pdfPath = book.pdf_url.startsWith('book-pdfs/') 
        ? book.pdf_url.replace('book-pdfs/', '') 
        : book.pdf_url

      const { data: signedUrlData } = await adminSupabase.storage
        .from('book-pdfs')
        .createSignedUrl(pdfPath, 300)

      if (signedUrlData?.signedUrl) {
        const pdfResponse = await fetch(signedUrlData.signedUrl)
        if (pdfResponse.ok) {
          const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())

          try {
            const pdfParseModule = await import('pdf-parse')
            if (pdfParseModule.PDFParse) {
              const parser = new pdfParseModule.PDFParse({ 
                data: new Uint8Array(pdfBuffer),
                disableFontFace: true,
                useSystemFonts: false,
                verbosity: 0
              })
              const textResult = await parser.getText()
              if (textResult?.text && textResult.text.trim().length > 30) {
                fullText = textResult.text
              }
              await parser.destroy().catch(() => {})
            }
          } catch (err1) {
            console.warn("PDFParse falhou:", err1)
          }

          if (!fullText || fullText.trim().length < 30) {
            try {
              const zlib = await import('zlib')
              const bufferString = pdfBuffer.toString('binary')
              const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
              let match
              let rawExtracted = ''

              while ((match = streamRegex.exec(bufferString)) !== null) {
                const rawStream = Buffer.from(match[1], 'binary')
                let decompressed = null
                try {
                  decompressed = zlib.inflateSync(rawStream).toString('utf-8')
                } catch {
                  try {
                    decompressed = zlib.inflateRawSync(rawStream).toString('utf-8')
                  } catch {
                    decompressed = rawStream.toString('utf-8')
                  }
                }

                if (decompressed) {
                  const tjRegex = /\((.*?)\)\s*Tj/g
                  let tjMatch
                  while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
                    rawExtracted += tjMatch[1] + ' '
                  }
                  const arrayTjRegex = /\[(.*?)\]\s*TJ/g
                  let arrayMatch
                  while ((arrayMatch = arrayTjRegex.exec(decompressed)) !== null) {
                    const innerStrings = arrayMatch[1].match(/\((.*?)\)/g)
                    if (innerStrings) {
                      rawExtracted += innerStrings.map(s => s.slice(1, -1)).join('') + ' '
                    }
                  }
                }
              }

              if (rawExtracted.trim().length > 30) {
                fullText = rawExtracted.trim()
              }
            } catch (err2) {
              console.warn("Raw streams falhou:", err2)
            }
          }
        }
      }
    } catch (pdfErr) {
      console.warn("Erro ao ler PDF:", pdfErr)
    }
  }

  let contextText = ''
  if (fullText && fullText.trim().length >= 50) {
    const qLen = Math.floor(fullText.length / 4)
    contextText = `
[INÍCIO]: ${fullText.substring(0, qLen).substring(0, 3000)}
[DESENVOLVIMENTO]: ${fullText.substring(qLen, qLen * 2).substring(0, 3000)}
[CLÍMAX E FINAL]: ${fullText.substring(qLen * 2).substring(0, 3000)}`
  } else {
    contextText = `
Título: ${book.title}
Autor: ${book.author}
Gênero: ${book.genre || 'Literatura'}
Sinopse: ${book.synopsis || book.title}
Tags: ${(book.tags || []).join(', ')}`
  }

  const apiKey = process.env.GEMINI_API_KEY
  let generatedQuestions: any[] = []

  if (apiKey) {
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']
    const prompt = `Você é um professor e especialista pedagógico criando um questionário antifraude sobre o livro "${book.title}" (Autor: ${book.author}). 
Crie exatamente 25 perguntas de múltipla escolha com 5 alternativas cada. 
REGRAS OBRIGATÓRIAS:
1. As perguntas DEVEM comprovar que o aluno realmente leu o livro inteiro.
2. Evite perguntas genéricas (como "quem é o personagem principal?" ou sobre a sinopse).
3. Faça perguntas sobre detalhes específicos da história, atitudes dos personagens no meio e final do livro, e reviravoltas do enredo.
4. NÍVEIS DE DIFICULDADE: As questões devem ser variadas em 3 níveis (fácil, médio e difícil), predominando as questões fáceis e médias.
5. EXATAMENTE 5 ALTERNATIVAS por questão.

Retorne APENAS um array JSON:
[{"question": "enunciado", "choices": ["opção 1", "opção 2", "opção 3", "opção 4", "opção 5"], "correctIndex": 0}]

CONTEÚDO DA HISTÓRIA EXTRAÍDO DO PDF:
${contextText}`

    for (const model of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        })

        if (res.ok) {
          const data = await res.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
            const parsed = JSON.parse(cleaned)
            if (Array.isArray(parsed)) {
              generatedQuestions = parsed
              break
            }
          }
        }
      } catch (err) {
        console.warn(`Erro ao gerar com ${model}:`, err)
      }
    }
  }

  // Complementar até 50 questões
  const needed = 50 - generatedQuestions.length
  if (needed > 0) {
    const complement = generateFallbackPool(book, needed)
    generatedQuestions.push(...complement)
  }

  const final50 = generatedQuestions.slice(0, 50).map((q, idx) => ({
    book_id: book.id,
    question: q.question || `Questão ${idx + 1} sobre ${book.title}`,
    choices: Array.isArray(q.choices) && q.choices.length >= 4 ? q.choices.slice(0, 5) : ['Opção A', 'Opção B', 'Opção C', 'Opção D', 'Opção E'],
    correct_index: typeof q.correctIndex === 'number' ? q.correctIndex : (q.correct_index || 0)
  }))

  // Gravar no banco de dados
  try {
    await adminSupabase
      .from('book_quiz_questions')
      .delete()
      .eq('book_id', book.id)

    await adminSupabase
      .from('book_quiz_questions')
      .insert(final50)
  } catch (dbErr) {
    console.error("Erro ao salvar 50 questões no banco:", dbErr)
  }

  return final50
}

function generateFallbackPool(book: any, countNeeded: number) {
  const templates = [
    {
      q: `Qual é o título da obra que acabamos de ler?`,
      c: book.title,
      w: ['O Grande Mistério', 'Aventuras na Selva', 'O Pequeno Explorador', 'O Segredo da Floresta']
    },
    {
      q: `Quem é o(a) autor(a) responsável pelo livro "${book.title}"?`,
      c: book.author,
      w: ['Monteiro Lobato', 'Ruth Rocha', 'Ziraldo', 'Ana Maria Machado']
    },
    {
      q: `Qual é a categoria / gênero literário deste livro?`,
      c: book.genre || 'Literatura Infantil',
      w: ['Manual de Robótica', 'Dicionário de Sinônimos', 'Guia de Culinária', 'Tabela de Logaritmos']
    },
    {
      q: `Qual é o tema principal da narrativa de "${book.title}"?`,
      c: book.synopsis ? `${book.synopsis.slice(0, 60)}...` : `As vivências e reflexões narradas na história`,
      w: ['O conserto de motores industriais', 'Cálculos matemáticos sem história', 'Instruções de navegação espacial', 'Regras bancárias']
    },
    {
      q: `Como se desenvolvem os acontecimentos na narrativa de "${book.title}"?`,
      c: `Apresenta personagens, desafios e um desfecho que traz aprendizados.`,
      w: ['Não há história nem personagens.', 'São apenas frases soltas sem significado.', 'É um folheto sem enredo.', 'Contém apenas números.']
    },
    {
      q: `Qual é a mensagem positiva que a história de "${book.title}" transmite?`,
      c: `A importância da leitura, da imaginação e da empatia.`,
      w: ['Que não devemos dar valor aos livros.', 'Que a cooperação não é importante.', 'Que não devemos refletir sobre nada.', 'Que ler é desnecessário.']
    }
  ]

  const pool: any[] = []
  let i = 0
  while (pool.length < countNeeded) {
    const t = templates[i % templates.length]
    const varNum = Math.floor(i / templates.length) + 1
    const qText = varNum > 1 ? `${t.q} (Item ${varNum})` : t.q
    const choices = [t.c, ...t.w].slice(0, 4)
    const shuffled = [...choices].sort(() => Math.random() - 0.5)

    pool.push({
      question: qText,
      choices: shuffled,
      correctIndex: shuffled.indexOf(t.c)
    })
    i++
  }
  return pool
}
