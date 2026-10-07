import { NextRequest, NextResponse } from 'next/server'

// Cache em memória para respostas instantâneas
const dictionaryCache = new Map<string, any>()

// Dicionário pedagógico infantil expandido com termos frequentes em livros infantojuvenis
const CHILD_DICTIONARY: Record<string, {
  meaning: string
  pos: string
  childDefinition: string
  synonyms?: string
  antonyms?: string
  example?: string
  syllables?: string
}> = {
  livro: {
    meaning: "Obra impressa ou digital composta por folhas que contém uma história, ensinamento ou poesia.",
    pos: "Substantivo masculino",
    childDefinition: "Um conjunto de páginas cheias de histórias, aventuras e desenhos divertidos para ler.",
    synonyms: "obra, volume, publicação",
    antonyms: "folha em branco",
    example: "Eu li um livro sobre dragões e castelos mágicos!",
    syllables: "li · vro"
  },
  castelo: {
    meaning: "Construção fortificada e grandiosa onde viviam reis, rainhas e cavaleiros na antiguidade.",
    pos: "Substantivo masculino",
    childDefinition: "Um palácio bem grande de pedra com torres altas onde moravam reis e rainhas.",
    synonyms: "fortaleza, palácio, cidadela",
    example: "O castelo tinha uma ponte levadiça e altas muralhas de proteção.",
    syllables: "cas · te · lo"
  },
  floresta: {
    meaning: "Grande extensão de terra povoada por muitas árvores silvestres, plantas e animais selvagens.",
    pos: "Substantivo feminino",
    childDefinition: "Um lugar com muitas árvores juntas onde moram pássaros, esquilos e bichos da natureza.",
    synonyms: "bosque, mata, selva",
    example: "Eles caminharam por uma trilha mágica no meio da floresta.",
    syllables: "flo · res · ta"
  },
  dragao: {
    meaning: "Animal lendário que solta fogo pela boca, comum em contos de fadas e lendas fantásticas.",
    pos: "Substantivo masculino",
    childDefinition: "Um ser mágico parecido com um lagarto gigante com asas que solta fogo!",
    synonyms: "monstro alado",
    example: "O dragão voou alto por cima das nuvens azuis.",
    syllables: "dra · gão"
  },
  dragão: {
    meaning: "Animal lendário que solta fogo pela boca, comum em contos de fadas e lendas fantásticas.",
    pos: "Substantivo masculino",
    childDefinition: "Um ser mágico parecido com um lagarto gigante com asas que solta fogo!",
    synonyms: "monstro alado",
    example: "O dragão voou alto por cima das nuvens azuis.",
    syllables: "dra · gão"
  },
  valente: {
    meaning: "Que demonstra muita coragem, bravura diante do perigo ou desafio.",
    pos: "Adjetivo",
    childDefinition: "Quem tem muita coragem no coração e não tem medo de ajudar os outros.",
    synonyms: "corajoso, bravo, destemido",
    antonyms: "medroso, covarde",
    example: "O cavaleiro valente protegeu todo o vilarejo com sua espada de madeira.",
    syllables: "va · len · te"
  },
  amigo: {
    meaning: "Pessoa ligada a outra por laços de afeto, lealdade e companheirismo.",
    pos: "Substantivo masculino",
    childDefinition: "Uma pessoa querida com quem gostamos de conversar, brincar e compartilhar brinquedos.",
    synonyms: "colega, companheiro, parceiro",
    antonyms: "rival, inimigo",
    example: "Meu amigo me deu a mão para subirmos a rampa.",
    syllables: "a · mi · go"
  },
  aprender: {
    meaning: "Adquirir o conhecimento de algo por meio de estudo, experiência ou prática.",
    pos: "Verbo",
    childDefinition: "Descobrir como fazer coisas novas e entender como o mundo funciona.",
    synonyms: "compreender, assimilar, memorizar",
    antonyms: "esquecer, desaprender",
    example: "Aprender coisas novas nos livros é muito empolgante!",
    syllables: "a · pren · der"
  },
  escola: {
    meaning: "Instituição destinada ao ensino coletivo e à formação educacional dos estudantes.",
    pos: "Substantivo feminino",
    childDefinition: "O lugar onde a gente vai para encontrar os amigos, brincar no recreio e aprender com os professores.",
    synonyms: "colégio, educandário",
    example: "Na escola nós desenhamos e lemos histórias incríveis.",
    syllables: "es · co · la"
  },
  magia: {
    meaning: "Arte ou efeito imaginário de produzir coisas fantásticas que encantam a imaginação.",
    pos: "Substantivo feminino",
    childDefinition: "O poder misterioso e brilhante dos contos de fadas que faz coisas impossíveis acontecerem!",
    synonyms: "encanto, feitiço, sortilégio",
    example: "A fada usou sua magia para fazer as flores brilharem à noite.",
    syllables: "ma · gi · a"
  }
}

