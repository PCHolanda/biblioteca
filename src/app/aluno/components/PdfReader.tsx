'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Document, Page, pdfjs } from 'react-pdf'
import { 
  ArrowLeft, ZoomIn, ZoomOut, Sun, Heart, 
  ChevronLeft, ChevronRight, Loader2, RefreshCw,
  Maximize, Minimize, Volume2, X, FileQuestion, CheckCircle, XCircle
} from 'lucide-react'
import QuizModal from './QuizModal'

// Importar estilos padrões de react-pdf para renderizar páginas corretamente
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

// Configurar o Worker do PDF.js a partir do caminho local na pasta public
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PdfReaderProps {
  book: any
  pdfUrl: string
  startPage: number
  isFavorite: boolean
  studentId: string
}

export default function PdfReader({ book, pdfUrl, startPage, isFavorite, studentId }: PdfReaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const readerContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Estados do PDF
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(startPage)
  const [pdfLoading, setPdfLoading] = useState(true)

  // Estados de customização do leitor
  const [zoom, setZoom] = useState<number>(1.0)
  const [brightness, setBrightness] = useState<number>(100) // 30% a 100%
  const [fav, setFav] = useState<boolean>(isFavorite)
  const [favLoading, setFavLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showQuizPrompt, setShowQuizPrompt] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showEarlyQuizPrompt, setShowEarlyQuizPrompt] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Estados do dicionário e seleção de texto
  const [selectedWord, setSelectedWord] = useState<string>('')
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number; isBelow?: boolean } | null>(null)
  const [dictInfo, setDictInfo] = useState<{
    word: string
    pos?: string
    meaning: string
    childDefinition?: string
    pronunciation?: string
    syllables?: string
    stressedSyllable?: string
    synonyms?: string
    antonyms?: string
    example?: string
    difficulty?: string
  } | null>(null)
  const [dictLoading, setDictLoading] = useState(false)
  const dictPopoverRef = useRef<HTMLDivElement>(null)


  // Estados de Responsividade
  const [isMobile, setIsMobile] = useState(false)
  const [windowWidth, setWindowWidth] = useState(800)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      setWindowWidth(window.innerWidth)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Largura calculada da página: comporta 100% da largura da tela
  const basePageWidth = windowWidth
  const pageWidth = Math.round(basePageWidth * zoom)

  // Tratamento da carga do PDF
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPdfLoading(false)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('Erro ao ler PDF:', error)
    alert('Erro ao carregar o arquivo PDF do livro.')
    setPdfLoading(false)
  }

  // Navegar páginas por número e salvar progresso
  const goToPage = (pageNumber: number) => {
    const target = Math.max(1, Math.min(numPages || 1, pageNumber))
    setCurrentPage(target)
    saveProgressDebounced(target)
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const nextPage = () => {
    if (numPages > 0 && currentPage < numPages) {
      goToPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1)
    }
  }

  // Atalhos de teclado (Setas Esquerda/Direita e P para Modo Apresentação)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showQuizPrompt || showQuiz) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        nextPage()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        prevPage()
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'f' || e.key === 'F') {
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, numPages, showQuizPrompt, showQuiz, isFullscreen])

  // Salvamento do progresso com debounce de 1.5s
  const saveProgressDebounced = (page: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      const reachedLastPage = numPages > 0 && page >= numPages

      // Verificar se o aluno já passou no quiz para este livro
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('passed')
        .eq('student_id', studentId)
        .eq('book_id', book.id)
        .eq('passed', true)
        .limit(1)

      const isQuizPassed = !!(attempts && attempts.length > 0)
      // O livro SÓ é 100% concluído quando o aluno for APROVADO no quiz!
      const isCompleted = reachedLastPage && isQuizPassed

      const payload = {
        current_page: page,
        total_pages: numPages || 1,
        last_read_at: new Date().toISOString(),
        completed: isCompleted
      }
      
      const { data: updateData, error: updateErr } = await supabase
        .from('reading_progress')
        .update(payload)
        .eq('student_id', studentId)
        .eq('book_id', book.id)
        .select()
        
      if (!updateErr && (!updateData || updateData.length === 0)) {
        const { error: insertErr } = await supabase.from('reading_progress').insert({
          student_id: studentId,
          book_id: book.id,
          ...payload
        })
        if (insertErr) {
           console.error("Erro no insert:", insertErr)
           setSaveStatus('error')
           return
        }
      } else if (updateErr) {
        console.error("Erro no update:", updateErr)
        setSaveStatus('error')
        return
      }

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)

      // Gamificação: atualizar streak e conceder XP de leitura
      try {
        // 1. Streak diário
        fetch('/api/gamification/streak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId })
        }).catch(() => {})

        // 2. XP por página lida (+1 XP)
        fetch('/api/gamification/xp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, xpAmount: 1, reason: 'page_read', bookId: book.id })
        }).catch(() => {})

        // 3. XP por livro completado (+50 XP ao atingir a última página)
        if (reachedLastPage) {
          fetch('/api/gamification/xp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, xpAmount: 50, reason: 'book_complete', bookId: book.id })
          }).catch(() => {})
        }
      } catch (gamifErr) {
        console.warn('Gamification hook error:', gamifErr)
      }

      // Se chegou na última página e ainda não passou no quiz, abrir prompt de quiz
      if (reachedLastPage && !isQuizPassed) {
        setShowQuizPrompt(true)
      }
    }, 1500)
  }

  // Limpar timer ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Alternar Favorito
  const toggleFavorite = async () => {
    setFavLoading(true)
    try {
      if (fav) {
        // Remover dos favoritos
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('student_id', studentId)
          .eq('book_id', book.id)
        if (error) throw error
        setFav(false)
      } else {
        // Adicionar aos favoritos
        const { error } = await supabase
          .from('favorites')
          .insert({
            student_id: studentId,
            book_id: book.id
          })
        if (error) throw error
        setFav(true)
      }
    } catch (err: any) {
      alert('Erro ao salvar favoritos: ' + err.message)
    } finally {
      setFavLoading(false)
    }
  }

  // Ouvir a palavra selecionada (Speech Synthesis)
  const handleHearWord = (wordToHear?: string) => {
    const w = wordToHear || selectedWord
    if (!w) return
    window.speechSynthesis.cancel() // Cancelar qualquer fala em andamento
    const utterance = new SpeechSynthesisUtterance(w)
    utterance.lang = 'pt-BR'
    window.speechSynthesis.speak(utterance)
  }

  // Obter detalhes pedagógicos da palavra (10 campos)
  const getWordDetails = (wordToLookup: string, fetchedMeaning?: string) => {
    const cleanWord = wordToLookup.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    
    // 1. Verificar base local infantil
    const localEntry = CHILD_DICTIONARY[cleanWord]
    
    // 2. Separar Sílabas
    const sylList = separateSyllables(cleanWord)
    const syllablesStr = sylList.join(" - ")
    
    // 3. Identificar Sílaba Tônica
    const stressed = getStressedSyllable(sylList)
    const stressedStr = stressed.index >= 0 ? sylList[stressed.index] : "Não identificada"
    
    // 4. Formar Pronúncia Fonética Simplificada (Sílaba tônica em caixa alta para a criança visualizar)
    const pronunciationStr = sylList.length > 0 
      ? "/" + sylList.map((s, idx) => idx === stressed.index ? s.toUpperCase() : s).join("-") + "/"
      : "/" + cleanWord + "/"
      
    // 5. Determinar Nível de Dificuldade
    const difficultyStr = getDifficultyLevel(cleanWord, sylList)
    
    if (localEntry) {
      return {
        word: wordToLookup,
        meaning: fetchedMeaning || localEntry.childDefinition,
        childDefinition: localEntry.childDefinition,
        pronunciation: localEntry.pronunciation || pronunciationStr,
        syllables: syllablesStr,
        stressedSyllable: stressedStr + ` (${stressed.type})`,
        synonyms: localEntry.synonyms,
        antonyms: localEntry.antonyms,
        example: localEntry.example,
        difficulty: difficultyStr
      }
    }
    
    // Fallback dinâmico para outras palavras
    const meaningStr = fetchedMeaning || "Significado geral não disponível no dicionário off-line."
    let childDef = ""
    let exSentence = ""
    let syns = "Pesquisar online"
    
    if (fetchedMeaning) {
      // Simplificação básica para crianças
      childDef = fetchedMeaning.split('.')[0] + "."
      
      // Procurar frase de exemplo no XML do dicionário (entre underlines)
      const match = fetchedMeaning.match(/_([^_]+)_/)
      if (match) {
        exSentence = match[1]
      } else {
        exSentence = `O aluno está lendo um livro com a palavra ${cleanWord} hoje.`
      }
      
      // Obter sinônimos baseados nas primeiras palavras da definição se tiver vírgulas
      if (fetchedMeaning.includes(',')) {
        syns = fetchedMeaning.split(/[.:;]/)[0].split(',').slice(0, 3).join(', ')
      }
    } else {
      childDef = `Esta palavra descreve um objeto, ação ou sentimento no nosso vocabulário.`
      exSentence = `Eu li a palavra ${cleanWord} na história do livro.`
    }
    
    return {
      word: wordToLookup,
      meaning: meaningStr,
      childDefinition: childDef,
      pronunciation: pronunciationStr,
      syllables: syllablesStr,
      stressedSyllable: stressedStr + ` (${stressed.type})`,
      synonyms: syns,
      antonyms: `in${cleanWord}, des${cleanWord} (ou oposto de acordo com o contexto)`,
      example: exSentence,
      difficulty: difficultyStr
    }
  }

  // Fechar card flutuante e limpar seleção
  const closeDict = () => {
    setSelectedWord('')
    setSelectionCoords(null)
    setDictInfo(null)
    try {
      window.getSelection()?.removeAllRanges()
    } catch {}
  }

  // Buscar significado na nova API inteligente
  const fetchWordMeaning = async (wordToLookup: string) => {
    const cleanWord = wordToLookup.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\"\'«»“”]/g, "")
    if (!cleanWord) return

    setDictLoading(true)
    try {
      const response = await fetch(`/api/dictionary?word=${encodeURIComponent(cleanWord)}`)
      if (response.ok) {
        const data = await response.json()
        setDictInfo(data)
      } else {
        setDictInfo(getWordDetails(cleanWord))
      }
    } catch (error) {
      console.warn('Erro ao consultar API do dicionário, usando fallback:', error)
      setDictInfo(getWordDetails(cleanWord))
    } finally {
      setDictLoading(false)
    }
  }

  // Monitorar seleção de texto na página do livro
  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return
    const rawText = selection.toString().trim()
    const clean = rawText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\"\'«»“”]/g, '').trim()

    // Processar apenas palavras ou termos curtos (até 35 caracteres) sem quebras de linha
    if (clean && clean.length >= 2 && clean.length <= 35 && !rawText.includes('\n')) {
      try {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return

        // Posição vertical: se estiver perto do topo da tela (< 240px), colocar abaixo da seleção
        const isBelow = rect.top < 240
        const posY = isBelow ? rect.bottom + 14 : rect.top - 14

        // Posição horizontal: centralizar no meio da seleção e manter dentro dos limites da tela
        const cardWidth = 350
        const halfWidth = cardWidth / 2
        const rawX = rect.left + rect.width / 2
        const clampedX = Math.max(halfWidth + 16, Math.min(window.innerWidth - halfWidth - 16, rawX))

        setSelectionCoords({
          x: clampedX,
          y: posY,
          isBelow
        })

        // Buscar imediatamente o significado da palavra selecionada
        if (clean !== selectedWord) {
          setSelectedWord(clean)
          fetchWordMeaning(clean)
        }
      } catch (err) {
        console.error("Erro ao obter coordenadas da seleção:", err)
      }
    }
  }

  // Listener para fechamento ao clicar fora da área do card
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      if (dictPopoverRef.current && !dictPopoverRef.current.contains(e.target as Node)) {
        const selection = window.getSelection()
        if (selection && selection.isCollapsed) {
          closeDict()
        }
      }
    }

    document.addEventListener('selectionchange', handleTextSelection)
    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('touchstart', handleDocumentClick)
    return () => {
      document.removeEventListener('selectionchange', handleTextSelection)
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('touchstart', handleDocumentClick)
    }
  }, [selectedWord])

  // Controlar o Modo Apresentação (Tela Cheia com barra de endereço oculta)
  const toggleFullscreen = async () => {
    try {
      const doc = document as any
      const targetEl = (readerContainerRef.current || document.documentElement) as any

      const isFs = !!(
        doc.fullscreenElement || 
        doc.webkitFullscreenElement || 
        doc.mozFullScreenElement || 
        doc.msFullscreenElement
      )

      if (!isFs) {
        if (targetEl.requestFullscreen) {
          await targetEl.requestFullscreen()
        } else if (targetEl.webkitRequestFullscreen) {
          await targetEl.webkitRequestFullscreen()
        } else if (targetEl.mozRequestFullScreen) {
          await targetEl.mozRequestFullScreen()
        } else if (targetEl.msRequestFullscreen) {
          await targetEl.msRequestFullscreen()
        }
        setIsFullscreen(true)
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen()
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen()
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen()
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen()
        }
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('Erro ao alternar modo apresentação:', err)
    }
  }

  useEffect(() => {
    const handleFs = () => {
      const doc = document as any
      setIsFullscreen(!!(
        doc.fullscreenElement || 
        doc.webkitFullscreenElement || 
        doc.mozFullScreenElement || 
        doc.msFullscreenElement
      ))
    }
    document.addEventListener('fullscreenchange', handleFs)
    document.addEventListener('webkitfullscreenchange', handleFs)
    document.addEventListener('mozfullscreenchange', handleFs)
    document.addEventListener('MSFullscreenChange', handleFs)
    return () => {
      document.removeEventListener('fullscreenchange', handleFs)
      document.removeEventListener('webkitfullscreenchange', handleFs)
      document.removeEventListener('mozfullscreenchange', handleFs)
      document.removeEventListener('MSFullscreenChange', handleFs)
    }
  }, [])

  return (
    <div 
      ref={readerContainerRef}
      className="fixed inset-0 w-screen h-screen z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-text"
    >
      {/* Filtro de Brilho */}
      <div 
        className="fixed inset-0 pointer-events-none bg-black z-50 transition-opacity duration-300"
        style={{ opacity: 1 - brightness / 100 }}
      />

      {/* Header superior */}
      <header className="bg-slate-900/95 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between sticky top-0 z-40 backdrop-blur shadow-md">
        <button
          onClick={async () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            try {
              const payload = {
                current_page: currentPage,
                total_pages: numPages || 1,
                last_read_at: new Date().toISOString()
              }
              const { data: updateData, error: updateErr } = await supabase
                .from('reading_progress')
                .update(payload)
                .eq('student_id', studentId)
                .eq('book_id', book.id)
                .select()
              
              if (!updateErr && (!updateData || updateData.length === 0)) {
                await supabase.from('reading_progress').insert({
                  student_id: studentId,
                  book_id: book.id,
                  ...payload
                })
              }
            } catch (err) {
              console.error('Erro ao salvar no voltar', err)
            }
            router.refresh()
            router.back()
          }}
          className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Estante</span>
        </button>

        <div className="text-center max-w-[40%] sm:max-w-[55%]">
          <h2 className="font-bold text-xs sm:text-sm text-white truncate">{book.title}</h2>
          <p className="text-[10px] text-slate-400 truncate">{book.author || 'Autor'}</p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Botão de Quiz */}
          <button
            onClick={async () => {
              // Força o salvamento imediato do progresso antes de abrir o modal do quiz
              if (timerRef.current) clearTimeout(timerRef.current)
              const reachedLastPage = numPages > 0 && currentPage >= numPages
              
              const { data: attempts } = await supabase
                .from('quiz_attempts')
                .select('passed')
                .eq('student_id', studentId)
                .eq('book_id', book.id)
                .eq('passed', true)
                .limit(1)
                
              const isQuizPassed = !!(attempts && attempts.length > 0)
              const isCompleted = reachedLastPage && isQuizPassed

              const payload = {
                current_page: currentPage,
                total_pages: numPages || 1,
                last_read_at: new Date().toISOString(),
                completed: isCompleted
              }
              const { data: updateData, error: updateErr } = await supabase
                .from('reading_progress')
                .update(payload)
                .eq('student_id', studentId)
                .eq('book_id', book.id)
                .select()
              
              if (!updateErr && (!updateData || updateData.length === 0)) {
                await supabase.from('reading_progress').insert({
                  student_id: studentId,
                  book_id: book.id,
                  ...payload
                })
              }

              if (!reachedLastPage && !isQuizPassed) {
                setShowEarlyQuizPrompt(true)
              } else {
                setShowQuiz(true)
              }
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 border border-amber-400"
            title="Responder Questionário do Livro"
          >
            <FileQuestion size={13} />
            <span className="hidden sm:inline">Quiz</span>
          </button>

          {/* Indicador de Páginas */}
          <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full font-semibold font-mono text-indigo-400 flex items-center space-x-2">
            <span>{currentPage} / {numPages || '...'}</span>
            {saveStatus === 'saving' && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
            {saveStatus === 'saved' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
            {saveStatus === 'error' && <span title="Erro ao salvar"><XCircle className="w-3 h-3 text-red-500" /></span>}
          </span>

          {/* Botão Modo Apresentação (Tela Cheia sem barra de endereço) */}
          <button
            onClick={toggleFullscreen}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 border ${
              isFullscreen
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-500/20'
                : 'bg-slate-800 border-slate-700 hover:bg-slate-750 text-slate-200 hover:text-white'
            }`}
            title={isFullscreen ? 'Sair do Modo Apresentação (ESC)' : 'Ativar Modo Apresentação (Esconder Barra de Endereço do Navegador)'}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            <span className="hidden md:inline">{isFullscreen ? 'Sair' : 'Apresentação'}</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Central: PDF ocupando toda a largura da tela com Scroll Vertical */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center p-0 w-full relative"
      >
        {pdfLoading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-slate-400">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
            <p className="text-sm font-semibold">Carregando livro...</p>
          </div>
        )}

        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-slate-400">
              <Loader2 className="animate-spin text-indigo-500" size={48} />
              <p className="text-sm font-semibold">Carregando livro...</p>
            </div>
          }
        >
          {!pdfLoading && numPages > 0 && (
            <div className="relative flex flex-col items-center w-full max-w-full pb-16">
              {/* Botão flutuante esquerdo de navegação */}
              {currentPage > 1 && (
                <button
                  type="button"
                  onClick={prevPage}
                  className="fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-slate-900/80 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-400 text-white flex items-center justify-center shadow-2xl backdrop-blur transition-all active:scale-95 group"
                  aria-label="Página anterior"
                  title="Página Anterior"
                >
                  <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Cartão de Leitura da Página ocupando 100% da largura */}
              <div 
                className="bg-white shadow-2xl overflow-hidden w-full flex justify-center transition-all duration-200"
                style={{ width: `${pageWidth}px` }}
              >
                <Page
                  pageNumber={currentPage}
                  width={pageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  loading={
                    <div 
                      className="flex flex-col items-center justify-center bg-white text-slate-400 space-y-2 py-32 w-full"
                      style={{ width: `${pageWidth}px` }}
                    >
                      <Loader2 className="animate-spin text-indigo-500" size={32} />
                      <span className="text-xs">Carregando Página {currentPage}...</span>
                    </div>
                  }
                />
              </div>

              {/* Botão flutuante direito de navegação */}
              {currentPage < numPages && (
                <button
                  type="button"
                  onClick={nextPage}
                  className="fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-indigo-600/90 hover:bg-indigo-500 border border-indigo-400 text-white flex items-center justify-center shadow-2xl backdrop-blur transition-all active:scale-95 group animate-pulse"
                  aria-label="Próxima página"
                  title="Próxima Página"
                >
                  <ChevronRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Barra de Ação Abaixo da Página */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <button
                  onClick={prevPage}
                  disabled={currentPage <= 1}
                  className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all shadow"
                >
                  <ChevronLeft size={16} />
                  <span>Página Anterior</span>
                </button>

                <span className="text-xs font-mono font-bold text-indigo-400 bg-slate-900 border border-slate-700 px-4 py-2.5 rounded-xl shadow">
                  Página {currentPage} de {numPages}
                </span>

                <button
                  onClick={nextPage}
                  disabled={currentPage >= numPages}
                  className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95"
                >
                  <span>Próxima Página</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </Document>
      </div>

      {/* Controles de leitura no rodapé (Zoom, Brilho, Favoritar) */}
      <footer className="bg-slate-900/95 backdrop-blur border-t border-slate-800/80 px-4 py-2.5 sticky bottom-0 z-40 flex items-center justify-between sm:justify-center sm:space-x-8 max-w-7xl mx-auto w-full shadow-lg">
        {/* Controles de Zoom */}
        <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-slate-700/60 p-1 rounded-xl">
          <button
            onClick={() => setZoom(Math.max(0.6, zoom - 0.1))}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
            title="Diminuir Zoom"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-semibold px-1 text-slate-300 font-mono select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(2.0, zoom + 0.1))}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
            title="Aumentar Zoom"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Controle de Brilho */}
        <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700/60 px-3 py-1.5 rounded-xl">
          <Sun size={16} className="text-slate-400" />
          <input
            type="range"
            min="30"
            max="100"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-16 sm:w-24 accent-indigo-500 cursor-pointer"
          />
        </div>

        {/* Favoritar */}
        <button
          onClick={toggleFavorite}
          disabled={favLoading}
          className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl border transition-all ${
            fav
              ? 'bg-red-950/40 border-red-900 text-red-400 font-bold scale-[1.02]'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
          <span className="text-xs hidden sm:inline">{fav ? 'Favoritado' : 'Favoritar'}</span>
        </button>
      </footer>

      {/* CARD FLUTUANTE DE SIGNIFICADO IMEDIATO AO SELECIONAR */}
      {selectedWord && selectionCoords && (
        <div 
          ref={dictPopoverRef}
          className={`fixed z-50 bg-slate-900/95 border border-indigo-500/40 text-white rounded-2xl shadow-2xl p-3.5 sm:p-4 backdrop-blur-md transition-all duration-200 animate-in fade-in zoom-in-95 select-none ${
            isMobile 
              ? 'bottom-4 left-3 right-3 max-w-none shadow-indigo-950/50' 
              : 'w-[330px] sm:w-[360px]'
          }`}
          style={
            isMobile 
              ? { transform: 'none' } 
              : { 
                  left: `${selectionCoords.x}px`, 
                  top: `${selectionCoords.y}px`,
                  transform: selectionCoords.isBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
                }
          }
        >
          {/* Indicador de seta direcional apontando para a palavra (desktop) */}
          {!isMobile && (
            <div 
              className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-indigo-500/40 rotate-45 ${
                selectionCoords.isBelow 
                  ? '-top-1.5 border-t border-l' 
                  : '-bottom-1.5 border-b border-r'
              }`}
            />
          )}

          {/* Cabeçalho do Card: Palavra, Classe Gramatical, Botão de Ouvir e Fechar */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h3 className="text-base font-extrabold capitalize text-white tracking-tight truncate">
                  {dictInfo?.word || selectedWord}
                </h3>
                {dictInfo?.pos && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 truncate max-w-[150px]">
                    {dictInfo.pos}
                  </span>
                )}
              </div>
              {dictInfo?.syllables && (
                <p className="text-xs text-indigo-400 font-mono mt-0.5">
                  {dictInfo.syllables} {dictInfo.pronunciation && <span className="text-slate-400 text-[11px] font-sans">· {dictInfo.pronunciation}</span>}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleHearWord(dictInfo?.word || selectedWord)}
                className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                title="Ouvir pronúncia da palavra"
              >
                <Volume2 size={13} />
                <span className="text-[11px]">Ouvir</span>
              </button>
              <button
                type="button"
                onClick={closeDict}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Fechar"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Conteúdo do Significado */}
          <div className="pt-2.5 space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {dictLoading ? (
              <div className="flex items-center space-x-2.5 py-4 text-indigo-400">
                <Loader2 className="animate-spin text-indigo-500" size={18} />
                <span className="text-xs font-semibold">Consultando significado...</span>
              </div>
            ) : dictInfo ? (
              <>
                {/* Significado em destaque */}
                <div className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed bg-indigo-950/30 border border-indigo-900/40 p-2.5 rounded-xl">
                  <span className="text-indigo-400 font-bold block text-[10px] uppercase tracking-wider mb-1">
                    📖 Significado
                  </span>
                  {dictInfo.childDefinition || dictInfo.meaning}
                </div>

                {/* Exemplo de uso */}
                {dictInfo.example && (
                  <div className="text-[11px] sm:text-xs text-slate-300 italic bg-slate-800/60 p-2 rounded-lg border border-slate-750">
                    <span className="text-amber-400 not-italic font-semibold mr-1">💡 Exemplo:</span>
                    &quot;{dictInfo.example}&quot;
                  </div>
                )}

                {/* Sinônimos */}
                {dictInfo.synonyms && (
                  <div className="text-[11px] text-slate-300 flex items-center space-x-1">
                    <span className="text-emerald-400 font-bold">🔄 Sinônimos:</span>
                    <span className="capitalize text-slate-200">{dictInfo.synonyms}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400 py-2">Não foi possível carregar o significado desta palavra.</p>
            )}
          </div>
        </div>
      )}


      {/* Modal de Bloqueio de Quiz Antecipado */}
      {showEarlyQuizPrompt && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full mx-4 text-center space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in">
            <div className="text-5xl text-amber-500">
              <FileQuestion className="mx-auto" size={56} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Ainda não!
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Você precisa ler o livro até a última página para liberar o questionário de validação.
            </p>
            <div className="flex flex-col space-y-3 pt-2">
              <button
                onClick={() => setShowEarlyQuizPrompt(false)}
                className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95"
              >
                <span>Voltar à Leitura</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt de Quiz - aparece quando a leitura atinge 100% */}
      {showQuizPrompt && !showQuiz && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full mx-4 text-center space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in">
            <div className="text-6xl">🎉</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Parabéns! Você terminou o livro!
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Que tal responder algumas perguntas sobre a história para testar o que você aprendeu?
            </p>
            <div className="flex flex-col space-y-3 pt-2">
              <button
                onClick={() => {
                  setShowQuizPrompt(false)
                  setShowQuiz(true)
                }}
                className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95"
              >
                <FileQuestion size={18} />
                <span>Responder Agora!</span>
              </button>
              <button
                onClick={() => setShowQuizPrompt(false)}
                className="px-6 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold transition-colors"
              >
                Responder Depois
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Quiz */}
      {showQuiz && (
        <QuizModal
          bookId={book.id}
          bookTitle={book.title}
          studentId={studentId}
          onClose={() => setShowQuiz(false)}
          onComplete={(score, passed) => {
            setShowQuiz(false)
            if (passed) {
              alert(`🎉 Parabéns! Você foi aprovado com ${score}%!`)
            }
          }}
        />
      )}
    </div>
  )
}

