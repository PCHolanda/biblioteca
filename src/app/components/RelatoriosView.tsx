'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  BarChart3, BookOpen, Users, Trophy, Download, Printer, 
  Search, Filter, ChevronDown, ChevronUp, CheckCircle2, 
  XCircle, Clock, FileQuestion, Award, Sparkles, Loader2,
  GraduationCap, School, Check, ArrowUpDown
} from 'lucide-react'
import Image from 'next/image'

interface RelatoriosViewProps {
  isTeacher?: boolean
  initialClassId?: string
  initialSchoolId?: string
}

export default function RelatoriosView({ 
  isTeacher = false, 
  initialClassId, 
  initialSchoolId 
}: RelatoriosViewProps) {
  const supabase = createClient()

  // Aba selecionada: 'por_livro' ou 'por_aluno'
  const [reportTab, setReportTab] = useState<'por_livro' | 'por_aluno'>('por_livro')

  // Estados de Dados
  const [loading, setLoading] = useState(true)
  const [schools, setSchools] = useState<any[]>([])
  const [turmas, setTurmas] = useState<any[]>([])
  const [booksList, setBooksList] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [readingProgress, setReadingProgress] = useState<any[]>([])
  const [quizAttempts, setQuizAttempts] = useState<any[]>([])

  // Filtros
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(initialSchoolId || 'all')
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>(initialClassId || 'all')
  const [selectedBookId, setSelectedBookId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [scoreFilter, setScoreFilter] = useState<'all' | 'approved' | 'failed' | 'no_quiz'>('all')

  // Alunos expandidos no relatório por aluno
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (!isTeacher && selectedSchoolId && selectedSchoolId !== 'all') {
      fetchTurmasForSchool(selectedSchoolId)
    } else if (!isTeacher) {
      fetchAllTurmas()
    }
  }, [selectedSchoolId, isTeacher])

  useEffect(() => {
    if (turmas.length > 0 && !selectedTurmaId && !initialClassId) {
      setSelectedTurmaId('all')
    }
  }, [turmas])

  const fetchInitialData = async () => {
    setLoading(true)
    try {
      // 1. Obter perfil do usuário
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id, role')
        .eq('id', user.id)
        .single()

      const clientId = profile?.client_id

      // 2. Se não for professor, buscar escolas
      if (!isTeacher) {
        let schoolQuery = supabase.from('schools').select('id, name').order('name')
        if (clientId) schoolQuery = schoolQuery.eq('client_id', clientId)
        const { data: schoolsData } = await schoolQuery
        if (schoolsData) setSchools(schoolsData)
        await fetchAllTurmas()
      }

      // 3. Buscar todos os livros cadastrados
      const { data: booksData } = await supabase
        .from('books')
        .select('id, title, author, cover_url, genre')
        .order('title')
      if (booksData) {
        setBooksList(booksData)
        if (booksData.length > 0 && !selectedBookId) {
          setSelectedBookId(booksData[0].id)
        }
      }

      // 4. Buscar alunos
      let studentsQuery = supabase
        .from('students')
        .select(`
          id,
          full_name,
          enrollment_code,
          birth_date,
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
        `)
        .order('full_name')

      if (isTeacher && initialClassId) {
        studentsQuery = studentsQuery.eq('class_id', initialClassId)
      }

      const { data: studentsData } = await studentsQuery
      if (studentsData) setStudents(studentsData)

      // 5. Buscar todo o progresso de leitura
      const { data: progressData } = await supabase
        .from('reading_progress')
        .select(`
          id,
          student_id,
          book_id,
          current_page,
          total_pages,
          last_read_at,
          completed,
          books (
            id,
            title,
            author,
            cover_url
          )
        `)

      if (progressData) setReadingProgress(progressData)

      // 6. Buscar todas as tentativas de quiz
      const { data: quizData } = await supabase
        .from('quiz_attempts')
        .select(`
          id,
          student_id,
          book_id,
          score,
          total_questions,
          correct_answers,
          passed,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (quizData) setQuizAttempts(quizData)

    } catch (err) {
      console.error('Erro ao carregar dados do relatório:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllTurmas = async () => {
    const { data } = await supabase.from('classes').select('id, name, school_id').order('name')
    if (data) setTurmas(data)
  }

  const fetchTurmasForSchool = async (schoolId: string) => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, school_id')
      .eq('school_id', schoolId)
      .order('name')
    if (data) setTurmas(data)
  }

  // Filtragem dos alunos de acordo com escola/turma selecionada
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (isTeacher && initialClassId) {
        return s.class_id === initialClassId
      }
      if (selectedSchoolId !== 'all') {
        if (s.classes?.school_id !== selectedSchoolId) return false
      }
      if (selectedTurmaId !== 'all') {
        if (s.class_id !== selectedTurmaId) return false
      }
      return true
    })
  }, [students, isTeacher, initialClassId, selectedSchoolId, selectedTurmaId])

  const filteredStudentIds = useMemo(() => {
    return new Set(filteredStudents.map((s) => s.id))
  }, [filteredStudents])

  // Melhor nota de quiz por aluno e livro
  const bestQuizByStudentAndBook = useMemo(() => {
    const map = new Map<string, any>()
    quizAttempts.forEach((q) => {
      const key = `${q.student_id}_${q.book_id}`
      const existing = map.get(key)
      if (!existing || (q.score > existing.score) || (q.passed && !existing.passed)) {
        map.set(key, q)
      }
    })
    return map
  }, [quizAttempts])

  // ==========================================
  // RELATÓRIO 1: POR LIVRO (Quem leu e a nota)
  // ==========================================
  const selectedBook = useMemo(() => {
    return booksList.find((b) => b.id === selectedBookId) || null
  }, [booksList, selectedBookId])

  const bookReportData = useMemo(() => {
    if (!selectedBookId) return []

    // Todos os alunos elegíveis no filtro atual
    return filteredStudents.map((student) => {
      const progress = readingProgress.find(
        (p) => p.student_id === student.id && p.book_id === selectedBookId
      )
      const bestQuiz = bestQuizByStudentAndBook.get(`${student.id}_${selectedBookId}`)

      const hasReadAnything = !!progress
      const currentPage = progress?.current_page || 0
      const totalPages = progress?.total_pages || 1
      const isCompletedReading = progress?.completed || (currentPage >= totalPages && totalPages > 0)
      const percentReading = totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0

      const hasAttemptedQuiz = !!bestQuiz
      const quizScore = bestQuiz?.score ?? null
      const quizPassed = bestQuiz?.passed ?? false
      const correctAnswers = bestQuiz?.correct_answers ?? null
      const totalQuestions = bestQuiz?.total_questions ?? null
      const quizDate = bestQuiz?.created_at || null

      let statusLabel = 'Não Iniciou'
      let statusType: 'not_started' | 'reading' | 'pending_quiz' | 'passed' | 'failed' = 'not_started'

      if (quizPassed) {
        statusLabel = 'Aprovado no Quiz'
        statusType = 'passed'
      } else if (hasAttemptedQuiz) {
        statusLabel = 'Reprovado no Quiz'
        statusType = 'failed'
      } else if (isCompletedReading) {
        statusLabel = 'Leu Tudo (Aguardando Quiz)'
        statusType = 'pending_quiz'
      } else if (hasReadAnything && currentPage > 0) {
        statusLabel = 'Em Leitura'
        statusType = 'reading'
      }

      return {
        student,
        hasReadAnything,
        currentPage,
        totalPages,
        percentReading,
        isCompletedReading,
        lastReadAt: progress?.last_read_at || null,
        hasAttemptedQuiz,
        quizScore,
        quizPassed,
        correctAnswers,
        totalQuestions,
        quizDate,
        statusLabel,
        statusType
      }
    }).filter((item) => {
      // Filtro de busca por nome ou matrícula
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const name = item.student.full_name?.toLowerCase() || ''
        const code = item.student.enrollment_code?.toLowerCase() || ''
        if (!name.includes(q) && !code.includes(q)) return false
      }

      // Filtro por nota / status de quiz
      if (scoreFilter === 'approved') return item.quizPassed
      if (scoreFilter === 'failed') return item.hasAttemptedQuiz && !item.quizPassed
      if (scoreFilter === 'no_quiz') return !item.hasAttemptedQuiz && item.hasReadAnything

      return true
    })
  }, [selectedBookId, filteredStudents, readingProgress, bestQuizByStudentAndBook, searchTerm, scoreFilter])

  // Métricas do Livro Selecionado
  const bookMetrics = useMemo(() => {
    const started = bookReportData.filter((r) => r.hasReadAnything)
    const completed = bookReportData.filter((r) => r.isCompletedReading || r.quizPassed)
    const withQuiz = bookReportData.filter((r) => r.hasAttemptedQuiz && r.quizScore !== null)
    const passed = bookReportData.filter((r) => r.quizPassed)

    const avgScore = withQuiz.length > 0 
      ? Math.round(withQuiz.reduce((acc, curr) => acc + (curr.quizScore || 0), 0) / withQuiz.length) 
      : 0

    const approvalRate = withQuiz.length > 0 
      ? Math.round((passed.length / withQuiz.length) * 100) 
      : 0

    return {
      totalStudents: filteredStudents.length,
      startedCount: started.length,
      completedCount: completed.length,
      quizCount: withQuiz.length,
      avgScore,
      approvalRate
    }
  }, [bookReportData, filteredStudents])

  // ==========================================
  // RELATÓRIO 2: POR ALUNO (Livros lidos e nota média)
  // ==========================================
  const studentReportData = useMemo(() => {
    return filteredStudents.map((student) => {
      // Todos os progressos de leitura deste aluno
      const studentProgress = readingProgress.filter((p) => p.student_id === student.id)
      
      // Todas as melhores tentativas de quiz deste aluno
      const studentQuizzes: any[] = []
      booksList.forEach((book) => {
        const best = bestQuizByStudentAndBook.get(`${student.id}_${book.id}`)
        if (best) {
          studentQuizzes.push({ ...best, bookTitle: book.title, bookAuthor: book.author })
        }
      })

      // Livros concluídos: onde completed é true ou passou no quiz
      const completedBooks = studentProgress.filter((p) => {
        const best = bestQuizByStudentAndBook.get(`${student.id}_${p.book_id}`)
        return p.completed || best?.passed
      })

      const readingBooks = studentProgress.filter((p) => {
        const best = bestQuizByStudentAndBook.get(`${student.id}_${p.book_id}`)
        return !p.completed && !best?.passed && p.current_page > 0
      })

      const totalPagesRead = studentProgress.reduce((acc, curr) => acc + (curr.current_page || 0), 0)

      // Cálculo da Nota Média Geral
      const quizScores = studentQuizzes.map((q) => q.score).filter((s) => typeof s === 'number')
      const avgScore = quizScores.length > 0
        ? Math.round(quizScores.reduce((acc, curr) => acc + curr, 0) / quizScores.length)
        : null

      const quizzesPassedCount = studentQuizzes.filter((q) => q.passed).length

      // Detalhamento dos livros lidos por este aluno
      const detailedBooks = studentProgress.map((p) => {
        const best = bestQuizByStudentAndBook.get(`${student.id}_${p.book_id}`)
        const isCompleted = p.completed || best?.passed
        return {
          bookId: p.book_id,
          title: p.books?.title || 'Livro',
          author: p.books?.author || 'Autor',
          coverUrl: p.books?.cover_url || null,
          currentPage: p.current_page,
          totalPages: p.total_pages,
          isCompleted,
          quizScore: best?.score ?? null,
          quizPassed: best?.passed ?? false,
          correctAnswers: best?.correct_answers ?? null,
          totalQuestions: best?.total_questions ?? null,
          lastReadAt: p.last_read_at
        }
      })

      return {
        student,
        completedBooksCount: completedBooks.length,
        readingBooksCount: readingBooks.length,
        totalPagesRead,
        quizzesAttemptedCount: studentQuizzes.length,
        quizzesPassedCount,
        avgScore,
        detailedBooks
      }
    }).filter((item) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const name = item.student.full_name?.toLowerCase() || ''
        const code = item.student.enrollment_code?.toLowerCase() || ''
        if (!name.includes(q) && !code.includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      // Ordena por quantidade de livros lidos (decrescente) e depois por nota média
      if (b.completedBooksCount !== a.completedBooksCount) {
        return b.completedBooksCount - a.completedBooksCount
      }
      return (b.avgScore || 0) - (a.avgScore || 0)
    })
  }, [filteredStudents, readingProgress, bestQuizByStudentAndBook, booksList, searchTerm])

  // Métricas do Relatório de Alunos
  const studentMetrics = useMemo(() => {
    const totalStudents = studentReportData.length
    const totalBooksCompleted = studentReportData.reduce((acc, curr) => acc + curr.completedBooksCount, 0)
    const avgBooksPerStudent = totalStudents > 0 ? (totalBooksCompleted / totalStudents).toFixed(1) : '0'

    const studentsWithScore = studentReportData.filter((s) => s.avgScore !== null)
    const overallAvgScore = studentsWithScore.length > 0
      ? Math.round(studentsWithScore.reduce((acc, curr) => acc + (curr.avgScore || 0), 0) / studentsWithScore.length)
      : 0

    const totalPagesAll = studentReportData.reduce((acc, curr) => acc + curr.totalPagesRead, 0)

    return {
      totalStudents,
      totalBooksCompleted,
      avgBooksPerStudent,
      overallAvgScore,
      totalPagesAll
    }
  }, [studentReportData])

  // ==========================================
  // FUNÇÕES DE EXPORTAÇÃO (CSV E IMPRESSÃO)
  // ==========================================

  const exportBookReportCSV = () => {
    if (!selectedBook) return

    const headers = [
      'Aluno',
      'Matrícula',
      'Turma',
      'Escola',
      'Livro',
      'Páginas Lidas',
      'Total Páginas',
      'Progresso (%)',
      'Status Leitura',
      'Nota do Quiz (%)',
      'Acertos',
      'Total Questões',
      'Resultado Quiz',
      'Data do Quiz'
    ]

    const rows = bookReportData.map((r) => [
      `"${r.student.full_name || ''}"`,
      `"${r.student.enrollment_code || ''}"`,
      `"${r.student.classes?.name || ''}"`,
      `"${r.student.classes?.schools?.name || ''}"`,
      `"${selectedBook.title}"`,
      r.currentPage,
      r.totalPages,
      `${r.percentReading}%`,
      `"${r.statusLabel}"`,
      r.quizScore !== null ? `${r.quizScore}%` : 'Sem Quiz',
      r.correctAnswers !== null ? r.correctAnswers : '-',
      r.totalQuestions !== null ? r.totalQuestions : '-',
      r.quizPassed ? 'Aprovado' : r.hasAttemptedQuiz ? 'Reprovado' : 'Pendente',
      r.quizDate ? new Date(r.quizDate).toLocaleDateString('pt-BR') : '-'
    ])

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `relatorio-livro-${selectedBook.title.toLowerCase().replace(/\s+/g, '-')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportStudentReportCSV = () => {
    const headers = [
      'Aluno',
      'Matrícula',
      'Turma',
      'Escola',
      'Livros Concluídos',
      'Livros em Leitura',
      'Total Páginas Lidas',
      'Quizzes Feitos',
      'Quizzes Aprovados',
      'Nota Média Geral (%)'
    ]

    const rows = studentReportData.map((r) => [
      `"${r.student.full_name || ''}"`,
      `"${r.student.enrollment_code || ''}"`,
      `"${r.student.classes?.name || ''}"`,
      `"${r.student.classes?.schools?.name || ''}"`,
      r.completedBooksCount,
      r.readingBooksCount,
      r.totalPagesRead,
      r.quizzesAttemptedCount,
      r.quizzesPassedCount,
      r.avgScore !== null ? `${r.avgScore}%` : 'Sem Notas'
    ])

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `relatorio-alunos-leitura-e-notas.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center space-x-3">
            <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={32} />
            <span>Relatórios de Leitura & Notas</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs sm:text-sm">
            Acompanhe o desempenho dos alunos por livro e por turma, incluindo notas dos quizzes, livros lidos e taxas de aprovação.
          </p>
        </div>

        {/* Botões de Exportação */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={reportTab === 'por_livro' ? exportBookReportCSV : exportStudentReportCSV}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
            title="Exportar dados para planilha Excel (.csv)"
          >
            <Download size={14} />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
            title="Imprimir ou Salvar como PDF"
          >
            <Printer size={14} />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Cabeçalho exclusivo para impressão */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-slate-900">Relatório Pedagógico de Leituras e Avaliações</h2>
        <p className="text-xs text-slate-500 mt-1">
          Biblioteca Digital Escolar • Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Abas Principais do Relatório */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-px print:hidden">
        <button
          onClick={() => setReportTab('por_livro')}
          className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-semibold transition-all ${
            reportTab === 'por_livro'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <BookOpen size={16} />
          <span>Relatório por Livro (Quem Leu e a Nota)</span>
        </button>

        <button
          onClick={() => setReportTab('por_aluno')}
          className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-semibold transition-all ${
            reportTab === 'por_aluno'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users size={16} />
          <span>Relatório por Aluno (Livros Lidos e Média Geral)</span>
        </button>
      </div>

      {/* Filtros de Escopo (Escola, Turma, Busca) */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3 print:hidden">
        <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-bold text-xs">
          <Filter size={14} className="text-indigo-500" />
          <span>Filtros do Relatório</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Seletor de Escola (Apenas Admin) */}
          {!isTeacher && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Escola</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => {
                  setSelectedSchoolId(e.target.value)
                  setSelectedTurmaId('all')
                }}
                className="w-full bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-650 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              >
                <option value="all">Todas as Escolas ({schools.length})</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Seletor de Turma */}
          {!isTeacher && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Turma</label>
              <select
                value={selectedTurmaId}
                onChange={(e) => setSelectedTurmaId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-650 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              >
                <option value="all">Todas as Turmas ({turmas.length})</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Se estiver no Relatório por Livro: Seletor de Livro */}
          {reportTab === 'por_livro' && (
            <div className={isTeacher ? 'sm:col-span-2' : ''}>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Livro em Análise</label>
              <select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-650 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-semibold"
              >
                {booksList.map((b) => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Se estiver no Relatório por Livro: Filtro de Status de Nota */}
          {reportTab === 'por_livro' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filtro de Desempenho</label>
              <select
                value={scoreFilter}
                onChange={(e) => setScoreFilter(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-650 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              >
                <option value="all">Todos os Alunos</option>
                <option value="approved">Aprovados no Quiz (Nota ≥ 70%)</option>
                <option value="failed">Reprovados no Quiz (Nota &lt; 70%)</option>
                <option value="no_quiz">Lendo (Sem Quiz ainda)</option>
              </select>
            </div>
          )}

          {/* Campo de Busca */}
          <div className={reportTab === 'por_aluno' ? (isTeacher ? 'sm:col-span-4' : 'sm:col-span-2') : ''}>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Busca Rápida</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome do aluno ou matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-650 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
          <Loader2 className="animate-spin text-indigo-500" size={36} />
          <p className="text-sm font-semibold">Carregando e consolidando dados do relatório...</p>
        </div>
      ) : reportTab === 'por_livro' ? (
        // ==========================================
        // CONTEÚDO DO RELATÓRIO POR LIVRO
        // ==========================================
        <div className="space-y-6">
          {/* Cartão de Destaque do Livro e Métricas */}
          {selectedBook && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="relative w-14 h-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 shadow border border-slate-200 dark:border-slate-650">
                    {selectedBook.cover_url ? (
                      <Image src={selectedBook.cover_url} alt={selectedBook.title} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-slate-400">
                        <BookOpen size={20} />
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                      {selectedBook.genre || 'Literatura'}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {selectedBook.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedBook.author ? `Por ${selectedBook.author}` : 'Autor desconhecido'}
                    </p>
                  </div>
                </div>

                {/* Métricas do Livro em Destaque */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
                  <div className="bg-slate-50 dark:bg-slate-750 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[11px] text-slate-400 font-medium">Leitores Ativos</div>
                    <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {bookMetrics.startedCount}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-750 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[11px] text-slate-400 font-medium">Leitura Concluída</div>
                    <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {bookMetrics.completedCount}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-750 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[11px] text-slate-400 font-medium">Nota Média do Quiz</div>
                    <div className={`text-lg font-extrabold mt-0.5 ${
                      bookMetrics.avgScore >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {bookMetrics.quizCount > 0 ? `${bookMetrics.avgScore}%` : '-'}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-750 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                    <div className="text-[11px] text-slate-400 font-medium">Aprovação no Quiz</div>
                    <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {bookMetrics.quizCount > 0 ? `${bookMetrics.approvalRate}%` : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabela de Alunos que leram o livro e suas notas */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                Alunos Avaliados ({bookReportData.length})
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {bookReportData.filter((r) => r.hasAttemptedQuiz).length} responderam ao quiz
              </span>
            </div>

            {bookReportData.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <BookOpen size={32} className="mx-auto text-slate-300 dark:text-slate-650" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Nenhum aluno encontrado para este livro com os filtros atuais.
                </p>
                <p className="text-xs text-slate-400">
                  Tente selecionar outro livro ou alterar os filtros de escola e turma.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-750 uppercase text-[10px] tracking-wider text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-4">Aluno / Matrícula</th>
                      <th className="p-4">Turma</th>
                      <th className="p-4">Progresso de Leitura</th>
                      <th className="p-4">Páginas</th>
                      <th className="p-4">Nota no Quiz</th>
                      <th className="p-4">Acertos</th>
                      <th className="p-4">Status & Validação</th>
                      <th className="p-4">Data da Avaliação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {bookReportData.map((row) => {
                      const student = row.student
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition-colors">
                          {/* Aluno */}
                          <td className="p-4">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                                {student.full_name?.charAt(0) || 'A'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {student.full_name}
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {student.enrollment_code}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Turma */}
                          <td className="p-4">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {student.classes?.name || 'Sem turma'}
                            </span>
                          </td>

                          {/* Progresso de Leitura */}
                          <td className="p-4 w-36">
                            <div className="space-y-1">
                              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    row.isCompletedReading ? 'bg-emerald-500' : 'bg-indigo-600'
                                  }`}
                                  style={{ width: `${row.percentReading}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-slate-400">
                                  {row.isCompletedReading ? '100% Lido' : row.hasReadAnything ? 'Lendo' : 'Não iniciou'}
                                </span>
                                <span className={row.isCompletedReading ? 'text-emerald-500' : 'text-indigo-500'}>
                                  {row.percentReading}%
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Páginas */}
                          <td className="p-4 font-mono">
                            {row.hasReadAnything ? (
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                Pág. {row.currentPage} / {row.totalPages}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* NOTA NO QUIZ */}
                          <td className="p-4">
                            {row.quizScore !== null ? (
                              <div className="flex items-center space-x-1.5">
                                <span className={`text-sm font-extrabold px-2 py-0.5 rounded-lg border font-mono ${
                                  row.quizScore >= 70
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                                }`}>
                                  {row.quizScore}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Sem nota</span>
                            )}
                          </td>

                          {/* Acertos */}
                          <td className="p-4 font-mono">
                            {row.correctAnswers !== null && row.totalQuestions !== null ? (
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {row.correctAnswers} / {row.totalQuestions}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* Status & Validação */}
                          <td className="p-4 whitespace-nowrap">
                            {row.statusType === 'passed' ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 size={11} />
                                <span>Aprovado</span>
                              </span>
                            ) : row.statusType === 'failed' ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800">
                                <XCircle size={11} />
                                <span>Reprovado</span>
                              </span>
                            ) : row.statusType === 'pending_quiz' ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800">
                                <FileQuestion size={11} />
                                <span>Quiz Pendente</span>
                              </span>
                            ) : row.statusType === 'reading' ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                <Clock size={11} />
                                <span>Em Leitura</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>

                          {/* Data */}
                          <td className="p-4 text-[11px] text-slate-400 whitespace-nowrap">
                            {row.quizDate 
                              ? new Date(row.quizDate).toLocaleDateString('pt-BR') 
                              : row.lastReadAt 
                              ? `Leu em ${new Date(row.lastReadAt).toLocaleDateString('pt-BR')}` 
                              : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        // ==========================================
        // CONTEÚDO DO RELATÓRIO POR ALUNO
        // ==========================================
        <div className="space-y-6">
          {/* Métricas Agregadas dos Alunos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-medium">Alunos Analisados</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {studentMetrics.totalStudents}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">no escopo selecionado</div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-medium">Total de Livros Concluídos</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {studentMetrics.totalBooksCompleted}
              </div>
              <div className="text-[10px] text-emerald-500 mt-0.5">livros 100% finalizados</div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-medium">Média de Livros por Aluno</div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {studentMetrics.avgBooksPerStudent}
              </div>
              <div className="text-[10px] text-indigo-400 mt-0.5">livros/estudante</div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-medium">Nota Média Geral nos Quizzes</div>
              <div className={`text-2xl font-bold mt-1 ${
                studentMetrics.overallAvgScore >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                {studentMetrics.overallAvgScore > 0 ? `${studentMetrics.overallAvgScore}%` : '-'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">aproveitamento médio</div>
            </div>
          </div>

          {/* Tabela de Alunos, Livros Lidos e Notas */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                Desempenho Geral dos Estudantes ({studentReportData.length})
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Clique na linha do aluno para expandir o histórico de livros e notas
              </span>
            </div>

            {studentReportData.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Users size={32} className="mx-auto text-slate-300 dark:text-slate-650" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Nenhum aluno encontrado com os filtros selecionados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-750 uppercase text-[10px] tracking-wider text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-4">Aluno / Matrícula</th>
                      <th className="p-4">Turma</th>
                      <th className="p-4 text-center">Livros Lidos (100%)</th>
                      <th className="p-4 text-center">Livros em Andamento</th>
                      <th className="p-4 text-center">Páginas Lidas</th>
                      <th className="p-4 text-center">Quizzes Realizados</th>
                      <th className="p-4 text-center">Nota Média Geral</th>
                      <th className="p-4 text-right">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {studentReportData.map((item) => {
                      const student = item.student
                      const isExpanded = expandedStudentId === student.id

                      return (
                        <React.Fragment key={student.id}>
                          <tr
                            onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                            className={`cursor-pointer transition-colors ${
                              isExpanded 
                                ? 'bg-indigo-50/50 dark:bg-indigo-950/30' 
                                : 'hover:bg-slate-50/50 dark:hover:bg-slate-750/30'
                            }`}
                          >
                            {/* Aluno */}
                            <td className="p-4">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                                  {student.full_name?.charAt(0) || 'A'}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {student.full_name}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-400">
                                    Matrícula: {student.enrollment_code}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Turma */}
                            <td className="p-4 font-medium text-slate-700 dark:text-slate-300">
                              {student.classes?.name || 'Sem turma'}
                            </td>

                            {/* NÚMERO DE LIVROS LIDOS */}
                            <td className="p-4 text-center">
                              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl font-extrabold text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <Trophy size={12} />
                                <span>{item.completedBooksCount} {item.completedBooksCount === 1 ? 'livro' : 'livros'}</span>
                              </span>
                            </td>

                            {/* Livros em Andamento */}
                            <td className="p-4 text-center font-bold text-indigo-600 dark:text-indigo-400">
                              {item.readingBooksCount} {item.readingBooksCount === 1 ? 'livro' : 'livros'}
                            </td>

                            {/* Páginas Lidas */}
                            <td className="p-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                              {item.totalPagesRead}
                            </td>

                            {/* Quizzes Realizados */}
                            <td className="p-4 text-center">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {item.quizzesPassedCount} / {item.quizzesAttemptedCount} aprovados
                              </span>
                            </td>

                            {/* NOTA MÉDIA GERAL */}
                            <td className="p-4 text-center">
                              {item.avgScore !== null ? (
                                <span className={`text-sm font-extrabold px-2.5 py-1 rounded-lg border font-mono ${
                                  item.avgScore >= 70
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                }`}>
                                  {item.avgScore}%
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-xs">Sem avaliações</span>
                              )}
                            </td>

                            {/* Botão de Expandir */}
                            <td className="p-4 text-right">
                              <button
                                type="button"
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </td>
                          </tr>

                          {/* Linha Expandida: Lista de Livros e Notas deste Aluno */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-850/80">
                              <td colSpan={8} className="p-4 sm:p-6">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                                      <BookOpen size={14} className="text-indigo-500" />
                                      <span>Livros Percorridos por {student.full_name} ({item.detailedBooks.length})</span>
                                    </h4>
                                    <span className="text-[11px] text-slate-400 font-medium">
                                      Detalhamento individual de leituras e notas
                                    </span>
                                  </div>

                                  {item.detailedBooks.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">
                                      Este aluno ainda não começou a ler nenhum livro no sistema.
                                    </p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                      {item.detailedBooks.map((bookItem) => (
                                        <div
                                          key={bookItem.bookId}
                                          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs space-y-2"
                                        >
                                          <div className="flex items-center space-x-2.5">
                                            <div className="relative w-8 h-11 rounded bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0 shadow-xs border border-slate-200 dark:border-slate-650">
                                              {bookItem.coverUrl ? (
                                                <Image src={bookItem.coverUrl} alt={bookItem.title} fill className="object-cover" />
                                              ) : (
                                                <div className="flex items-center justify-center w-full h-full text-slate-400">
                                                  <BookOpen size={12} />
                                                </div>
                                              )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                                {bookItem.title}
                                              </div>
                                              <div className="text-[10px] text-slate-400 truncate">
                                                {bookItem.author}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700 text-[11px]">
                                            <span className="text-slate-400 font-mono">
                                              Pág. {bookItem.currentPage} / {bookItem.totalPages}
                                            </span>

                                            <div>
                                              {bookItem.quizScore !== null ? (
                                                <span className={`font-mono font-extrabold px-1.5 py-0.5 rounded text-[10px] ${
                                                  bookItem.quizScore >= 70
                                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                                                }`}>
                                                  Nota: {bookItem.quizScore}%
                                                </span>
                                              ) : bookItem.isCompleted ? (
                                                <span className="text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                                                  Quiz Pendente
                                                </span>
                                              ) : (
                                                <span className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px]">
                                                  Em Leitura
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
