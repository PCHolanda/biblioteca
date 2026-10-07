'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, Search, Heart, Star, Sparkles, Filter, BookmarkCheck, FileQuestion, Trophy } from 'lucide-react'
import Image from 'next/image'
import QuizModal from './QuizModal'
import GamificationBar from './GamificationBar'
import XpNotification from './XpNotification'

interface EstanteClientProps {
  books: any[]
  favoriteIds: string[]
  readingProgress: any[]
  quizAttempts?: any[]
  studentId: string
}

type TabType = 'todos' | 'lendo' | 'favoritos' | 'lidos'

export default function EstanteClient({ books, favoriteIds, readingProgress, quizAttempts = [], studentId }: EstanteClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTab, setSelectedTab] = useState<TabType>('todos')
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [activeQuizBook, setActiveQuizBook] = useState<{ id: string; title: string } | null>(null)
  const [xpNotif, setXpNotif] = useState<{
    xpAmount: number; reason: string; leveledUp?: boolean;
    newLevel?: number; newLevelName?: string;
    badgesUnlocked?: Array<{ name: string; icon: string; description: string }>
  } | null>(null)
  const [gamifKey, setGamifKey] = useState(0) // Force refresh GamificationBar

  // Extrair todos os gêneros únicos dos livros para os botões de filtro rápido
  const genres = Array.from(new Set(books.map((b) => b.genre).filter(Boolean))) as string[]

  // Progresso de leitura mapeado por book_id
  const getBookProgress = (bookId: string) => {
    const prog = readingProgress.find((p) => p.book_id === bookId)
    if (!prog) return null

    // Verificar se existe tentativa de quiz aprovada para este livro
    const quizPassed = quizAttempts.some((q) => q.book_id === bookId && q.passed)
    const isCompleted = prog.completed || quizPassed

    // Se leu todas as páginas mas não passou no quiz -> Quiz Pendente
    const hasPendingQuiz = !isCompleted && prog.current_page >= prog.total_pages

    let percent = 0
    if (isCompleted) {
      percent = 100
    } else if (hasPendingQuiz) {
      percent = 95 // Fica em 95% aguardando a validação pelo Quiz
    } else if (prog.current_page > 0) {
      percent = Math.min(90, Math.max(1, Math.round((prog.current_page / prog.total_pages) * 90)))
    }

    return {
      percent,
      currentPage: prog.current_page,
      totalPages: prog.total_pages,
      completed: isCompleted,
      hasPendingQuiz
    }
  }

  // Filtragem e busca combinada
  const filteredBooks = books.filter((book) => {
    // 1. Busca por texto
    const matchesSearch =
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false

    // 2. Filtro por Gênero
    if (selectedGenre && book.genre !== selectedGenre) return false

    // 3. Filtro por Abas (TabType)
    const prog = getBookProgress(book.id)
    if (selectedTab === 'lendo') {
      return prog && !prog.completed && prog.currentPage > 0
    }
    if (selectedTab === 'lidos') {
      return prog && prog.completed
    }
    if (selectedTab === 'favoritos') {
      return favoriteIds.includes(book.id)
    }

    return true
  })

  return (
    <div className="space-y-6">
      {/* Barra de Gamificação (XP, Nível, Streak) */}
      <GamificationBar key={gamifKey} studentId={studentId} />

      {/* Busca e Títulos */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <Sparkles size={20} className="text-indigo-650 dark:text-indigo-400" />
            <span>Sua Estante Digital</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Livros recomendados para a sua idade e série.
          </p>
        </div>

        {/* Input de Busca */}
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Buscar por título ou autor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors duration-250 shadow-sm"
          />
          <Search className="absolute left-3.5 top-3 text-slate-500 dark:text-slate-400" size={16} />
        </div>
      </div>

      {/* Abas de Navegação interna (Todos, Lendo, Favoritos, Lidos) */}
      <div className="flex space-x-1.5 border-b border-slate-200 dark:border-slate-800 pb-px">
        {(['todos', 'lendo', 'favoritos', 'lidos'] as TabType[]).map((tab) => {
          const isActive = selectedTab === tab
          const labels = {
            todos: 'Todos os Livros',
            lendo: 'Lendo Atualmente',
            favoritos: 'Favoritos',
            lidos: 'Já Concluídos',
          }
          return (
            <button
              key={tab}
              onClick={() => {
                setSelectedTab(tab)
                setSelectedGenre(null) // Reseta o gênero ao trocar de aba principal
              }}
              className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 px-2.5 transition-colors capitalize ${
                isActive
                  ? 'border-indigo-650 dark:border-indigo-500 text-indigo-650 dark:text-indigo-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {labels[tab]}
            </button>
          )
        })}
      </div>

      {/* Filtros rápidos por Gênero */}
      {genres.length > 0 && selectedTab === 'todos' && (
        <div className="flex flex-wrap gap-1.5 py-1 items-center">
          <span className="text-[10px] text-slate-500 dark:text-slate-450 uppercase font-semibold mr-1 flex items-center">
            <Filter size={10} className="mr-1" /> Gênero:
          </span>
          <button
            onClick={() => setSelectedGenre(null)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              selectedGenre === null
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-750'
            }`}
          >
            Todos
          </button>
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                selectedGenre === genre
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-750'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {/* Grid de Livros */}
      {filteredBooks.length === 0 ? (
        <div className="text-center py-16 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <BookOpen className="mx-auto text-slate-400 dark:text-slate-500 mb-3" size={36} />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum livro encontrado para esta busca/filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredBooks.map((book) => {
            const isFav = favoriteIds.includes(book.id)
            const progress = getBookProgress(book.id)

            return (
              <div
                key={book.id}
                className="group bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl overflow-hidden shadow-md flex flex-col justify-between transition-all hover:scale-[1.02] duration-200"
              >
                {/* Capa com tag de favorito e progresso */}
                <div className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 overflow-hidden w-full">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={book.title}
                      fill
                      className="object-cover group-hover:scale-[1.05] transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 p-4 text-center">
                      <BookOpen size={40} className="mb-2" />
                      <span className="text-xs font-medium line-clamp-2">{book.title}</span>
                    </div>
                  )}

                  {/* Favorito Badge */}
                  {isFav && (
                    <div className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm text-red-500 shadow-sm border border-slate-200 dark:border-slate-850">
                      <Heart size={14} fill="currentColor" />
                    </div>
                  )}

                  {/* Badges de Status (100% Concluído vs Quiz Pendente) */}
                  {progress?.completed ? (
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-emerald-600/95 text-white text-[10px] font-bold flex items-center space-x-1 shadow-md backdrop-blur-sm border border-emerald-400/40">
                      <Trophy size={11} />
                      <span>100% Lido</span>
                    </div>
                  ) : progress?.hasPendingQuiz ? (
                    <button
                      type="button"
                      onClick={() => setActiveQuizBook({ id: book.id, title: book.title })}
                      className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center space-x-1 shadow-lg border border-amber-300 animate-pulse transition-transform hover:scale-105"
                      title="Clique para responder o quiz"
                    >
                      <FileQuestion size={12} />
                      <span>Quiz Pendente</span>
                    </button>
                  ) : null}
                </div>

                {/* Metadados e botão de leitura */}
                <div className="p-3 flex flex-col justify-between flex-1 space-y-2.5">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase tracking-wider bg-slate-150 dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full">
                      {book.genre || 'Literatura'}
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm line-clamp-1 leading-snug">
                      {book.title}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs truncate">{book.author}</p>
                  </div>

                  {/* Indicadores de Progresso e Ação */}
                  {progress?.completed ? (
                    <div className="space-y-2">
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                        <span className="flex items-center space-x-1">
                          <Trophy size={11} />
                          <span>Leitura Concluída</span>
                        </span>
                        <span>100%</span>
                      </div>
                      <Link
                        href={`/aluno/livro/${book.id}`}
                        className="flex items-center justify-center w-full py-2 bg-slate-700 hover:bg-slate-800 dark:bg-slate-750 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        <span>Ler Novamente</span>
                      </Link>
                    </div>
                  ) : progress?.hasPendingQuiz ? (
                    <div className="space-y-2">
                      <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-300 dark:border-amber-700 space-y-1">
                        <div className="flex justify-between text-[10px] font-extrabold text-amber-800 dark:text-amber-300">
                          <span className="flex items-center space-x-1">
                            <FileQuestion size={12} />
                            <span>Aguardando Quiz</span>
                          </span>
                          <span>95%</span>
                        </div>
                        <div className="w-full bg-amber-200 dark:bg-amber-900/60 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '95%' }} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveQuizBook({ id: book.id, title: book.title })}
                        className="flex items-center justify-center space-x-1.5 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-extrabold transition-all shadow-md active:scale-95 border border-amber-400 cursor-pointer"
                      >
                        <FileQuestion size={14} />
                        <span>Responder Quiz</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {progress && progress.currentPage > 0 && (
                        <div className="space-y-1">
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full"
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                              Pág. {progress.currentPage} de {progress.totalPages}
                            </span>
                            <span>{progress.percent}%</span>
                          </div>
                        </div>
                      )}
                      <Link
                        href={`/aluno/livro/${book.id}`}
                        className="flex items-center justify-center w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        <span>{progress && progress.currentPage > 0 ? `Continuar da Pág. ${progress.currentPage}` : 'Iniciar Leitura'}</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Quiz Acionado Diretamente na Estante */}
      {activeQuizBook && (
        <QuizModal
          bookId={activeQuizBook.id}
          bookTitle={activeQuizBook.title}
          studentId={studentId}
          onClose={() => setActiveQuizBook(null)}
          onComplete={(score, passed) => {
            setActiveQuizBook(null)
            if (passed) {
              alert(`🎉 Parabéns! Você foi aprovado no quiz com ${Math.round(score)}%! Sua leitura foi validada com 100%.`)
              router.refresh()
            }
          }}
        />
      )}
    </div>
  )
}