// Separador silábico algorítmico do Português
function separateSyllables(word: string): string[] {
  const cleanWord = word.trim().toLowerCase()
  if (!cleanWord) return []

  const vowels = "aeiouáéíóúâêôãõüàíy"
  const isVowel = (c: string) => vowels.includes(c)
  
  const syllables: string[] = []
  let current = ""
  
  for (let i = 0; i < cleanWord.length; i++) {
    const char = cleanWord[i]
    current += char
    
    if (i < cleanWord.length - 1) {
      const next = cleanWord[i + 1]
      const nextNext = cleanWord[i + 2] || ""
      
      if (isVowel(char) && isVowel(next)) {
        const accentedVowels = "áéíóúâêôíú"
        if (char !== next && (accentedVowels.includes(next) || char === 'a' || char === 'e' || char === 'o')) {
          syllables.push(current)
          current = ""
        }
      } else if (isVowel(char) && !isVowel(next) && isVowel(nextNext)) {
        const isDigraph = ["ch", "lh", "nh", "gu", "qu"].includes(next + nextNext)
        const isConsonantGroup = "bcdfgptv".includes(next) && "rl".includes(nextNext)
        
        if (!isDigraph && !isConsonantGroup) {
          syllables.push(current)
          current = ""
        }
      } else if (!isVowel(char) && !isVowel(next)) {
        const pair = char + next
        if (["rr", "ss", "sc", "sç", "xc"].includes(pair)) {
          syllables.push(current)
          current = ""
        } else {
          const isDigraphNext = ["ch", "lh", "nh", "gu", "qu"].includes(next + nextNext)
          const isConsonantGroupNext = "bcdfgptv".includes(next) && "rl".includes(nextNext)
          const isVowelNextNext = isVowel(nextNext)
          
          if ((isDigraphNext || isConsonantGroupNext) && isVowelNextNext) {
            syllables.push(current)
            current = ""
          }
        }
      }
    }
  }
  if (current) syllables.push(current)
  return syllables
}

// Sílaba Tônica e Classificação
function getStressedSyllable(syllables: string[]): { index: number; type: string; syllable: string } {
  if (syllables.length === 0) return { index: -1, type: "Indefinida", syllable: "" }
  if (syllables.length === 1) return { index: 0, type: "Monossílaba", syllable: syllables[0] }

  const accents = "áéíóúâêôãõ"
  const hasAccent = (s: string) => {
    for (let j = 0; j < s.length; j++) {
      if (accents.includes(s[j])) return true
    }
    return false
  }

  for (let i = 0; i < syllables.length; i++) {
    if (hasAccent(syllables[i])) {
      const posFromEnd = syllables.length - 1 - i
      let type = "Paroxítona"
      if (posFromEnd === 0) type = "Oxítona"
      else if (posFromEnd === 1) type = "Paroxítona"
      else if (posFromEnd >= 2) type = "Proparoxítona"
      return { index: i, type, syllable: syllables[i] }
    }
  }

  const lastSyllable = syllables[syllables.length - 1]
  const lastChar = lastSyllable[lastSyllable.length - 1]
  const lastTwo = lastSyllable.slice(-2)

  const isParoxitonaEnding = 
    "aeo".includes(lastChar) || 
    ["as", "es", "os", "am", "em"].includes(lastTwo) ||
    lastSyllable.endsWith("ens")

  if (isParoxitonaEnding) {
    const idx = Math.max(0, syllables.length - 2)
    return { index: idx, type: "Paroxítona", syllable: syllables[idx] }
  } else {
    const idx = syllables.length - 1
    return { index: idx, type: "Oxítona", syllable: syllables[idx] }
  }
}

