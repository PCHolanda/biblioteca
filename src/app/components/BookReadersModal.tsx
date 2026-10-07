'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  X, BookOpen, Loader2, Trophy, Clock, CheckCircle2, 
  FileQuestion, BookmarkCheck, Search, Users, Sparkles
} from 'lucide-react'
import Image from 'next/image'

interface BookReadersModalProps {
  isOpen: boolean
  onClose: () => void
  book: {
    id: string
    title: string
    author?: string
    cover_url?: string
    genre?: string
  } | null
  classId?: string // Opcional: filtrar apenas alunos de uma turma específica (ex: painel do professor)
}

export default function BookReadersModal({ isOpen, onClose, book, classId }: BookReadersModalProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [readers, setReaders] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'reading' | 'completed' | 'quiz_pending'>('all')

  useEffect(() => {
    if (isOpen && book?.id) {
      fetchBookReaders(book.id)
    } else {
      setReaders([])
      setSearchTerm('')
      setStatusFilter('all')
    }
  }, [isOpen, book?.id, classId])

  const fetchBookReaders = async (bookId: string) => {
    setLoading(true)
    try {
      let query = supabase
        .from('reading_progress')
        .select(`
          id,
          current_page,
          total_pages,
          last_read_at,
          completed,
          student_id,
          students!inner (
            id,
            full_name,
            enrollment_code,
            class_id,
            classes (
              id,
              name,
              school_id,
              schools (
                id,
                name
              )
            )
          )
        `)
        .eq('book_id', bookId)
        .order('last_read_at', { ascending: false })

      if (classId) {
        query = query.eq('students.class_id', classId)
      }

      const { data: progressData, error } = await query

      if (error) {
        console.error('Erro ao buscar leitores do livro:', error)
      }

      // Buscar tentativas de quiz para este livro
      const { data: quizData } = await supabase
        .from('quiz_attempts')
        .select('student_id, passed, score')
        .eq('book_id', bookId)

      const quizMap = new Map<string, any>()
      if (quizData) {
        quizData.forEach((q: any) => {
          if (!quizMap.has(q.student_id) || q.passed) {
            quizMap.set(q.student_id, q)
          }
        })
      }

      const combined = (progressData || []).map((p: any) => {
        const student = p.students || {}
        const quiz = quizMap.get(p.student_id)
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
          student,
          isCompleted,
          hasPendingQuiz,
          percent,
          quizScore: quiz?.score,
        }
      })

      setReaders(combined)
    } catch (err) {
      console.error('Erro ao carregar leitores do livro:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !book) return null

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

  const filteredReaders = readers.filter((r) => {
    const studentName = r.student?.full_name?.toLowerCase() || ''
    const matricula = r.student?.enrollment_code?.toLowerCase() || ''
    const q = searchTerm.toLowerCase()
    const matchesSearch = studentName.includes(q) || matricula.includes(q)

    if (!matchesSearch) return false

    if (statusFilter === 'completed') return r.isCompleted
    if (statusFilter === 'quiz_pending') return r.hasPendingQuiz
    if (statusFilter === 'reading') return !r.isCompleted && !r.hasPendingQuiz

    return true
  })

  // Métricas
  const totalReadersCount = readers.length
  const completedCount = readers.filter((r) => r.isCompleted).length
  const readingCount = readers.filter((r) => !r.isCompleted).length
  const avgPage = readers.length > 0
    ? Math.round(readers.reduce((acc, curr) => acc + (curr.current_page || 0), 0) / readers.length)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Livro */}
        <div className="p-6 bg-gradient-to-r from-indigo-900/10 via-indigo-600/5 to-transparent dark:from-indigo-950/40 dark:via-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
          <div className="flex items-center space-x-4 min-w-0 flex-1">
            <div className="relative w-14 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 shadow-md border border-slate-200 dark:border-slate-700">
              {book.cover_url ? (
                <Image
                  src={book.cover_url}
                  alt={book.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-slate-400">
                  <BookOpen size={24} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                Acompanhamento por Livro
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate mt-1">
                {book.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {book.author ? `Por ${book.author}` : 'Autor não informado'}
              </p>
              {classId && (
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                  Exibindo alunos da sua turma
                </p>
              )}
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

        {/* Barra de Métricas */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-850/50 border-b border-slate-200 dark:border-slate-800 text-center py-3">
          <div>
            <div className="text-xs text-slate-400 font-medium">Alunos Leitores</div>
            <div className="text-lg font-bold text-slate-800 dark:text-white">{totalReadersCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Lendo Atualmente</div>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{readingCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Concluíram</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Média de Páginas</div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">Pág. {avgPage}</div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar aluno ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
            />
          </div>

          <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todos ({readers.length})
            </button>
            <button
              onClick={() => setStatusFilter('reading')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'reading'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Lendo ({readingCount})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Concluídos ({completedCount})
            </button>
          </div>
        </div>

        {/* Lista de Alunos e Páginas do Livro */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <Loader2 className="animate-spin text-indigo-500" size={36} />
              <p className="text-sm">Carregando alunos que leram este livro...</p>
            </div>
          ) : filteredReaders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <Users size={30} />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Nenhum aluno encontrado com esses filtros.' 
                  : 'Nenhum aluno iniciou a leitura deste livro ainda.'}
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                Assim que os alunos começarem a ler este livro, a página exata de cada um aparecerá aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReaders.map((item) => {
                const student = item.student || {}
                const currentPage = item.current_page || 1
                const totalPages = item.total_pages || 1
                const percent = Math.min(100, Math.round((currentPage / totalPages) * 100))

                return (
                  <div
                    key={item.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    {/* Aluno e Turma */}
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-sm flex items-center justify-center shrink-0">
                        {student.full_name?.charAt(0) || 'A'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {student.full_name || 'Aluno'}
                          </h4>
                          {item.isCompleted ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/50">
                              <CheckCircle2 size={11} />
                              <span>100% Lido</span>
                            </span>
                          ) : item.hasPendingQuiz ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-700">
                              <FileQuestion size={11} />
                              <span>Aguardando Quiz</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/50">
                              <BookmarkCheck size={11} />
                              <span>Em Leitura</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {student.enrollment_code && (
                            <span>Matrícula: <strong className="font-mono text-slate-700 dark:text-slate-300">{student.enrollment_code}</strong></span>
                          )}
                          {student.classes?.name && (
                            <span>Turma: <strong className="text-slate-700 dark:text-slate-300">{student.classes.name}</strong></span>
                          )}
                          {student.classes?.schools?.name && (
                            <span>• {student.classes.schools.name}</span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-1">
                          <Clock size={11} />
                          <span>Última atividade: {formatLastRead(item.last_read_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* IDENTIFICAÇÃO DA PÁGINA DO ALUNO NESTE LIVRO */}
                    <div className="w-full sm:w-60 shrink-0 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Página Parada:
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                            Página {currentPage}
                          </span>
                          <span className="text-xs text-slate-400"> / {totalPages}</span>
                        </div>
                      </div>

                      {/* Barra de Progresso */}
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
                        <span className="text-slate-400">Avanço</span>
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
