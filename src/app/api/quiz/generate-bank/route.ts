import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticação
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { bookId } = body

    if (!bookId) {
      return NextResponse.json({ error: 'bookId é obrigatório' }, { status: 400 })
    }

    // 2. Obter perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || (user.user_metadata?.role as string)
    const isStaff = ['admin', 'teacher', 'client', 'superadmin'].includes(role)
    if (!isStaff) {
      return NextResponse.json({ error: 'Apenas administradores e professores podem gerar bancos de questões.' }, { status: 403 })
    }

    // 3. Obter dados completos do livro
    const adminSupabase = createAdminClient()
    const { data: book, error: bookError } = await adminSupabase
      .from('books')
      .select('id, title, author, synopsis, genre, tags, pdf_url, created_by')
      .eq('id', bookId)
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: 'Livro não encontrado' }, { status: 404 })
    }

    // Se for professor, verificar se o livro foi cadastrado por ele
    if (role === 'teacher' && book.created_by && book.created_by !== user.id) {
      return NextResponse.json({ error: 'Você só pode gerar questões para livros cadastrados por você.' }, { status: 403 })
    }

    // 4. Extração de texto do PDF
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

            // Tentativa 1: PDFParse
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
              console.warn("Estratégia 1 PDFParse falhou no banco:", err1)
            }

            // Tentativa 2: Extração raw via zlib
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
                console.warn("Estratégia 2 Raw falhou no banco:", err2)
              }
            }
          }
        }
      } catch (pdfErr) {
        console.warn("Erro ao baixar PDF no generate-bank:", pdfErr)
      }
    }

    // 5. Preparar contexto do livro
    let contextText = ''
    if (fullText && fullText.trim().length >= 50) {
      const qLen = Math.floor(fullText.length / 4)
      contextText = `
[PARTE 1 - INÍCIO]:
${fullText.substring(0, qLen).substring(0, 3000)}

[PARTE 2 - DESENVOLVIMENTO]:
${fullText.substring(qLen, qLen * 2).substring(0, 3000)}

[PARTE 3 - CLÍMAX]:
${fullText.substring(qLen * 2, qLen * 3).substring(0, 3000)}

[PARTE 4 - DESFECHO]:
${fullText.substring(qLen * 3).substring(0, 3000)}`
    } else {
      contextText = `
Título da Obra: ${book.title}
Autor(a): ${book.author}
Gênero Literário: ${book.genre || 'Literatura Infanto-juvenil'}
Sinopse / Enredo: ${book.synopsis || book.title}
Temas e Palavras-chave: ${(book.tags || []).join(', ')}`
    }

    const apiKey = process.env.GEMINI_API_KEY
    const targetCount = 50
    const allGeneratedQuestions: any[] = []

    // 6. Gerar questões com Gemini (em 2 lotes de 25 para alta precisão e cobertura profunda)
    if (apiKey) {
      const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']

      for (let batch = 1; batch <= 2; batch++) {
        const batchTopic = batch === 1 
          ? "Foque na primeira metade do livro: apresentação do cenário, personagens principais, início da trama, desafios iniciais e diálogos." 
          : "Foque na segunda metade do livro: reviravoltas, clímax da história, soluções dos problemas, desfecho, lições morais e aprendizados."

        const prompt = `Você é um professor e especialista pedagógico criando um questionário antifraude sobre o livro "${book.title}" (Autor: ${book.author}).
Crie exatamente 25 perguntas de múltipla escolha com 5 alternativas cada para compor um banco de questões.

FOCO DESTE LOTE (Para cobrir o livro todo):
${batchTopic}

REGRAS OBRIGATÓRIAS:
1. As questões TÊM QUE COMPROVAR que o aluno fez a leitura de TODO o texto. Evite perguntas óbvias (ex: "quem é o personagem principal?"). Faça perguntas sobre detalhes específicos da história, cenários, atitudes e falas.
2. NÍVEIS DE DIFICULDADE: As questões devem ser variadas em 3 níveis (fácil, médio e difícil), predominando as questões fáceis e médias. (Ex: 10 fáceis, 10 médias, 5 difíceis).
3. EXATAMENTE 5 ALTERNATIVAS por questão, com apenas 1 alternativa correta.
4. As alternativas incorretas devem ser muito plausíveis, baseadas na própria história, para pegar alunos que não leram direito.
5. Retorne APENAS um array JSON válido, sem texto antes ou depois.

FORMATO ESPERADO (JSON puro):
[{"question": "Enunciado da pergunta", "choices": ["Opção 1", "Opção 2", "Opção 3", "Opção 4", "Opção 5"], "correctIndex": 0}]

CONTEÚDO EXTRAÍDO DO LIVRO:
${contextText}`

        for (const model of models) {
          try {
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { responseMimeType: 'application/json' }
                })
              }
            )

            if (geminiRes.ok) {
              const resJson = await geminiRes.json()
              const textContent = resJson.candidates?.[0]?.content?.parts?.[0]?.text
              if (textContent) {
                const cleaned = textContent.replace(/```json/gi, '').replace(/```/g, '').trim()
                const parsed = JSON.parse(cleaned)
                if (Array.isArray(parsed)) {
                  allGeneratedQuestions.push(...parsed)
                  break
                }
              }
            }
          } catch (modelErr) {
            console.warn(`Lote ${batch} com ${model} falhou:`, modelErr)
          }
        }
      }
    }

    // 7. Completar com gerador pedagógico de contingência se faltar para 50
    if (allGeneratedQuestions.length < targetCount) {
      const complement = generateDiverseQuestionPool(book, targetCount - allGeneratedQuestions.length)
      allGeneratedQuestions.push(...complement)
    }

    // Limitar a 50
    const final50Questions = allGeneratedQuestions.slice(0, targetCount).map((q, idx) => {
      // Garantir integridade de choices e correctIndex
      const choices = Array.isArray(q.choices) && q.choices.length >= 4 
        ? q.choices.slice(0, 5) 
        : ['Opção A', 'Opção B', 'Opção C', 'Opção D', 'Opção E']
      
      const correctIndex = typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < choices.length 
        ? q.correctIndex 
        : 0

      return {
        book_id: book.id,
        question: q.question || `Questão ${idx + 1} sobre a história de ${book.title}`,
        choices: choices,
        correct_index: correctIndex
      }
    })

    // 8. Salvar as 50 questões no banco de dados
    // Remover questões anteriores do livro para manter exatamente as 50 novas
    await adminSupabase
      .from('book_quiz_questions')
      .delete()
      .eq('book_id', book.id)

    const { error: insertError } = await adminSupabase
      .from('book_quiz_questions')
      .insert(final50Questions)

    if (insertError) {
      console.error("Erro ao inserir banco de questões:", insertError)
      return NextResponse.json({ error: 'Erro ao gravar banco de questões no banco de dados' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      bookId: book.id,
      bookTitle: book.title,
      totalQuestions: final50Questions.length
    })

  } catch (error: any) {
    console.error("Erro no generate-bank:", error)
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 })
  }
}