// Parser do extrato de texto do Wiktionary em Português
function parseWiktionaryExtract(text: string) {
  if (!text) return null
  const ptStart = text.indexOf('= Português =')
  const section = ptStart !== -1 ? text.substring(ptStart) : text
  const nextLangMatch = section.slice(15).match(/\n= [^=]+ =/)
  const ptText = nextLangMatch && typeof nextLangMatch.index === 'number' ? section.substring(0, 15 + nextLangMatch.index) : section

  const lines = ptText.split('\n').map(l => l.trim()).filter(Boolean)
  let pos = ''
  let syllables = ''
  let gender = ''
  const definitions: string[] = []
  const examples: string[] = []
  const synonyms: string[] = []
  let inSection = ''

  for (const line of lines) {
    if (line.startsWith('== ') && line.endsWith(' ==')) {
      inSection = line.replace(/==/g, '').trim()
      if (!pos && ['Substantivo', 'Adjetivo', 'Verbo', 'Advérbio', 'Forma verbal', 'Interjeição', 'Pronome', 'Numeral'].some(p => inSection.includes(p))) {
        pos = inSection
      }
      continue
    }
    if (line.startsWith('=== ') && line.endsWith(' ===')) {
      inSection = line.replace(/===/g, '').trim()
      continue
    }

    if (inSection === 'Sinônimos' || inSection === 'Sinónimos') {
      if (!line.startsWith('=') && !line.startsWith('Vide')) {
        synonyms.push(line.replace(/^\*\s*/, '').replace(/[.,]$/, ''))
      }
      continue
    }

    if (pos && ['Substantivo', 'Adjetivo', 'Verbo', 'Advérbio', 'Forma verbal'].some(p => inSection.includes(p))) {
      // Linha com divisão silábica ou gênero (ex: "flo.res.ta, feminino")
      if (!syllables && line.includes('.')) {
        const parts = line.split(',')
        if (parts[0].includes('.') && parts[0].length < 30) {
          syllables = parts[0].trim().replace(/\./g, ' · ')
          if (parts[1]) gender = parts.slice(1).join(',').trim()
          continue
        }
      }
      // Linhas de definição e exemplo
      if (line.startsWith('(') || /^[a-zà-ú]/i.test(line)) {
        if (definitions.length > 0 && /^[A-ZÁÉÍÓÚÂÊÔÃÕ]/.test(line) && line.endsWith('.')) {
          examples.push(line)
        } else if (definitions.length < 3) {
          // Limpa marcadores como [1] ou notas de estilo
          const cleanDef = line.replace(/^\[\d+\]\s*/, '').trim()
          if (cleanDef.length > 3) {
            definitions.push(cleanDef)
          }
        }
      }
    }
  }

  return {
    pos: pos || 'Palavra',
    gender,
    syllables,
    definitions,
    examples,
    synonyms
  }
}

// Consulta no Wiktionary
async function fetchWiktionary(word: string) {
  try {
    const url = `https://pt.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext&titles=${encodeURIComponent(word)}&format=json`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BibliotecaApp/1.0' },
      next: { revalidate: 86400 } // Cache de 24 horas
    })
    if (!res.ok) return null
    const data = await res.json()
    const page = Object.values(data.query?.pages || {})[0] as any
    if (page && page.extract) {
      return parseWiktionaryExtract(page.extract)
    }
  } catch (err) {
    console.warn(`[Wiktionary Error for ${word}]:`, err)
  }
  return null
}