// ==========================================
// AUXILIARES LINGUÍSTICOS E DICIONÁRIO INFANTIL
// ==========================================

const CHILD_DICTIONARY: Record<string, {
  childDefinition: string;
  synonyms: string;
  antonyms: string;
  example: string;
  pronunciation?: string;
}> = {
  aluno: {
    childDefinition: "A criança que vai à escola para aprender coisas novas com os professores.",
    synonyms: "estudante, discente, colegial",
    antonyms: "professor, mestre",
    example: "O aluno novo tirou uma dúvida sobre a leitura."
  },
  professora: {
    childDefinition: "A pessoa querida que ensina matérias legais, lê histórias e cuida de nós na escola.",
    synonyms: "mestre, docente, educadora",
    antonyms: "aluno, estudante",
    example: "A professora explicou como os planetas giram ao redor do sol."
  },
  professor: {
    childDefinition: "O profissional que ensina matérias legais, lê histórias e nos ajuda a aprender na escola.",
    synonyms: "mestre, docente, educador",
    antonyms: "aluno, estudante",
    example: "O professor de educação física organizou um jogo de futebol."
  },
  estudar: {
    childDefinition: "Dedicar um tempinho para ler, praticar e aprender sobre as coisas do mundo.",
    synonyms: "aprender, praticar, exercitar",
    antonyms: "vadiar, desleixar",
    example: "Eu vou estudar ciências para fazer a maquete do vulcão."
  },
  aprender: {
    childDefinition: "Descobrir como fazer algo novo ou entender um assunto que você não conhecia antes.",
    synonyms: "assimilar, memorizar, compreender",
    antonyms: "esquecer, desaprender",
    example: "É muito divertido aprender a andar de bicicleta sem rodinhas."
  },
  escrever: {
    childDefinition: "Usar um lápis ou caneta para desenhar letras e formar palavras no papel.",
    synonyms: "redigir, grafar, anotar",
    antonyms: "apagar, ler",
    example: "Eu adoro escrever cartinhas para os meus avós."
  },
  caderno: {
    childDefinition: "Um livro de folhas em branco onde a gente escreve as tarefas e desenha o que quiser.",
    synonyms: "bloco, bloco de notas",
    antonyms: "folha solta",
    example: "Meu caderno novo tem uma capa cheia de adesivos de dinossauro."
  },
  lapis: {
    childDefinition: "A ferramenta de madeira com grafite dentro que a gente usa para escrever e desenhar.",
    synonyms: "lapiseira, grafite",
    antonyms: "borracha (apaga)",
    example: "Vou apontar meu lápis para o desenho ficar bem caprichado."
  },
  lápis: {
    childDefinition: "A ferramenta de madeira com grafite dentro que a gente usa para escrever e desenhar.",
    synonyms: "lapiseira, grafite",
    antonyms: "borracha (apaga)",
    example: "Vou apontar meu lápis para o desenho ficar bem caprichado."
  },
  borracha: {
    childDefinition: "O objeto macio que a gente esfrega no papel para apagar os errinhos feitos a lápis.",
    synonyms: "apagador",
    antonyms: "lápis (escreve)",
    example: "Emprestei minha borracha colorida para o colega de classe."
  },
  gato: {
    childDefinition: "Um animalzinho doméstico fofo que faz 'miau', adora tirar sonecas e brincar com novelos.",
    synonyms: "felino, bichano",
    antonyms: "rato (rival clássico)",
    example: "O meu gato gosta de se esfregar nas minhas pernas quando chego em casa."
  },
  cao: {
    childDefinition: "O melhor amigo de quatro patas do ser humano, que faz 'au au' e adora brincar de buscar a bolinha.",
    synonyms: "cachorro, cãozinho, canino",
    antonyms: "gato (rivalidade clássica)",
    example: "Meu cão corre muito rápido no parque."
  },
  cão: {
    childDefinition: "O melhor amigo de quatro patas do ser humano, que faz 'au au' e adora brincar de buscar a bolinha.",
    synonyms: "cachorro, cãozinho, canino",
    antonyms: "gato (rivalidade clássica)",
    example: "Meu cão corre muito rápido no parque."
  },
  cachorro: {
    childDefinition: "O melhor amigo de quatro patas do ser humano, que faz 'au au' e adora brincar de buscar a bolinha.",
    synonyms: "cão, cãozinho, canino",
    antonyms: "gato",
    example: "O cachorro do vizinho sempre abana o rabo quando me vê."
  },
  arvore: {
    childDefinition: "Uma planta grande com tronco de madeira, galhos fortes, folhas verdes e que às vezes dá frutas gostosas.",
    synonyms: "planta, arbusto",
    antonyms: "secura, deserto",
    example: "Subimos no pé de manga e sentamos na sombra da árvore."
  },
  árvore: {
    childDefinition: "Uma planta grande com tronco de madeira, galhos fortes, folhas verdes e que às vezes dá frutas gostosas.",
    synonyms: "planta, arbusto",
    antonyms: "secura, deserto",
    example: "Subimos no pé de manga e sentamos na sombra da árvore."
  },
  comida: {
    childDefinition: "Qualquer coisa gostosa que a gente come para dar energia ao corpo e crescer forte.",
    synonyms: "alimento, refeição, nutrição",
    antonyms: "fome, jejum",
    example: "A comida da minha avó tem o melhor cheirinho do mundo."
  },
  maca: {
    childDefinition: "Uma fruta redondinha, doce e crocante que pode ser vermelha ou verde.",
    synonyms: "fruto da macieira",
    antonyms: "fruta azeda",
    example: "Lavei a maçã vermelha para comer no lanche da tarde."
  },
  maçã: {
    childDefinition: "Uma fruta redondinha, doce e crocante que pode ser vermelha ou verde.",
    synonyms: "fruto da macieira",
    antonyms: "fruta azeda",
    example: "Lavei a maçã vermelha para comer no lanche da tarde."
  },
  doce: {
    childDefinition: "Alimentos que têm sabor açucarado gostoso, como brigadeiro, pirulito e chocolate.",
    synonyms: "açucarado, melado, guloseima",
    antonyms: "salgado, azedo, amargo",
    example: "Minha mãe deixou eu escolher um doce depois do almoço."
  },
  brinquedo: {
    childDefinition: "Qualquer objeto feito para a gente se divertir e soltar a imaginação nas brincadeiras.",
    synonyms: "divertimento, entretenimento",
    antonyms: "ferramenta de trabalho",
    example: "Guardei meu brinquedo favorito na caixa de madeira."
  },
  bola: {
    childDefinition: "Um objeto redondo que rola e pula, usado para jogar futebol, basquete ou queimada.",
    synonyms: "esfera, pelota",
    antonyms: "cubo, caixa",
    example: "Chutei a bola de futebol direto no gol."
  },
  boneca: {
    childDefinition: "Um brinquedo que imita uma pessoa ou personagem, excelente para brincar de casinha.",
    synonyms: "fantoche, marionete",
    antonyms: "carrinho",
    example: "Minha irmã faz roupinhas de pano para a boneca dela."
  },
  pao: {
    childDefinition: "Um alimento assado bem quentinho e macio, feito de farinha, muito gostoso no café da manhã.",
    synonyms: "bisnaga, cacete, carioquinha",
    antonyms: "fome",
    example: "Passar manteiga no pão quentinho é uma delícia!"
  },
  pão: {
    childDefinition: "Um alimento assado bem quentinho e macio, feito de farinha, muito gostoso no café da manhã.",
    synonyms: "bisnaga, cacete, carioquinha",
    antonyms: "fome",
    example: "Passar manteiga no pão quentinho é uma delícia!"
  },
  leite: {
    childDefinition: "Um líquido branquinho e nutritivo produzido pelas vaquinhas, excelente para deixar nossos ossos fortes.",
    synonyms: "lactato, bebida láctea",
    antonyms: "café puro",
    example: "Eu gosto de beber leite morno com chocolate pela manhã."
  },
  casa: {
    childDefinition: "Um lugar quentinho e seguro onde a gente mora com a nossa família.",
    synonyms: "lar, morada, residência",
    antonyms: "rua, desabrigo",
    example: "Depois da aula, eu vou correndo para a minha casa."
  },
  amigo: {
    childDefinition: "Uma pessoa querida com quem a gente gosta de brincar, conversar e dividir as coisas.",
    synonyms: "colega, parceiro, companheiro",
    antonyms: "inimigo, rival",
    example: "O Lucas é meu melhor amigo e nós jogamos bola juntos."
  },
  livro: {
    childDefinition: "Um conjunto de folhas cheias de histórias, desenhos e coisas legais para aprender.",
    synonyms: "obra, volume, publicação",
    antonyms: "folha em branco",
    example: "Eu li um livro sobre dragões que voam no espaço!"
  },
  escola: {
    childDefinition: "O lugar divertido onde a gente vai para aprender coisas novas, ler, escrever e ver os amigos.",
    synonyms: "colégio, educandário",
    antonyms: "casa (nas férias)",
    example: "Na escola, minha matéria favorita é ciências."
  },
  ler: {
    childDefinition: "Olhar para as letrinhas e entender a história ou mensagem que elas contam.",
    synonyms: "decifrar, folhear, interpretar",
    antonyms: "escrever, ignorar",
    example: "Eu gosto de ler um gibizinho antes de dormir."
  },
  familia: {
    childDefinition: "O grupo de pessoas que nos ama, cuida de nós e mora no nosso coração (como papai, mamãe, irmãos e avós).",
    synonyms: "parentes, lar, clã",
    antonyms: "estranhos",
    example: "Minha família adora fazer piquenique no parque aos domingos."
  },
  família: {
    childDefinition: "O grupo de pessoas que nos ama, cuida de nós e mora no nosso coração (como papai, mamãe, irmãos e avós).",
    synonyms: "parentes, lar, clã",
    antonyms: "estranhos",
    example: "Minha família adora fazer piquenique no parque aos domingos."
  },
  brincar: {
    childDefinition: "Fazer uma atividade divertida só para se alegrar, como jogar bola, boneca ou esconde-esconde.",
    synonyms: "divertir-se, recrear, folgar",
    antonyms: "trabalhar, chatear-se",
    example: "Vamos brincar de pega-pega no recreio?"
  },
  feliz: {
    childDefinition: "Estar com um sorriso no rosto e o coração alegre por causa de algo muito bom.",
    synonyms: "alegre, contente, satisfeito",
    antonyms: "triste, zangado, infeliz",
    example: "Fiquei muito feliz quando ganhei um abraço."
  },
  triste: {
    childDefinition: "Aquela sensação chata no coração quando alguma coisa não dá certo e dá vontade de chorar.",
    synonyms: "chateado, cabisbaixo, melancólico",
    antonyms: "feliz, alegre, contente",
    example: "Fiquei triste porque perdi meu brinquedo favorito."
  },
  amor: {
    childDefinition: "O sentimento mais bonito de carinho e cuidado que sentimos pelos pais, amigos e bichinhos.",
    synonyms: "afeto, carinho, benquerença",
    antonyms: "ódio, desamor",
    example: "Eu sinto muito amor pela minha mãe."
  },
  sol: {
    childDefinition: "A estrela brilhante e quente lá no céu que ilumina o nosso dia e nos aquece.",
    synonyms: "astro-rei",
    antonyms: "escuridão, noite",
    example: "O sol está brilhando forte e hoje vamos à praia."
  },
  lua: {
    childDefinition: "A companheira brilhante da noite que fica lá no céu mudando de formato.",
    synonyms: "satélite natural",
    antonyms: "sol",
    example: "A lua cheia está iluminando todo o meu quarto."
  },
  flor: {
    childDefinition: "A parte colorida e cheirosa das plantinhas que deixa o jardim muito bonito.",
    synonyms: "pétala, broto",
    antonyms: "espinho",
    example: "Eu colhi uma flor amarela para dar de presente."
  },
  agua: {
    childDefinition: "O líquido transparente e fresquinho que a gente bebe para matar a sede e usa para tomar banho.",
    synonyms: "líquido vital",
    antonyms: "secura",
    example: "É muito importante beber água para ficar saudável."
  },
  água: {
    childDefinition: "O líquido transparente e fresquinho que a gente bebe para matar a sede e usa para tomar banho.",
    synonyms: "líquido vital",
    antonyms: "secura",
    example: "É muito importante beber água para ficar saudável."
  }
};

