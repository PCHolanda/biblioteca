'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  BookOpen, Users, Search, Filter, Loader2, Trophy, Clock, 
  CheckCircle2, FileQuestion, BookmarkCheck, ArrowUpDown, Eye,
  School, GraduationCap, Sparkles
} from 'lucide-react'
import Image from 'next/image'
import AlunoReadingModal from '@/app/components/AlunoReadingModal'
import BookReadersModal from '@/app/components/BookReadersModal'

export default function AdminLeiturasPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [readings, setReadings] = useState<any[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [turmas, setTurmas] = useState<any[]>([])
  const [booksList, setBooksList] = useState<any[]>([])

  // Filtros
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all')
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all')
  const [selectedBookId, setSelectedBookId] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Modais
  const [selectedAlunoForModal, setSelectedAlunoForModal] = useState<any | null>(null)
  const [isAlunoModalOpen, setIsAlunoModalOpen] = useState(false)
  const [selectedBookForModal, setSelectedBookForModal] = useState<any | null>(null)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedSchoolId && selectedSchoolId !== 'all') {
      fetchTurmasForSchool(selectedSchoolId)
    } else {
      fetchAllTurmas()
    }
  }, [selectedSchoolId])

  const fetchInitialData = async () => {
    setLoading(true)
    try {
      // 1. Obter usuário e perfil
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single()

      const clientId = profile?.client_id

      // 2. Buscar escolas do cliente
      let schoolQuery = supabase.from('schools').select('id, name').order('name')
      if (clientId) {
        schoolQuery = schoolQuery.eq('client_id', clientId)
      }
      const { data: schoolsData } = await schoolQuery
      if (schoolsData) setSchools(schoolsData)

      // 3. Buscar turmas
      await fetchAllTurmas()

      // 4. Buscar livros para o filtro
      const { data: booksData } = await supabase
        .from('books')
        .select('id, title')
        .order('title')
      if (booksData) setBooksList(booksData)

      // 5. Carregar todas as leituras
      await fetchReadings()
    } catch (err) {
      console.error('Erro ao carregar dados iniciais de leituras:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllTurmas = async () => {
    const { data: turmasData } = await supabase
      .from('classes')
      .select('id, name, school_id')
      .order('name')
    if (turmasData) setTurmas(turmasData)
  }

  const fetchTurmasForSchool = async (schoolId: string) => {
    const { data: turmasData } = await supabase
      .from('classes')
      .select('id, name, school_id')
      .eq('school_id', schoolId)
      .order('name')
    if (turmasData) setTurmas(turmasData)
  }

  const fetchReadings = async () => {
    try {
      // Buscar reading_progress com relações
      const { data: progressData, error: progressErr } = await supabase
        .from('reading_progress')
        .select(`
          id,
          current_page,
          total_pages,
          last_read_at,
          completed,
          student_id,
          book_id,
          books (
            id,
            title,
            author,
            cover_url,
            genre
          ),
          students (
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
        .order('last_read_at', { ascending: false })

      if (progressErr) {
        console.error('Erro ao buscar reading_progress:', progressErr)
        return
      }

      // Buscar tentativas de quiz aprovadas para complementar o status
      const { data: quizData } = await supabase
        .from('quiz_attempts')
        .select('student_id, book_id, passed, score')

      const quizMap = new Map<string, any>()
      if (quizData) {
        quizData.forEach((q: any) => {
          const key = `${q.student_id}_${q.book_id}`
          if (!quizMap.has(key) || q.passed) {
            quizMap.set(key, q)
          }
        })
      }

      const formatted = (progressData || []).map((p: any) => {
        const quiz = quizMap.get(`${p.student_id}_${p.book_id}`)
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

      setReadings(formatted)
    } catch (err) {
      console.error('Erro ao atualizar leituras:', err)
    }
  }

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

  // Filtragem dos registros
  const filteredReadings = readings.filter((r) => {
    const student = r.students || {}
    const book = r.books || {}
    const studentClass = student.classes || {}

    // Filtro Escola
    if (selectedSchoolId !== 'all') {
      if (studentClass.school_id !== selectedSchoolId) return false
    }

    // Filtro Turma
    if (selectedTurmaId !== 'all') {
      if (student.class_id !== selectedTurmaId) return false
    }

    // Filtro Livro
    if (selectedBookId !== 'all') {
      if (r.book_id !== selectedBookId) return false
    }

    // Filtro Status
    if (selectedStatus === 'reading' && (r.isCompleted || r.hasPendingQuiz)) return false
    if (selectedStatus === 'completed' && !r.isCompleted) return false
    if (selectedStatus === 'quiz_pending' && !r.hasPendingQuiz) return false

    // Busca textual
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      const studentName = student.full_name?.toLowerCase() || ''
      const matricula = student.enrollment_code?.toLowerCase() || ''
      const bookTitle = book.title?.toLowerCase() || ''
      const bookAuthor = book.author?.toLowerCase() || ''
      if (!studentName.includes(q) && !matricula.includes(q) && !bookTitle.includes(q) && !bookAuthor.includes(q)) {
        return false
      }
    }

    return true
  })

  // Métricas agregadas
  const totalPagesRead = readings.reduce((acc, curr) => acc + (curr.current_page || 0), 0)
  const completedCount = readings.filter((r) => r.isCompleted).length
  const readingInProgressCount = readings.filter((r) => !r.isCompleted).length
  const uniqueStudentsCount = new Set(readings.map((r) => r.student_id)).size

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center space-x-3">
          <BookmarkCheck className="text-indigo-400" size={32} />
          <span>Acompanhamento de Leituras</span>
        </h1>
        <p className="text-slate-400 mt-2 text-sm">
          Monitore em tempo real em qual página cada aluno está de cada livro, a evolução da leitura e a validação por quiz.
        </p>
      </div>

      {/* Cards de Métricas Globais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{uniqueStudentsCount}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Alunos Leitores</div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{readingInProgressCount}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Leituras em Andamento</div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl">
            <Trophy size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{completedCount}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Livros Concluídos</div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-amber-600/20 text-amber-400 rounded-xl">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{totalPagesRead}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Páginas Lidas no Total</div>
          </div>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center space-x-2 text-white font-bold text-sm">
          <Filter size={16} className="text-indigo-400" />
          <span>Filtros de Acompanhamento</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filtro Escola */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Escola</label>
            <select
              value={selectedSchoolId}
              onChange={(e) => {
                setSelectedSchoolId(e.target.value)
                setSelectedTurmaId('all')
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="all">Todas as Escolas</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Filtro Turma */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Turma</label>
            <select
              value={selectedTurmaId}
              onChange={(e) => setSelectedTurmaId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="all">Todas as Turmas</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Filtro Livro */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Livro Específico</label>
            <select
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 truncate"
            >
              <option value="all">Todos os Livros</option>
              {booksList.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>

          {/* Filtro Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Status da Leitura</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="all">Todos os Status</option>
              <option value="reading">Em Leitura</option>
              <option value="completed">100% Concluído</option>
              <option value="quiz_pending">Aguardando Quiz</option>
            </select>
          </div>
        </div>

        {/* Busca por texto */}
        <div className="relative pt-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome do aluno, matrícula, livro ou autor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Tabela de Acompanhamento */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Registros de Leitura ({filteredReadings.length})
          </span>
          <button
            onClick={fetchReadings}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
          >
            Atualizar Dados
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
            <Loader2 className="animate-spin text-indigo-500" size={36} />
            <p className="text-sm">Carregando acompanhamento de leituras...</p>
          </div>
        ) : filteredReadings.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-750 mx-auto flex items-center justify-center text-slate-500">
              <BookOpen size={30} />
            </div>
            <p className="text-sm font-semibold text-slate-300">Nenhum registro de leitura encontrado.</p>
            <p className="text-xs text-slate-500">Ajuste os filtros acima ou aguarde os alunos abrirem livros na estante.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 uppercase text-[10px] tracking-wider text-slate-400 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-4">Aluno / Matrícula</th>
                  <th className="p-4">Turma & Escola</th>
                  <th className="p-4">Livro</th>
                  <th className="p-4">Página Atual / Total</th>
                  <th className="p-4">Progresso</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Última Leitura</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredReadings.map((item) => {
                  const student = item.students || {}
                  const book = item.books || {}
                  const studentClass = student.classes || {}
                  const currentPage = item.current_page || 1
                  const totalPages = item.total_pages || 1
                  const percent = Math.min(100, Math.round((currentPage / totalPages) * 100))

                  return (
                    <tr key={item.id} className="hover:bg-slate-750/40 transition-colors">
                      {/* Aluno */}
                      <td className="p-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-800">
                            {student.full_name?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <div className="font-bold text-white hover:text-indigo-400 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedAlunoForModal(student)
                                setIsAlunoModalOpen(true)
                              }}
                            >
                              {student.full_name || 'Aluno'}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              Matrícula: {student.enrollment_code || '-'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Turma & Escola */}
                      <td className="p-4">
                        <div className="font-medium text-slate-200">{studentClass.name || 'Sem turma'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {studentClass.schools?.name || '-'}
                        </div>
                      </td>

                      {/* Livro */}
                      <td className="p-4">
                        <div className="flex items-center space-x-2.5 max-w-[200px]">
                          <div className="relative w-8 h-11 rounded bg-slate-700 overflow-hidden shrink-0 shadow">
                            {book.cover_url ? (
                              <Image src={book.cover_url} alt={book.title || 'Capa'} fill className="object-cover" />
                            ) : (
                              <div className="flex items-center justify-center w-full h-full text-slate-500">
                                <BookOpen size={14} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div 
                              className="font-bold text-white hover:text-indigo-400 cursor-pointer truncate transition-colors"
                              onClick={() => {
                                setSelectedBookForModal(book)
                                setIsBookModalOpen(true)
                              }}
                              title={book.title}
                            >
                              {book.title || 'Livro'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{book.author || 'Autor'}</div>
                          </div>
                        </div>
                      </td>

                      {/* DESTAQUE PRINCIPAL: PÁGINA ATUAL / TOTAL */}
                      <td className="p-4 font-mono whitespace-nowrap">
                        <div className="flex items-baseline space-x-1">
                          <span className="text-sm font-extrabold text-indigo-400">
                            Pág. {currentPage}
                          </span>
                          <span className="text-xs text-slate-400">
                            / {totalPages}
                          </span>
                        </div>
                      </td>

                      {/* Progresso com Barra */}
                      <td className="p-4 w-36">
                        <div className="space-y-1">
                          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                item.isCompleted
                                  ? 'bg-emerald-500'
                                  : item.hasPendingQuiz
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 flex justify-between">
                            <span>Avanço</span>
                            <span className={item.isCompleted ? 'text-emerald-400' : 'text-indigo-400'}>
                              {percent}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 whitespace-nowrap">
                        {item.isCompleted ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-800">
                            <CheckCircle2 size={11} />
                            <span>100% Lido</span>
                          </span>
                        ) : item.hasPendingQuiz ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-300 bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-800">
                            <FileQuestion size={11} />
                            <span>Quiz Pendente</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-300 bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-800">
                            <BookmarkCheck size={11} />
                            <span>Em Leitura</span>
                          </span>
                        )}
                      </td>

                      {/* Última Leitura */}
                      <td className="p-4 text-[11px] text-slate-400 whitespace-nowrap">
                        {formatLastRead(item.last_read_at)}
                      </td>

                      {/* Ações */}
                      <td className="p-4 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => {
                            setSelectedAlunoForModal(student)
                            setIsAlunoModalOpen(true)
                          }}
                          className="p-1.5 bg-slate-700 hover:bg-slate-650 text-indigo-400 hover:text-white rounded-lg transition-colors inline-flex items-center space-x-1"
                          title="Ver todas as leituras deste aluno"
                        >
                          <Users size={13} />
                          <span className="text-[10px] font-bold">Aluno</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedBookForModal(book)
                            setIsBookModalOpen(true)
                          }}
                          className="p-1.5 bg-slate-700 hover:bg-slate-650 text-amber-400 hover:text-white rounded-lg transition-colors inline-flex items-center space-x-1"
                          title="Ver todos os alunos que estão lendo este livro"
                        >
                          <BookOpen size={13} />
                          <span className="text-[10px] font-bold">Livro</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais Reutilizáveis */}
      <AlunoReadingModal
        isOpen={isAlunoModalOpen}
        onClose={() => {
          setIsAlunoModalOpen(false)
          setSelectedAlunoForModal(null)
        }}
        student={selectedAlunoForModal}
      />

      <BookReadersModal
        isOpen={isBookModalOpen}
        onClose={() => {
          setIsBookModalOpen(false)
          setSelectedBookForModal(null)
        }}
        book={selectedBookForModal}
      />
    </div>
  )
}