// Consulta no Dicionário Aberto (fallback clássico)
async function fetchDicionarioAberto(word: string) {
  try {
    const res = await fetch(`https://api.dicionario-aberto.net/word/${encodeURIComponent(word)}`, {
      next: { revalidate: 86400 }
    })
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0 && data[0].xml) {
      const xml = data[0].xml
      const text = xml.replace(/<[^>]*>/g, ' ').replace(/_/g, '').replace(/\s+/g, ' ').trim()
      if (text) {
        return {
          pos: 'Substantivo / Vocábulo',
          meaning: text.slice(0, 300)
        }
      }
    }
  } catch (err) {
    console.warn(`[Dicionario Aberto Error for ${word}]:`, err)
  }
  return null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawWord = searchParams.get('word')

  if (!rawWord) {
    return NextResponse.json({ error: 'Palavra não informada' }, { status: 400 })
  }

  // Normalização limpa: remove pontuação, aspas, espaços extras
  const cleanWord = rawWord
    .trim()
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\"\'«»”]/g, '')

  if (!cleanWord || cleanWord.length < 2) {
    return NextResponse.json({ error: 'Palavra muito curta' }, { status: 400 })
  }

  // 1. Checar cache em memória
  if (dictionaryCache.has(cleanWord)) {
    return NextResponse.json(dictionaryCache.get(cleanWord))
  }

  // 2. Separar sílabas e identificar sílaba tônica
  const sylList = separateSyllables(cleanWord)
  const tonicInfo = getStressedSyllable(sylList)
  const syllablesFormatted = sylList.join(' · ')
  const pronunciation = '/' + sylList.map((s, idx) => idx === tonicInfo.index ? s.toUpperCase() : s).join('-') + '/'

  // 3. Checar banco local infantil primeiro (qualidade educacional prioritária)
  const childEntry = CHILD_DICTIONARY[cleanWord]
  if (childEntry) {
    const responseData = {
      word: rawWord.trim(),
      cleanWord,
      pos: childEntry.pos,
      meaning: childEntry.meaning,
      childDefinition: childEntry.childDefinition,
      syllables: childEntry.syllables || syllablesFormatted,
      stressedSyllable: `${tonicInfo.syllable} (${tonicInfo.type})`,
      pronunciation,
      synonyms: childEntry.synonyms || '',
      antonyms: childEntry.antonyms || '',
      example: childEntry.example || `Lemos a palavra "${cleanWord}" na história.`,
      source: 'local'
    }
    dictionaryCache.set(cleanWord, responseData)
    return NextResponse.json(responseData)
  }

  // 4. Buscar no Wiktionary
  let wikiData = await fetchWiktionary(cleanWord)
  let resolvedWord = cleanWord

  // Se for plural terminado em 's', tentar forma no singular
  if ((!wikiData || wikiData.definitions.length === 0) && cleanWord.endsWith('s') && cleanWord.length > 3) {
    const singular = cleanWord.endsWith('es') ? cleanWord.slice(0, -2) : cleanWord.slice(0, -1)
    const singularWiki = await fetchWiktionary(singular)
    if (singularWiki && singularWiki.definitions.length > 0) {
      wikiData = singularWiki
      resolvedWord = singular
    }
  }

  if (wikiData && wikiData.definitions.length > 0) {
    const primaryMeaning = wikiData.definitions[0]
    const secondaryMeaning = wikiData.definitions[1] || ''
    
    // Se for forma verbal ("terceira pessoa do ... do verbo correr")
    const isVerbalForm = wikiData.pos.toLowerCase().includes('verbal') || primaryMeaning.includes('do verbo ')
    let childExplanation = primaryMeaning

    if (isVerbalForm) {
      childExplanation = `Forma da ação (verbo): ${primaryMeaning}.`
    }

    const responseData = {
      word: rawWord.trim(),
      cleanWord,
      pos: wikiData.gender ? `${wikiData.pos} (${wikiData.gender})` : wikiData.pos,
      meaning: primaryMeaning + (secondaryMeaning ? ` | ${secondaryMeaning}` : ''),
      childDefinition: childExplanation,
      syllables: wikiData.syllables || syllablesFormatted,
      stressedSyllable: `${tonicInfo.syllable} (${tonicInfo.type})`,
      pronunciation,
      synonyms: wikiData.synonyms.slice(0, 3).join(', '),
      antonyms: '',
      example: wikiData.examples[0] || `A palavra "${cleanWord}" apareceu na leitura do livro.`,
      source: 'wiktionary'
    }

    dictionaryCache.set(cleanWord, responseData)
    return NextResponse.json(responseData)
  }

  // 5. Fallback para Dicionário Aberto
  const daData = await fetchDicionarioAberto(cleanWord)
  if (daData && daData.meaning) {
    const responseData = {
      word: rawWord.trim(),
      cleanWord,
      pos: daData.pos,
      meaning: daData.meaning,
      childDefinition: daData.meaning.split('.')[0] + '.',
      syllables: syllablesFormatted,
      stressedSyllable: `${tonicInfo.syllable} (${tonicInfo.type})`,
      pronunciation,
      synonyms: '',
      antonyms: '',
      example: `Lemos "${cleanWord}" na página do livro.`,
      source: 'dicionario-aberto'
    }
    dictionaryCache.set(cleanWord, responseData)
    return NextResponse.json(responseData)
  }

  // 6. Fallback final estruturado
  const responseData = {
    word: rawWord.trim(),
    cleanWord,
    pos: 'Vocábulo da Língua Portuguesa',
    meaning: `Palavra do vocabulário da língua portuguesa utilizada na história do livro.`,
    childDefinition: `Palavra com ${sylList.length} sílaba(s) encontrada no texto do livro.`,
    syllables: syllablesFormatted,
    stressedSyllable: `${tonicInfo.syllable} (${tonicInfo.type})`,
    pronunciation,
    synonyms: '',
    antonyms: '',
    example: `Você pode ouvir a pronúncia e praticar a leitura de "${cleanWord}".`,
    source: 'fallback'
  }

  dictionaryCache.set(cleanWord, responseData)
  return NextResponse.json(responseData)
}