function separateSyllables(word: string): string[] {
  const cleanWord = word.trim().toLowerCase();
  if (!cleanWord) return [];

  const vowels = "aeiouáéíóúâêôãõüàíy";
  const isVowel = (c: string) => vowels.includes(c);
  
  const syllables: string[] = [];
  let current = "";
  
  for (let i = 0; i < cleanWord.length; i++) {
    const char = cleanWord[i];
    current += char;
    
    if (i < cleanWord.length - 1) {
      const next = cleanWord[i + 1];
      const nextNext = cleanWord[i + 2] || "";
      
      if (isVowel(char) && isVowel(next)) {
        const accentedVowels = "áéíóúâêôíú";
        if (char !== next && (accentedVowels.includes(next) || char === 'a' || char === 'e' || char === 'o')) {
          syllables.push(current);
          current = "";
        }
      }
      else if (isVowel(char) && !isVowel(next) && isVowel(nextNext)) {
        const isDigraph = ["ch", "lh", "nh", "gu", "qu"].includes(next + nextNext);
        const isConsonantGroup = "bcdfgptv".includes(next) && "rl".includes(nextNext);
        
        if (!isDigraph && !isConsonantGroup) {
          syllables.push(current);
          current = "";
        }
      }
      else if (!isVowel(char) && !isVowel(next)) {
        const pair = char + next;
        if (["rr", "ss", "sc", "sç", "xc"].includes(pair)) {
          syllables.push(current);
          current = "";
        }
        else {
          const isDigraphNext = ["ch", "lh", "nh", "gu", "qu"].includes(next + nextNext);
          const isConsonantGroupNext = "bcdfgptv".includes(next) && "rl".includes(nextNext);
          const isVowelNextNext = isVowel(nextNext);
          
          if ((isDigraphNext || isConsonantGroupNext) && isVowelNextNext) {
            syllables.push(current);
            current = "";
          }
        }
      }
    }
  }
  if (current) {
    syllables.push(current);
  }
  
  return syllables;
}