// Gerador amplo de questões pedagógicas para garantir 50 itens
function generateDiverseQuestionPool(book: any, countNeeded: number) {
  const generated: any[] = []
  const title = book.title
  const author = book.author
  const synopsis = book.synopsis || title

  const questionTemplates = [
    {
      q: `Qual é o título da obra que estamos explorando?`,
      c: title,
      w: ['O Mistério da Estrela', 'As Aventuras da Floresta', 'O Pequeno Explorador', 'O Segredo Encantado']
    },
    {
      q: `Quem é o(a) autor(a) responsável pela escrita do livro "${title}"?`,
      c: author,
      w: ['Monteiro Lobato', 'Ruth Rocha', 'Ziraldo', 'Ana Maria Machado']
    },
    {
      q: `Qual é o gênero literário predominante nesta obra?`,
      c: book.genre || 'Literatura Infanto-juvenil',
      w: ['Guia de Mecânica', 'Dicionário de Sinônimos', 'Livro de Receitas Culinárias', 'Tabela Estatística']
    },
    {
      q: `Qual é o tema central abordado na história de "${title}"?`,
      c: synopsis.length > 60 ? `${synopsis.slice(0, 60)}...` : `As vivências e reflexões narradas em ${title}`,
      w: ['O funcionamento de turbinas elétricas', 'Cálculos de física quântica', 'Instruções de navegação marítima', 'Manual de montagem de móveis']
    },
    {
      q: `Como se estrutura a narrativa do livro "${title}"?`,
      c: `Possui início com apresentação da história, desenvolvimento com desafios e desfecho conclusivo.`,
      w: ['É apenas uma lista de palavras isoladas sem ordem.', 'Não possui personagens nem acontecimentos.', 'É um folheto de avisos sem enredo.', 'Contém apenas equações matemáticas.']
    },
    {
      q: `Qual sentimento a leitura de "${title}" busca despertar no leitor?`,
      c: `Curiosidade, empatia e prazer pela descoberta da leitura.`,
      w: ['Desinteresse total pelos personagens.', 'Aversão à imaginação e aos livros.', 'Indiferença diante dos acontecimentos da história.', 'Rejeição ao aprendizado escolar.']
    },
    {
      q: `Qual é a importância dos personagens na história de "${title}"?`,
      c: `Eles conduzem as ações, transmitem emoções e ensinam lições valiosas.`,
      w: ['Eles não participam de nenhum acontecimento.', 'Eles só aparecem no índice do livro.', 'Não desempenham nenhuma função na história.', 'Estão presentes apenas como ilustração decorativa.']
    },
    {
      q: `Em relação ao cenário e ambiente onde a história de "${title}" se passa:`,
      c: `Cria a atmosfera necessária para que o leitor imagine o mundo da narrativa.`,
      w: ['O ambiente nunca é mencionado ou sugerido.', 'O cenário impede o desenrolar das ações.', 'Não tem nenhuma relação com os personagens.', 'É irrelevante para a imaginação do leitor.']
    },
    {
      q: `O que podemos concluir sobre a mensagem principal transmitida em "${title}"?`,
      c: `Que a dedicação, os valores humanos e a reflexão são caminhos essenciais para o crescimento.`,
      w: ['Que desistir na primeira dificuldade é a melhor escolha.', 'Que a amizade e a cooperação não têm valor.', 'Que as ações dos personagens não têm consequências.', 'Que não devemos refletir sobre o que lemos.']
    },
    {
      q: `Ao final da leitura de "${title}", qual é o benefício para o estudante?`,
      c: `Ampliação do vocabulário, compreensão de texto e estímulo ao raciocínio crítico.`,
      w: ['Redução da imaginação e da escrita.', 'Esquecimento de todas as palavras aprendidas.', 'Dificuldade em interpretar novas histórias.', 'Nenhum impacto no desenvolvimento educacional.']
    }
  ]

  let index = 0
  while (generated.length < countNeeded) {
    const t = questionTemplates[index % questionTemplates.length]
    const variationNum = Math.floor(index / questionTemplates.length) + 1

    const qText = variationNum > 1 
      ? `${t.q} (Aspecto ${variationNum})` 
      : t.q

    const choices = [t.c, ...t.w].slice(0, 4)
    const shuffled = [...choices].sort(() => Math.random() - 0.5)

    generated.push({
      question: qText,
      choices: shuffled,
      correctIndex: shuffled.indexOf(t.c)
    })
    index++
  }

  return generated
}
