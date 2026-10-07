'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  X, BookOpen, Loader2, Trophy, Clock, CheckCircle2, 
  FileQuestion, BookmarkCheck, Search, ChevronRight, BookMarked
} from 'lucide-react'
import Image from 'next/image'

interface AlunoReadingModalProps {
  isOpen: boolean
  onClose: () => void
  student: {
    id: string
    full_name: string
    enrollment_code?: string
    classes?: { name?: string; schools?: { name?: string } } | any
    class_id?: string
  } | null
}

export default function AlunoReadingModal({ isOpen, onClose, student }: AlunoReadingModalProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [readings, setReadings] = useState<any[]>([])
  const [searchFilter, setSearchFilter] = useState('')

  useEffect(() => {
    if (isOpen && student?.id) {
      fetchStudentReadings(student.id)
    } else {
      setReadings([])
      setSearchFilter('')
    }
  }, [isOpen, student?.id])

  const fetchStudentReadings = async (studentId: string) => {
    setLoading(true)
    try {
      // 1. Buscar registros de progresso de leitura
      const { data: progressData, error: progressErr } = await supabase
        .from('reading_progress')
        .select(`
          id,
          current_page,
          total_pages,
          last_read_at,
          completed,
          book_id,
          books (
            id,
            title,
            author,
            cover_url,
            genre
          )
        `)
        .eq('student_id', studentId)
        .order('last_read_at', { ascending: false })

      if (progressErr) {
        console.error('Erro ao buscar progresso:', progressErr)
      }

      // 2. Buscar tentativas de quiz para este aluno
      const { data: quizData } = await supabase
        .from('quiz_attempts')
        .select('book_id, passed, score')
        .eq('student_id', studentId)

      const quizMap = new Map<string, any>()
      if (quizData) {
        quizData.forEach((q: any) => {
          if (!quizMap.has(q.book_id) || q.passed) {
            quizMap.set(q.book_id, q)
          }
        })
      }

      const combined = (progressData || []).map((p: any) => {
        const quiz = quizMap.get(p.book_id)
        const isQuizPassed = !!quiz?.passed
        const isCompleted = p.completed || isQuizPassed
        const hasPendingQuiz = !isCompleted && p.current_page >= p.total_pages

        let percent = 0
        if (isCompleted) {
          percent = 100
        } else if (hasPendingQuiz) {
          percent = 95
        } else if (p.current_page > 0) {
          percent = Math.min(90, Math.max(1, Math.round((p.current_page / (p.total_pages || 1)) * 90)))
        }

        return {
          ...p,
          isCompleted,
          hasPendingQuiz,
          percent,
          quizScore: quiz?.score,
        }
      })

      setReadings(combined)
    } catch (err) {
      console.error('Erro ao carregar leituras do aluno:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !student) return null

  const formatLastRead = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    if (isToday) return `Hoje às ${time}`

    const yesterday = new Date()
    yesterday.setDate(now.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return `Ontem às ${time}`

    return `${d.toLocaleDateString('pt-BR')} às ${time}`
  }

  const filteredReadings = readings.filter((r) => {
    const title = r.books?.title?.toLowerCase() || ''
    const author = r.books?.author?.toLowerCase() || ''
    const q = searchFilter.toLowerCase()
    return title.includes(q) || author.includes(q)
  })

  // Métricas do aluno
  const totalPagesRead = readings.reduce((acc, curr) => acc + (curr.current_page || 0), 0)
  const completedBooksCount = readings.filter((r) => r.isCompleted).length
  const readingInProgressCount = readings.filter((r) => !r.isCompleted).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="p-6 bg-gradient-to-r from-indigo-900/10 via-indigo-600/5 to-transparent dark:from-indigo-950/40 dark:via-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              {student.full_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {student.full_name}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                  Aluno
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {student.enrollment_code && (
                  <span>
                    Matrícula: <strong className="font-mono text-slate-700 dark:text-slate-300">{student.enrollment_code}</strong>
                  </span>
                )}
                {student.classes?.name && (
                  <span>
                    Turma: <strong className="text-slate-700 dark:text-slate-300">{student.classes.name}</strong>
                  </span>
                )}
                {student.classes?.schools?.name && (
                  <span>
                    Escola: <strong className="text-slate-700 dark:text-slate-300">{student.classes.schools.name}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Métricas Rápidas */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-850/50 border-b border-slate-200 dark:border-slate-800 text-center py-3">
          <div>
            <div className="text-xs text-slate-400 font-medium">Em Leitura</div>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{readingInProgressCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Livros Concluídos</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{completedBooksCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Páginas Percorridas</div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{totalPagesRead}</div>
          </div>
        </div>

        {/* Filtro de Busca */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por livro ou autor..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium ml-3">
            {filteredReadings.length} {filteredReadings.length === 1 ? 'livro registrado' : 'livros registrados'}
          </span>
        </div>

        {/* Lista de Leituras com Identificação da Página */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <Loader2 className="animate-spin text-indigo-500" size={36} />
              <p className="text-sm">Carregando leituras do aluno...</p>
            </div>
          ) : filteredReadings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <BookOpen size={30} />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {searchFilter ? 'Nenhum livro corresponde à busca.' : 'Este aluno ainda não começou a ler nenhum livro.'}
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                Assim que o aluno abrir um livro na estante digital, o progresso e a página atual serão atualizados aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReadings.map((item) => {
                const book = item.books || {}
                const currentPage = item.current_page || 1
                const totalPages = item.total_pages || 1
                const percent = Math.min(100, Math.round((currentPage / totalPages) * 100))

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-indigo-300 dark:hover:border-slate-700 transition-all shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    {/* Capa e Informações do Livro */}
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="relative w-14 h-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 shadow-sm border border-slate-200 dark:border-slate-700">
                        {book.cover_url ? (
                          <Image
                            src={book.cover_url}
                            alt={book.title || 'Capa'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full text-slate-400">
                            <BookOpen size={20} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400">
                            {book.genre || 'Literatura'}
                          </span>
                          {item.isCompleted ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/50">
                              <CheckCircle2 size={11} />
                              <span>100% Concluído</span>
                            </span>
                          ) : item.hasPendingQuiz ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-700">
                              <FileQuestion size={11} />
                              <span>Leu tudo • Quiz Pendente</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/50">
                              <BookmarkCheck size={11} />
                              <span>Em Leitura</span>
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate mt-1">
                          {book.title || 'Livro sem título'}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {book.author || 'Autor desconhecido'}
                        </p>

                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-2">
                          <Clock size={12} />
                          <span>Última leitura: {formatLastRead(item.last_read_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* DESTAQUE PRINCIPAL: EM QUAL PÁGINA O ALUNO ESTÁ */}
                    <div className="w-full sm:w-56 shrink-0 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Página Atual:
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                            Pág. {currentPage}
                          </span>
                          <span className="text-xs text-slate-400"> de {totalPages}</span>
                        </div>
                      </div>

                      {/* Barra de Progresso Visual */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            item.isCompleted
                              ? 'bg-emerald-500'
                              : item.hasPendingQuiz
                              ? 'bg-amber-500'
                              : 'bg-indigo-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-400">Progresso</span>
                        <span className={item.isCompleted ? 'text-emerald-500' : 'text-indigo-500'}>
                          {percent}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