function getStressedSyllable(syllables: string[]): { index: number; type: string } {
  if (syllables.length === 0) return { index: -1, type: "" };
  if (syllables.length === 1) return { index: 0, type: "Monossílaba" };

  const accents = "áéíóúâêôãõ";
  const hasAccent = (s: string) => {
    for (let j = 0; j < s.length; j++) {
      if (accents.includes(s[j])) return true;
    }
    return false;
  };

  for (let i = 0; i < syllables.length; i++) {
    if (hasAccent(syllables[i])) {
      const posFromEnd = syllables.length - 1 - i;
      let type = "Paroxítona";
      if (posFromEnd === 0) type = "Oxítona";
      else if (posFromEnd === 1) type = "Paroxítona";
      else if (posFromEnd >= 2) type = "Proparoxítona";
      return { index: i, type };
    }
  }

  const lastSyllable = syllables[syllables.length - 1];
  const lastChar = lastSyllable[lastSyllable.length - 1];
  const lastTwo = lastSyllable.slice(-2);

  const isParoxitonaEnding = 
    "aeo".includes(lastChar) || 
    ["as", "es", "os", "am", "em"].includes(lastTwo) ||
    lastSyllable.endsWith("ens");

  if (isParoxitonaEnding) {
    return { 
      index: syllables.length - 2, 
      type: "Paroxítona" 
    };
  } else {
    return { 
      index: syllables.length - 1, 
      type: "Oxítona" 
    };
  }
}

function getDifficultyLevel(word: string, syllables: string[]): string {
  const w = word.toLowerCase().trim();
  const length = w.length;
  const syllableCount = syllables.length;
  
  const complexDigraphs = ["xc", "sc", "sç", "ps", "gn", "lh", "nh", "ch", "gu", "qu"];
  const hasComplex = complexDigraphs.some(d => w.includes(d));

  if (length >= 10 || syllableCount >= 4) {
    return "Difícil";
  } else if (length <= 5 && syllableCount <= 2 && !hasComplex) {
    return "Fácil";
  } else {
    return "Médio";
  }
}
