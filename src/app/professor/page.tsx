'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  Users, BookOpen, Plus, Edit2, Trash2, X, Loader2, 
  LogOut, GraduationCap, School, Key, Sparkles,
  MessageSquare, Check, CheckCircle, Calendar, BookmarkCheck,
  Clock, FileQuestion, CheckCircle2, Search, Filter, Eye, BarChart3
} from 'lucide-react'
import Image from 'next/image'
import AlunoReadingModal from '@/app/components/AlunoReadingModal'
import BookReadersModal from '@/app/components/BookReadersModal'
import RelatoriosView from '@/app/components/RelatoriosView'

export default function ProfessorDashboard() {
  const router = useRouter()
  const supabase = createClient()

  // Estados do Professor e Filtros Herdados
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [teacherInfo, setTeacherInfo] = useState<any>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)

  // Estados de Abas (Alunos, Clubes, Acompanhamento de Leituras e Relatórios)
  const [activeTab, setActiveTab] = useState<'alunos' | 'clubes' | 'leituras' | 'relatorios'>('alunos')

  // Estados de Alunos
  const [alunos, setAlunos] = useState<any[]>([])
  const [loadingAlunos, setLoadingAlunos] = useState(false)
  const [isAlunoModalOpen, setIsAlunoModalOpen] = useState(false)
  const [editingAluno, setEditingAluno] = useState<any>(null)
  const [alunoName, setAlunoName] = useState('')
  const [alunoBirthDate, setAlunoBirthDate] = useState('')
  const [alunoEnrollmentCode, setAlunoEnrollmentCode] = useState('')
  const [alunoPassword, setAlunoPassword] = useState('')
  const [alunoFormLoading, setAlunoFormLoading] = useState(false)

  // Estados de Clubes do Livro
  const [clubes, setClubes] = useState<any[]>([])
  const [loadingClubes, setLoadingClubes] = useState(false)
  const [isClubeModalOpen, setIsClubeModalOpen] = useState(false)
  const [clubeName, setClubeName] = useState('')
  const [clubeDescription, setClubeDescription] = useState('')
  const [clubeBookId, setClubeBookId] = useState('')
  const [clubeMaxMembers, setClubeMaxMembers] = useState(6)
  const [clubeStartDate, setClubeStartDate] = useState('')
  const [clubeEndDate, setClubeEndDate] = useState('')
  const [clubeFormLoading, setClubeFormLoading] = useState(false)
  const [allAcervoBooks, setAllAcervoBooks] = useState<any[]>([])

  // Estados de Acompanhamento de Leitura (Página em que o aluno está)
  const [turmaReadings, setTurmaReadings] = useState<any[]>([])
  const [loadingTurmaReadings, setLoadingTurmaReadings] = useState(false)
  const [readingSearch, setReadingSearch] = useState('')
  const [readingBookFilter, setReadingBookFilter] = useState('all')
  const [readingStatusFilter, setReadingStatusFilter] = useState<'all' | 'reading' | 'completed' | 'quiz_pending'>('all')

  // Modais de Acompanhamento
  const [selectedAlunoForReading, setSelectedAlunoForReading] = useState<any | null>(null)
  const [isAlunoReadingModalOpen, setIsAlunoReadingModalOpen] = useState(false)
  const [selectedBookForReaders, setSelectedBookForReaders] = useState<any | null>(null)
  const [isBookReadersModalOpen, setIsBookReadersModalOpen] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoadingInitial(true)
    try {
      // 1. Obter usuário autenticado
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      setUser(authUser)

      // 2. Buscar perfil
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      setProfile(userProfile)

      // 3. Buscar informações do Professor
      const { data: teacher, error: teacherErr } = await supabase
        .from('teachers')
        .select(`
          *,
          schools (id, name),
          grade_levels (id, name),
          classes (id, name, year)
        `)
        .eq('auth_user_id', authUser.id)
        .single()

      if (teacherErr || !teacher) {
        alert('Seu perfil de professor ainda não está vinculado a uma escola e turma. Entre em contato com o administrador.')
        setLoadingInitial(false)
        return
      }

      setTeacherInfo(teacher)

      // 4. Carregar alunos vinculados à turma do professor e o progresso de leitura
      if (teacher.class_id) {
        fetchAlunos(teacher.class_id)
        fetchTurmaReadings(teacher.class_id)
      }

      // 5. Carregar clubes e acervo da escola para seleção em clubes
      fetchClubes()
      fetchAllAcervoBooks(teacher.school_id)

    } catch (err: any) {
      console.error('Erro ao inicializar painel do professor:', err)
    } finally {
      setLoadingInitial(false)
    }
  }

  // ==========================================
  // LÓGICA DE ALUNOS (Apenas alunos da turma do professor)
  // ==========================================

  const fetchAlunos = async (classId: string) => {
    setLoadingAlunos(true)
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .order('full_name')
    if (data) setAlunos(data)
    setLoadingAlunos(false)
  }

  // ==========================================
  // LÓGICA DE ACOMPANHAMENTO DE LEITURA (Página em que o aluno está)
  // ==========================================

  const fetchTurmaReadings = async (classId: string) => {
    setLoadingTurmaReadings(true)
    try {
      const { data: progressData, error } = await supabase
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
          students!inner (
            id,
            full_name,
            enrollment_code,
            class_id
          )
        `)
        .eq('students.class_id', classId)
        .order('last_read_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar leituras da turma:', error)
        return
      }

      // Buscar tentativas de quiz para os alunos desta turma
      const studentIds = (progressData || []).map((p: any) => p.student_id)
      const quizMap = new Map<string, any>()
      if (studentIds.length > 0) {
        const { data: quizData } = await supabase
          .from('quiz_attempts')
          .select('student_id, book_id, passed, score')
          .in('student_id', studentIds)

        if (quizData) {
          quizData.forEach((q: any) => {
            const key = `${q.student_id}_${q.book_id}`
            if (!quizMap.has(key) || q.passed) {
              quizMap.set(key, q)
            }
          })
        }
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

      setTurmaReadings(formatted)
    } catch (err) {
      console.error('Erro ao processar leituras da turma:', err)
    } finally {
      setLoadingTurmaReadings(false)
    }
  }

  const openNewAlunoModal = () => {
    setEditingAluno(null)
    setAlunoName('')
    setAlunoBirthDate('')
    setAlunoEnrollmentCode('')
    setAlunoPassword('')
    setIsAlunoModalOpen(true)
  }

  const openEditAlunoModal = (aluno: any) => {
    setEditingAluno(aluno)
    setAlunoName(aluno.full_name)
    setAlunoBirthDate(aluno.birth_date)
    setAlunoEnrollmentCode(aluno.enrollment_code)
    setAlunoPassword('')
    setIsAlunoModalOpen(true)
  }

  const handleAlunoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teacherInfo?.class_id) return
    setAlunoFormLoading(true)

    try {
      if (editingAluno) {
        // Atualizar aluno existente
        const { error } = await supabase
          .from('students')
          .update({
            full_name: alunoName,
            birth_date: alunoBirthDate,
            enrollment_code: alunoEnrollmentCode,
          })
          .eq('id', editingAluno.id)

        if (error) throw error
        alert('Aluno atualizado com sucesso!')
      } else {
        // Criar novo aluno
        if (!alunoPassword || alunoPassword.length < 6) {
          alert('Por favor, informe uma senha de no mínimo 6 caracteres para o aluno.')
          setAlunoFormLoading(false)
          return
        }

        const studentEmail = `${alunoEnrollmentCode.toLowerCase().trim()}@biblioteca.escolar`

        const response = await fetch('/api/admin/create-student-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: studentEmail,
            password: alunoPassword,
            fullName: alunoName,
            birthDate: alunoBirthDate,
            enrollmentCode: alunoEnrollmentCode,
            classId: teacherInfo.class_id
          })
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao criar conta de acesso do aluno.')
        }

        alert('Aluno e credenciais criados com sucesso!')
      }

      setIsAlunoModalOpen(false)
      fetchAlunos(teacherInfo.class_id)
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setAlunoFormLoading(false)
    }
  }

  const handleAlunoDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este aluno?')) return
    try {
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (error) throw error
      alert('Aluno removido com sucesso!')
      if (teacherInfo?.class_id) fetchAlunos(teacherInfo.class_id)
    } catch (err: any) {
      alert('Erro ao excluir aluno: ' + err.message)
    }
  }

  // ==========================================
  // LÓGICA DE CLUBES DO LIVRO
  // ==========================================

  const fetchClubes = async () => {
    setLoadingClubes(true)
    try {
      const res = await fetch('/api/clubs/teacher')
      const data = await res.json()
      if (data?.clubs) {
        setClubes(data.clubs)
      }
    } catch (err) {
      console.error('Erro ao buscar clubes:', err)
    } finally {
      setLoadingClubes(false)
    }
  }

  const fetchAllAcervoBooks = async (schoolId?: string) => {
    try {
      let query = supabase
        .from('books')
        .select('id, title, cover_url, author, school_id')
        .order('title')

      if (schoolId) {
        query = query.or(`school_id.is.null,school_id.eq.${schoolId}`)
      }

      const { data } = await query
      if (data) setAllAcervoBooks(data)
    } catch (err) {
      console.error('Erro ao buscar acervo:', err)
    }
  }

  const openNewClubeModal = () => {
    setClubeName('')
    setClubeDescription('')
    setClubeBookId(allAcervoBooks[0]?.id || '')
    setClubeMaxMembers(6)
    setClubeStartDate('')
    setClubeEndDate('')
    setIsClubeModalOpen(true)
  }

  const handleClubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clubeBookId) {
      alert('Por favor, selecione um livro para o clube.')
      return
    }

    setClubeFormLoading(true)
    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clubeName,
          description: clubeDescription,
          bookId: clubeBookId,
          classId: teacherInfo?.class_id,
          maxMembers: clubeMaxMembers,
          startDate: clubeStartDate || null,
          endDate: clubeEndDate || null
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar clube do livro.')
      }

      alert('Clube do Livro criado com sucesso! Seus alunos já podem ingressar.')
      setIsClubeModalOpen(false)
      fetchClubes()
    } catch (err: any) {
      alert('Erro ao criar clube: ' + err.message)
    } finally {
      setClubeFormLoading(false)
    }
  }

  const handleClubeDelete = async (clubeId: string) => {
    if (!confirm('Deseja realmente excluir este clube do livro? Todas as mensagens e membros serão desvinculados.')) return
    try {
      const { error } = await supabase.from('book_clubs').delete().eq('id', clubeId)
      if (error) throw error
      alert('Clube excluído com sucesso!')
      fetchClubes()
    } catch (err: any) {
      alert('Erro ao excluir clube: ' + err.message)
    }
  }

  const handleApproveDiscussion = async (discId: string) => {
    try {
      const { error } = await supabase
        .from('club_discussions')
        .update({ approved: true })
        .eq('id', discId)
      if (error) throw error
      fetchClubes()
    } catch (err: any) {
      alert('Erro ao aprovar mensagem: ' + err.message)
    }
  }

  const handleRejectDiscussion = async (discId: string) => {
    if (!confirm('Deseja excluir esta mensagem do mural?')) return
    try {
      const { error } = await supabase
        .from('club_discussions')
        .delete()
        .eq('id', discId)
      if (error) throw error
      fetchClubes()
    } catch (err: any) {
      alert('Erro ao rejeitar mensagem: ' + err.message)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  if (loadingInitial) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      
      {/* Top Header do Professor */}
      <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-650 p-2.5 rounded-2xl shadow-inner">
              <GraduationCap size={28} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold flex items-center space-x-1.5">
                <span>Painel do Professor</span>
                <Sparkles size={16} className="text-yellow-300" />
              </h1>
              <p className="text-xs text-indigo-200 mt-0.5">
                Professor: <span className="font-semibold text-white">{teacherInfo?.full_name}</span>
              </p>
            </div>
          </div>

          {/* Vinculação do Professor */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="flex items-center space-x-1 bg-indigo-600 px-3 py-1.5 rounded-xl border border-indigo-500 shadow-sm">
              <School size={14} />
              <span>{teacherInfo?.schools?.name}</span>
            </span>
            <span className="flex items-center space-x-1 bg-indigo-600 px-3 py-1.5 rounded-xl border border-indigo-500 shadow-sm">
              <Users size={14} />
              <span>Turma: {teacherInfo?.classes?.name} ({teacherInfo?.grade_levels?.name})</span>
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-1 bg-red-650 hover:bg-red-700 px-3 py-1.5 rounded-xl border border-red-600 transition-colors"
            >
              <LogOut size={14} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        
        {/* Abas */}
        <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-px">
          <button
            onClick={() => setActiveTab('alunos')}
            className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-semibold transition-all ${
              activeTab === 'alunos'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <Users size={16} />
            <span>Alunos da Minha Turma ({alunos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('clubes')}
            className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-semibold transition-all ${
              activeTab === 'clubes'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <BookOpen size={16} />
            <span>Clubes do Livro ({clubes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('leituras')}
            className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-semibold transition-all ${
              activeTab === 'leituras'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <BookmarkCheck size={16} />
            <span>Acompanhamento de Leitura ({turmaReadings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('relatorios')}
            className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-semibold transition-all ${
              activeTab === 'relatorios'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            <BarChart3 size={16} />
            <span>Relatórios & Notas</span>
          </button>
        </div>

        {/* CONTEÚDO DA ABA: ALUNOS (Exclusivo da turma do professor) */}
        {activeTab === 'alunos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Alunos da Sua Turma</h2>
                <p className="text-xs text-slate-500 mt-1">Gerencie os alunos matriculados na sua turma e crie credenciais de acesso.</p>
              </div>
              <button
                onClick={openNewAlunoModal}
                className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow transition-all active:scale-95"
              >
                <Plus size={14} />
                <span>Novo Aluno</span>
              </button>
            </div>

            {loadingAlunos ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : alunos.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 text-center rounded-2xl">
                <p className="text-sm text-slate-500">Nenhum aluno cadastrado na sua turma ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-750 uppercase text-[10px] tracking-wider text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-4">Nome do Aluno</th>
                      <th className="p-4">Matrícula (Login)</th>
                      <th className="p-4">Nascimento</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {alunos.map((aluno) => (
                      <tr key={aluno.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition-colors">
                        <td className="p-4 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                            {aluno.full_name.charAt(0)}
                          </div>
                          <span>{aluno.full_name}</span>
                        </td>
                        <td className="p-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {aluno.enrollment_code}
                        </td>
                        <td className="p-4">
                          {aluno.birth_date ? new Date(aluno.birth_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedAlunoForReading(aluno)
                              setIsAlunoReadingModalOpen(true)
                            }}
                            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors inline-flex items-center space-x-1"
                            title="Ver em qual página e livro este aluno está"
                          >
                            <BookOpen size={14} />
                            <span className="text-[11px] font-bold">Leituras</span>
                          </button>
                          <button
                            onClick={() => openEditAlunoModal(aluno)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
                            title="Editar Aluno"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleAlunoDelete(aluno.id)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                            title="Excluir Aluno"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CONTEÚDO DA ABA: CLUBES DO LIVRO */}
        {activeTab === 'clubes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                  <Users className="text-indigo-600" size={22} />
                  <span>Clubes do Livro da Turma</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">Crie grupos de leitura coletiva para seus alunos usando os livros do acervo da escola.</p>
              </div>
              <button
                onClick={openNewClubeModal}
                className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition-all active:scale-95 shrink-0"
              >
                <Plus size={16} />
                <span>Criar Novo Clube</span>
              </button>
            </div>

            {loadingClubes ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : clubes.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-12 text-center rounded-2xl">
                <Users size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">Nenhum Clube do Livro Ativo</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">Crie um clube para que seus alunos leiam o mesmo livro e compartilhem ideias no mural!</p>
                <button
                  onClick={openNewClubeModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow"
                >
                  Criar Primeiro Clube
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {clubes.map((clube) => {
                  const bookData = Array.isArray(clube.book) ? clube.book[0] : clube.book
                  const pendingDiscussions = (clube.discussions || []).filter((d: any) => !d.approved)
                  const approvedDiscussions = (clube.discussions || []).filter((d: any) => d.approved)
                  const memberCount = clube.members?.length || 0

                  return (
                    <div 
                      key={clube.id}
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4 flex flex-col justify-between"
                    >
                      {/* Topo do Card do Clube */}
                      <div className="flex gap-4">
                        <div className="w-20 h-28 relative rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 shadow">
                          {bookData?.cover_url ? (
                            <Image src={bookData.cover_url} alt={bookData.title || 'Capa'} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">Sem Capa</div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">{clube.name}</h3>
                              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate">{bookData?.title}</p>
                            </div>
                            <button
                              onClick={() => handleClubeDelete(clube.id)}
                              className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors"
                              title="Excluir Clube"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">
                            {clube.description || 'Sem descrição específica.'}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold">
                              <Users size={12} />
                              <span>{memberCount} / {clube.max_members} membros</span>
                            </span>
                            {pendingDiscussions.length > 0 && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-lg text-[10px] font-bold animate-pulse">
                                <MessageSquare size={10} />
                                <span>{pendingDiscussions.length} msgs para aprovar</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Seção de Moderação de Mensagens do Mural */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center space-x-1">
                            <MessageSquare size={14} className="text-indigo-500" />
                            <span>Mural de Discussão ({clube.discussions?.length || 0})</span>
                          </span>
                        </div>

                        {/* Mensagens Pendentes de Moderação */}
                        {pendingDiscussions.length > 0 && (
                          <div className="space-y-1.5 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
                            <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Aguardando sua aprovação:</p>
                            {pendingDiscussions.map((d: any) => (
                              <div key={d.id} className="flex items-start justify-between gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg text-xs shadow-xs">
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white">{d.student?.full_name || 'Aluno'}: </span>
                                  <span className="text-slate-600 dark:text-slate-300">{d.message}</span>
                                </div>
                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    onClick={() => handleApproveDiscussion(d.id)}
                                    className="p-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 rounded-md transition-colors"
                                    title="Aprovar mensagem"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleRejectDiscussion(d.id)}
                                    className="p-1 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/60 dark:text-red-300 rounded-md transition-colors"
                                    title="Rejeitar mensagem"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Últimas Mensagens Aprovadas */}
                        {approvedDiscussions.length > 0 ? (
                          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                            {approvedDiscussions.slice(-3).map((d: any) => (
                              <div key={d.id} className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-750/50 p-1.5 rounded-lg flex items-center justify-between">
                                <p className="truncate">
                                  <strong className="text-slate-800 dark:text-slate-200">{d.student?.full_name}:</strong> {d.message}
                                </p>
                                <CheckCircle size={10} className="text-emerald-500 shrink-0 ml-1" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          pendingDiscussions.length === 0 && (
                            <p className="text-[10px] text-slate-400 italic">Nenhuma mensagem publicada ainda.</p>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* CONTEÚDO DA ABA: ACOMPANHAMENTO DE LEITURA (PÁGINA DO ALUNO) */}
        {activeTab === 'leituras' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                  <BookmarkCheck className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <span>Acompanhamento de Leitura da Turma</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Identifique exatamente em qual página cada aluno parou de ler cada livro, o percentual percorrido e o status de validação.
                </p>
              </div>

              {teacherInfo?.class_id && (
                <button
                  onClick={() => fetchTurmaReadings(teacherInfo.class_id)}
                  className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 self-start sm:self-auto"
                >
                  <BookmarkCheck size={14} />
                  <span>Atualizar Leituras</span>
                </button>
              )}
            </div>

            {/* Cards de Métricas da Turma */}
            {(() => {
              const totalPages = turmaReadings.reduce((acc, curr) => acc + (curr.current_page || 0), 0)
              const completedCount = turmaReadings.filter((r) => r.isCompleted).length
              const readingCount = turmaReadings.filter((r) => !r.isCompleted).length
              const uniqueStudents = new Set(turmaReadings.map((r) => r.student_id)).size

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                    <div className="text-xs text-slate-400 font-medium">Alunos Lendo</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{uniqueStudents}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">de {alunos.length} alunos na turma</div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                    <div className="text-xs text-slate-400 font-medium">Livros em Leitura</div>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{readingCount}</div>
                    <div className="text-[10px] text-indigo-400 mt-0.5">em andamento</div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                    <div className="text-xs text-slate-400 font-medium">Livros Concluídos</div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{completedCount}</div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">100% finalizados</div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                    <div className="text-xs text-slate-400 font-medium">Páginas Lidas na Turma</div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{totalPages}</div>
                    <div className="text-[10px] text-amber-400 mt-0.5">páginas percorridas</div>
                  </div>
                </div>
              )
            })()}

            {/* Painel de Filtros e Busca */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar aluno, matrícula ou livro..."
                  value={readingSearch}
                  onChange={(e) => setReadingSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-650 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro por Livro da Turma */}
                {(() => {
                  const uniqueBooks = Array.from(
                    new Map(turmaReadings.map((r) => [r.book_id, r.books])).values()
                  ).filter(Boolean)

                  return (
                    <select
                      value={readingBookFilter}
                      onChange={(e) => setReadingBookFilter(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-650 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 max-w-[200px] truncate"
                    >
                      <option value="all">Todos os Livros ({uniqueBooks.length})</option>
                      {uniqueBooks.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.title}</option>
                      ))}
                    </select>
                  )
                })()}

                {/* Filtro por Status */}
                <select
                  value={readingStatusFilter}
                  onChange={(e) => setReadingStatusFilter(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-650 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="all">Todos os Status</option>
                  <option value="reading">Em Leitura</option>
                  <option value="completed">100% Concluído</option>
                  <option value="quiz_pending">Aguardando Quiz</option>
                </select>
              </div>
            </div>

            {/* Listagem de Leituras */}
            {(() => {
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

              const filtered = turmaReadings.filter((r) => {
                const student = r.students || {}
                const book = r.books || {}

                if (readingBookFilter !== 'all' && r.book_id !== readingBookFilter) return false
                if (readingStatusFilter === 'completed' && !r.isCompleted) return false
                if (readingStatusFilter === 'quiz_pending' && !r.hasPendingQuiz) return false
                if (readingStatusFilter === 'reading' && (r.isCompleted || r.hasPendingQuiz)) return false

                if (readingSearch) {
                  const q = readingSearch.toLowerCase()
                  const sName = student.full_name?.toLowerCase() || ''
                  const sCode = student.enrollment_code?.toLowerCase() || ''
                  const bTitle = book.title?.toLowerCase() || ''
                  const bAuthor = book.author?.toLowerCase() || ''
                  if (!sName.includes(q) && !sCode.includes(q) && !bTitle.includes(q) && !bAuthor.includes(q)) {
                    return false
                  }
                }

                return true
              })

              if (loadingTurmaReadings) {
                return (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                    <Loader2 className="animate-spin text-indigo-500" size={36} />
                    <p className="text-sm font-semibold">Carregando leituras da turma...</p>
                  </div>
                )
              }

              if (filtered.length === 0) {
                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-12 text-center rounded-2xl shadow-sm space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                      <BookOpen size={30} />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">
                      {readingSearch || readingBookFilter !== 'all' || readingStatusFilter !== 'all'
                        ? 'Nenhuma leitura encontrada com esses filtros.'
                        : 'Nenhum aluno da sua turma iniciou uma leitura ainda.'}
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Conforme os alunos abrirem os livros e passarem as páginas, cada página será registrada aqui em tempo real.
                    </p>
                  </div>
                )
              }

              return (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                      <thead className="bg-slate-50 dark:bg-slate-750 uppercase text-[10px] tracking-wider text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-4">Aluno</th>
                          <th className="p-4">Livro</th>
                          <th className="p-4">Página Atual / Total</th>
                          <th className="p-4">Progresso</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Última Leitura</th>
                          <th className="p-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filtered.map((item) => {
                          const student = item.students || {}
                          const book = item.books || {}
                          const currentPage = item.current_page || 1
                          const totalPages = item.total_pages || 1
                          const percent = Math.min(100, Math.round((currentPage / totalPages) * 100))

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition-colors">
                              {/* Aluno */}
                              <td className="p-4">
                                <div className="flex items-center space-x-2.5">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                                    {student.full_name?.charAt(0) || 'A'}
                                  </div>
                                  <div>
                                    <div 
                                      onClick={() => {
                                        setSelectedAlunoForReading(student)
                                        setIsAlunoReadingModalOpen(true)
                                      }}
                                      className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                                    >
                                      {student.full_name || 'Aluno'}
                                    </div>
                                    <div className="font-mono text-[10px] text-slate-400">
                                      Matrícula: {student.enrollment_code}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Livro */}
                              <td className="p-4">
                                <div className="flex items-center space-x-2.5 max-w-[220px]">
                                  <div className="relative w-8 h-11 rounded bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0 shadow-sm border border-slate-200 dark:border-slate-650">
                                    {book.cover_url ? (
                                      <Image src={book.cover_url} alt={book.title || 'Capa'} fill className="object-cover" />
                                    ) : (
                                      <div className="flex items-center justify-center w-full h-full text-slate-400">
                                        <BookOpen size={14} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div 
                                      onClick={() => {
                                        setSelectedBookForReaders(book)
                                        setIsBookReadersModalOpen(true)
                                      }}
                                      className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer truncate transition-colors"
                                      title={book.title}
                                    >
                                      {book.title || 'Livro'}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">{book.author || 'Autor'}</div>
                                  </div>
                                </div>
                              </td>

                              {/* DESTAQUE PRINCIPAL: EM QUAL PÁGINA O ALUNO ESTÁ */}
                              <td className="p-4 font-mono whitespace-nowrap">
                                <div className="flex items-baseline space-x-1">
                                  <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                                    Pág. {currentPage}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    / {totalPages}
                                  </span>
                                </div>
                              </td>

                              {/* Barra de Progresso */}
                              <td className="p-4 w-36">
                                <div className="space-y-1">
                                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-1.5 rounded-full transition-all ${
                                        item.isCompleted
                                          ? 'bg-emerald-500'
                                          : item.hasPendingQuiz
                                          ? 'bg-amber-500'
                                          : 'bg-indigo-600'
                                      }`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400 flex justify-between">
                                    <span>Avanço</span>
                                    <span className={item.isCompleted ? 'text-emerald-500' : 'text-indigo-500'}>
                                      {percent}%
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="p-4 whitespace-nowrap">
                                {item.isCompleted ? (
                                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 size={11} />
                                    <span>100% Lido</span>
                                  </span>
                                ) : item.hasPendingQuiz ? (
                                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800">
                                    <FileQuestion size={11} />
                                    <span>Aguardando Quiz</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
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
                                    setSelectedAlunoForReading(student)
                                    setIsAlunoReadingModalOpen(true)
                                  }}
                                  className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-650 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors inline-flex items-center space-x-1"
                                  title="Ver todas as leituras deste aluno"
                                >
                                  <Users size={13} />
                                  <span className="text-[10px] font-bold">Aluno</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedBookForReaders(book)
                                    setIsBookReadersModalOpen(true)
                                  }}
                                  className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-amber-50 dark:hover:bg-slate-650 text-amber-600 dark:text-amber-400 rounded-lg transition-colors inline-flex items-center space-x-1"
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
                </div>
              )
            })()}
          </div>
        )}

        {/* CONTEÚDO DA ABA: RELATÓRIOS & NOTAS */}
        {activeTab === 'relatorios' && (
          <RelatoriosView
            isTeacher={true}
            initialClassId={teacherInfo?.class_id}
            initialSchoolId={teacherInfo?.school_id}
          />
        )}

      </main>

      {/* MODAL DE ALUNOS */}
      {isAlunoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative transition-colors duration-200 text-slate-900 dark:text-white">
            <button
              onClick={() => setIsAlunoModalOpen(false)}
              className="absolute top-4 right-4 text-slate-450 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-xl font-bold">
                {editingAluno ? 'Editar Aluno' : 'Novo Aluno'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">Sua turma: {teacherInfo?.classes?.name}</p>
            </div>

            <form onSubmit={handleAlunoSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={alunoName}
                  onChange={(e) => setAlunoName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-350 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Nome do Estudante"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nascimento</label>
                  <input
                    type="date"
                    required
                    value={alunoBirthDate}
                    onChange={(e) => setAlunoBirthDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-350 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Matrícula (Login)</label>
                  <input
                    type="text"
                    required
                    value={alunoEnrollmentCode}
                    onChange={(e) => setAlunoEnrollmentCode(e.target.value)}
                    className="block w-full rounded-lg border border-slate-355 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors text-xs"
                    placeholder="Ex: MAT789"
                  />
                </div>
              </div>

              {!editingAluno && (
                <div className="bg-slate-50 dark:bg-slate-750 p-4 rounded-xl border border-slate-200 dark:border-slate-650 space-y-3">
                  <div className="flex items-center space-x-2 text-slate-800 dark:text-white">
                    <Key size={14} className="text-indigo-500" />
                    <span className="text-xs font-bold uppercase tracking-wide">Credenciais de Acesso</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-450 mb-0.5">Definir Senha do Aluno</label>
                    <input
                      type="password"
                      value={alunoPassword}
                      onChange={(e) => setAlunoPassword(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors text-xs"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    O e-mail de login do aluno será: <span className="font-semibold text-indigo-650 dark:text-indigo-400 font-mono">{alunoEnrollmentCode ? alunoEnrollmentCode.toLowerCase() : 'matricula'}@biblioteca.escolar</span>
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAlunoModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-650 text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={alunoFormLoading}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-650 text-white rounded-xl text-xs font-bold transition-all shadow"
                >
                  {alunoFormLoading && <Loader2 className="animate-spin" size={12} />}
                  <span>{editingAluno ? 'Salvar Alterações' : 'Salvar Aluno'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO DE CLUBE DO LIVRO */}
      {isClubeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative transition-colors duration-200 text-slate-900 dark:text-white">
            <button
              onClick={() => setIsClubeModalOpen(false)}
              className="absolute top-4 right-4 text-slate-450 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-xl font-bold">Criar Clube do Livro</h2>
              <p className="text-xs text-slate-500 mt-1">Configure o grupo de leitura para a sua turma ({teacherInfo?.classes?.name}).</p>
            </div>

            <form onSubmit={handleClubeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nome do Clube</label>
                <input
                  type="text"
                  required
                  value={clubeName}
                  onChange={(e) => setClubeName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-350 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Ex: Exploradores da Ficção Científica"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Descrição / Objetivo</label>
                <textarea
                  value={clubeDescription}
                  onChange={(e) => setClubeDescription(e.target.value)}
                  rows={2}
                  className="block w-full rounded-lg border border-slate-350 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors resize-none"
                  placeholder="Vamos ler este livro e debater os personagens!"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Livro do Acervo da Escola</label>
                <select
                  required
                  value={clubeBookId}
                  onChange={(e) => setClubeBookId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-350 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                >
                  <option value="">Selecione um livro do acervo...</option>
                  {allAcervoBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.author})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Vagas (Máx)</label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={clubeMaxMembers}
                    onChange={(e) => setClubeMaxMembers(Number(e.target.value))}
                    className="block w-full rounded-lg border border-slate-350 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Início</label>
                  <input
                    type="date"
                    value={clubeStartDate}
                    onChange={(e) => setClubeStartDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-350 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Término</label>
                  <input
                    type="date"
                    value={clubeEndDate}
                    onChange={(e) => setClubeEndDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-350 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsClubeModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-650 text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={clubeFormLoading}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-650 text-white rounded-xl text-xs font-bold transition-all shadow"
                >
                  {clubeFormLoading && <Loader2 className="animate-spin" size={12} />}
                  <span>Criar Clube</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Acompanhamento de Leituras do Aluno */}
      <AlunoReadingModal
        isOpen={isAlunoReadingModalOpen}
        onClose={() => {
          setIsAlunoReadingModalOpen(false)
          setSelectedAlunoForReading(null)
        }}
        student={selectedAlunoForReading}
      />

      {/* Modal de Leitores de Livro Específico */}
      <BookReadersModal
        isOpen={isBookReadersModalOpen}
        onClose={() => {
          setIsBookReadersModalOpen(false)
          setSelectedBookForReaders(null)
        }}
        book={selectedBookForReaders}
        classId={teacherInfo?.class_id}
      />

    </div>
  )
}
