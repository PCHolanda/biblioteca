'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Users, Plus, Edit2, Trash2, X, Loader2, Key, Upload, FileSpreadsheet, BookOpen } from 'lucide-react'
import Papa from 'papaparse'
import AlunoReadingModal from '@/app/components/AlunoReadingModal'

export default function AlunosPage() {
  // Dados estruturais
  const [escolas, setEscolas] = useState<any[]>([])
  const [series, setSeries] = useState<any[]>([])
  const [turmas, setTurmas] = useState<any[]>([])
  const [alunos, setAlunos] = useState<any[]>([])

  // Filtros Cascata
  const [selectedEscolaId, setSelectedEscolaId] = useState('')
  const [selectedSerieId, setSelectedSerieId] = useState('')
  const [selectedTurmaId, setSelectedTurmaId] = useState('')

  // Estados de Carregamento
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingAlunos, setLoadingAlunos] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false)
  const [editingAluno, setEditingAluno] = useState<any>(null)
  const [selectedAlunoForReadings, setSelectedAlunoForReadings] = useState<any | null>(null)
  const [isReadingsModalOpen, setIsReadingsModalOpen] = useState(false)
  
  // Campos do formulário
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [enrollmentCode, setEnrollmentCode] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  
  // Campos estruturais de Escola, Série e Turma internos ao modal
  const [modalEscolaId, setModalEscolaId] = useState('')
  const [modalSerieId, setModalSerieId] = useState('')
  const [modalTurmaId, setModalTurmaId] = useState('')
  const [modalTurmas, setModalTurmas] = useState<any[]>([])
  const [studentPassword, setStudentPassword] = useState('')

  // Geração de Login / Credenciais
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false)
  const [generatedCreds, setGeneratedCreds] = useState<any>(null)
  const [tempPassword, setTempPassword] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchInitialFilters()
  }, [])

  useEffect(() => {
    if (selectedTurmaId) {
      fetchAlunos(selectedTurmaId)
    } else {
      setAlunos([])
    }
  }, [selectedTurmaId])

  const fetchInitialFilters = async () => {
    setLoadingInitial(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingInitial(false); return; }
    const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).single()

    const { data: schools } = await supabase.from('schools').select('id, name').eq('client_id', profile?.client_id).order('name')
    const { data: grades } = await supabase.from('grade_levels').select('id, name').order('order_index')

    if (schools) {
      setEscolas(schools)
      if (schools.length > 0) setSelectedEscolaId(schools[0].id)
    }
    if (grades) {
      setSeries(grades)
      if (grades.length > 0) setSelectedSerieId(grades[0].id)
    }
    setLoadingInitial(false)
  }

  // Sempre que a escola ou série mudar, recarregar as turmas disponíveis
  useEffect(() => {
    if (selectedEscolaId && selectedSerieId) {
      fetchTurmasFiltradas(selectedEscolaId, selectedSerieId)
    }
  }, [selectedEscolaId, selectedSerieId])

  const fetchTurmasFiltradas = async (escolaId: string, gradeId: string) => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, year')
      .eq('school_id', escolaId)
      .eq('grade_level_id', gradeId)
      .order('name')

    if (data) {
      setTurmas(data)
      if (data.length > 0) {
        setSelectedTurmaId(data[0].id)
      } else {
        setSelectedTurmaId('')
      }
    }
  }

  const fetchAlunos = async (turmaId: string) => {
    setLoadingAlunos(true)
    const { data } = await supabase
      .from('students')
      .select(`
        *,
        classes (
          id,
          name,
          school_id,
          grade_level_id
        )
      `)
      .eq('class_id', turmaId)
      .order('full_name')
    if (data) setAlunos(data)
    setLoadingAlunos(false)
  }

  const handleModalFilterChange = async (escolaId: string, gradeId: string) => {
    setModalEscolaId(escolaId)
    setModalSerieId(gradeId)

    if (escolaId && gradeId) {
      const { data } = await supabase
        .from('classes')
        .select('id, name, year')
        .eq('school_id', escolaId)
        .eq('grade_level_id', gradeId)
        .order('name')

      if (data) {
        setModalTurmas(data)
        if (data.length > 0) {
          setModalTurmaId(data[0].id)
        } else {
          setModalTurmaId('')
        }
      }
    } else {
      setModalTurmas([])
      setModalTurmaId('')
    }
  }

  const openNewModal = () => {
    setEditingAluno(null)
    setFullName('')
    setBirthDate('')
    setEnrollmentCode('')
    setStudentPassword('')
    
    // Inicializar o modal com os filtros ativos no cabeçalho
    setModalEscolaId(selectedEscolaId)
    setModalSerieId(selectedSerieId)
    setModalTurmaId(selectedTurmaId)
    setModalTurmas(turmas)
    setIsModalOpen(true)
  }

  const openEditModal = async (aluno: any) => {
    setEditingAluno(aluno)
    setFullName(aluno.full_name)
    setBirthDate(aluno.birth_date)
    setEnrollmentCode(aluno.enrollment_code)
    setStudentPassword('') // Vazio no edit

    const classInfo = aluno.classes
    if (classInfo) {
      setModalEscolaId(classInfo.school_id)
      setModalSerieId(classInfo.grade_level_id)
      setModalTurmaId(classInfo.id)
      
      const { data } = await supabase
        .from('classes')
        .select('id, name, year')
        .eq('school_id', classInfo.school_id)
        .eq('grade_level_id', classInfo.grade_level_id)
        .order('name')
      if (data) setModalTurmas(data)
    } else {
      setModalEscolaId('')
      setModalSerieId('')
      setModalTurmaId('')
      setModalTurmas([])
    }
    
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      if (!modalTurmaId) {
        throw new Error('Por favor, selecione uma turma válida para o aluno.')
      }

      const alunoPayload = {
        class_id: modalTurmaId,
        full_name: fullName,
        birth_date: birthDate,
        enrollment_code: enrollmentCode.trim().toUpperCase(),
      }

      let studentId = ''

      if (editingAluno) {
        const { error } = await supabase
          .from('students')
          .update(alunoPayload)
          .eq('id', editingAluno.id)
        if (error) throw error
        studentId = editingAluno.id
      } else {
        const { data, error } = await supabase
          .from('students')
          .insert([alunoPayload])
          .select('id')
          .single()
        if (error) throw error
        studentId = data.id
      }

      // Se for novo aluno e a senha foi preenchida, criar a conta de acesso no Auth automaticamente
      if (!editingAluno && studentPassword.trim()) {
        const res = await fetch('/api/admin/create-student-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            enrollmentCode: enrollmentCode.trim().toUpperCase(),
            password: studentPassword.trim(),
            displayName: fullName
          })
        })

        const data = await res.json()
        if (!res.ok) {
          // Reverter a inserção do aluno no banco de dados para evitar órfãos
          await supabase.from('students').delete().eq('id', studentId)
          throw new Error(data.error || 'Erro ao gerar credenciais de acesso')
        } else {
          alert(`Estudante e login gerados com sucesso!\nMatrícula: ${enrollmentCode.trim().toUpperCase()}\nSenha: ${studentPassword.trim()}`)
        }
      }

      setIsModalOpen(false)
      if (selectedTurmaId) {
        fetchAlunos(selectedTurmaId)
      }
    } catch (error: any) {
      alert('Erro ao salvar aluno: ' + error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este aluno?')) return

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao deletar aluno: ' + error.message)
    } else {
      fetchAlunos(selectedTurmaId)
    }
  }

  // Importação CSV em Lote
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as any[]
          
          if (rows.length === 0) {
            alert('Arquivo CSV vazio ou sem cabeçalhos válidos.')
            return
          }

          // Validar colunas requeridas
          const headers = results.meta.fields || []
          if (!headers.includes('full_name') || !headers.includes('birth_date') || !headers.includes('enrollment_code')) {
            alert('O CSV deve conter as colunas: full_name, birth_date, enrollment_code')
            return
          }

          setFormLoading(true)
          try {
            // Mapear linhas adicionando o class_id da turma selecionada
            const studentsToInsert = rows.map((row) => ({
              class_id: selectedTurmaId,
              full_name: row.full_name.trim(),
              birth_date: row.birth_date.trim(),
              enrollment_code: row.enrollment_code.trim().toUpperCase(),
            }))

            const { error } = await supabase
              .from('students')
              .insert(studentsToInsert)

            if (error) throw error

            alert(`${studentsToInsert.length} alunos importados com sucesso!`)
            setIsCsvModalOpen(false)
            fetchAlunos(selectedTurmaId)
          } catch (err: any) {
            alert('Erro ao importar alunos: ' + err.message)
          } finally {
            setFormLoading(false)
          }
        }
      })
    }
  }

  // Gerar Login do Aluno
  const handleGenerateLogin = async (aluno: any) => {
    // Definir uma senha padrão com base na matrícula ou data de nascimento, ou permitir edição rápida
    const defaultPassword = aluno.enrollment_code.toLowerCase() + '123'
    
    if (!confirm(`Deseja criar a conta de login para ${aluno.full_name}?\nE-mail fictício: ${aluno.enrollment_code.toLowerCase()}@biblioteca.escolar\nSenha temporária: ${defaultPassword}`)) {
      return
    }

    setFormLoading(true)
    try {
      const res = await fetch('/api/admin/create-student-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: aluno.id,
          enrollmentCode: aluno.enrollment_code,
          password: defaultPassword,
          displayName: aluno.full_name
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro na requisição')
      }

      setGeneratedCreds({
        name: aluno.full_name,
        code: aluno.enrollment_code,
        email: data.email,
        password: defaultPassword
      })
      setCredentialsModalOpen(true)
      fetchAlunos(selectedTurmaId)
    } catch (err: any) {
      alert('Falha ao gerar credenciais: ' + err.message)
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Alunos</h1>
          <p className="text-slate-400 mt-1">Gerencie os alunos e suas credenciais de acesso.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsCsvModalOpen(true)}
            disabled={!selectedTurmaId}
            className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:bg-slate-800/40 disabled:text-slate-600 disabled:border-slate-850"
          >
            <FileSpreadsheet size={16} />
            <span>Importar CSV</span>
          </button>
          <button
            onClick={openNewModal}
            disabled={!selectedTurmaId}
            className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:bg-indigo-600/40 disabled:text-slate-500"
          >
            <Plus size={16} />
            <span>Cadastrar Aluno</span>
          </button>
        </div>
      </div>

      {/* Cascata de Filtros */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-md grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Escola</label>
          <select
            value={selectedEscolaId}
            onChange={(e) => setSelectedEscolaId(e.target.value)}
            className="block w-full rounded-lg border border-slate-600 bg-slate-750 px-3 py-2.5 text-white focus:border-indigo-500 focus:outline-none sm:text-sm"
          >
            {escolas.map((esc) => (
              <option key={esc.id} value={esc.id}>{esc.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Série Base</label>
          <select
            value={selectedSerieId}
            onChange={(e) => setSelectedSerieId(e.target.value)}
            className="block w-full rounded-lg border border-slate-600 bg-slate-750 px-3 py-2.5 text-white focus:border-indigo-500 focus:outline-none sm:text-sm"
          >
            {series.map((ser) => (
              <option key={ser.id} value={ser.id}>{ser.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Turma</label>
          <select
            value={selectedTurmaId}
            onChange={(e) => setSelectedTurmaId(e.target.value)}
            className="block w-full rounded-lg border border-slate-600 bg-slate-750 px-3 py-2.5 text-white focus:border-indigo-500 focus:outline-none sm:text-sm"
          >
            {turmas.length === 0 ? (
              <option value="">Nenhuma turma nesta combinação</option>
            ) : (
              turmas.map((tur) => (
                <option key={tur.id} value={tur.id}>{tur.name} ({tur.year})</option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Lista de Alunos */}
      {!selectedTurmaId ? (
        <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-slate-400">Por favor, selecione uma combinação de Escola, Série e Turma para gerenciar os alunos.</p>
        </div>
      ) : loadingAlunos ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : alunos.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-slate-400">Nenhum aluno cadastrado nesta turma.</p>
        </div>
      ) : (
        <>
          {/* Tabela para Desktop */}
          <div className="hidden md:block overflow-x-auto bg-slate-800 border border-slate-700 rounded-xl shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Código</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Nome Completo</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Nascimento</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Status Login</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {alunos.map((aluno) => (
                  <tr key={aluno.id} className="hover:bg-slate-750/30 transition-colors">
                    <td className="p-4 font-mono text-indigo-400">{aluno.enrollment_code}</td>
                    <td className="p-4 font-semibold text-white">{aluno.full_name}</td>
                    <td className="p-4 text-slate-300">{new Date(aluno.birth_date).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4 text-slate-350">
                      {aluno.auth_user_id ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Credencial Vinculada
                        </span>
                      ) : (
                        <button
                          onClick={() => handleGenerateLogin(aluno)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-850 rounded text-xs font-semibold text-indigo-400 transition-colors"
                        >
                          <Key size={12} />
                          <span>Gerar Login</span>
                        </button>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedAlunoForReadings(aluno)
                          setIsReadingsModalOpen(true)
                        }}
                        className="inline-flex items-center space-x-1 p-2 text-indigo-400 hover:text-white hover:bg-indigo-950/50 rounded-lg transition-colors"
                        title="Ver leituras e em qual página o aluno está"
                      >
                        <BookOpen size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(aluno)}
                        className="inline-flex p-2 text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Editar aluno"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(aluno.id)}
                        className="inline-flex p-2 text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
                        title="Excluir aluno"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards para Mobile */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {alunos.map((aluno) => (
              <div key={aluno.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4 shadow-md">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-indigo-400">{aluno.enrollment_code}</span>
                    <div>
                      {aluno.auth_user_id ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Ativo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950 text-amber-400 border border-amber-800">
                          Sem Login
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="font-bold text-white text-base mt-1">{aluno.full_name}</h3>
                  <p className="text-xs text-slate-450">Nascimento: {new Date(aluno.birth_date).toLocaleDateString('pt-BR')}</p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-700 pt-3">
                  <div>
                    {!aluno.auth_user_id && (
                      <button
                        onClick={() => handleGenerateLogin(aluno)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-850 rounded-lg text-xs font-semibold text-indigo-400 transition-colors"
                      >
                        <Key size={12} />
                        <span>Gerar Login</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedAlunoForReadings(aluno)
                        setIsReadingsModalOpen(true)
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800 rounded-lg text-xs font-semibold text-indigo-400 transition-colors"
                      title="Ver leituras e páginas"
                    >
                      <BookOpen size={12} />
                      <span>Leituras</span>
                    </button>
                    <button
                      onClick={() => openEditModal(aluno)}
                      className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-indigo-405 transition-colors"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(aluno.id)}
                      className="flex items-center space-x-1 px-2.5 py-1.5 bg-red-950/20 hover:bg-red-950/40 rounded-lg text-xs font-semibold text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de Aluno Individual */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative transition-colors duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-450 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingAluno ? 'Editar Aluno' : 'Novo Aluno'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-450 mt-1">Insira as informações do estudante.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Nome do Estudante"
                />
              </div>

              {/* Seleção de Escola e Série */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Escola</label>
                  <select
                    value={modalEscolaId}
                    onChange={(e) => handleModalFilterChange(e.target.value, modalSerieId)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  >
                    {escolas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Série</label>
                  <select
                    value={modalSerieId}
                    onChange={(e) => handleModalFilterChange(modalEscolaId, e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  >
                    {series.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seleção de Turma */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Turma</label>
                <select
                  required
                  value={modalTurmaId}
                  onChange={(e) => setModalTurmaId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                >
                  <option value="">Selecione uma turma...</option>
                  {modalTurmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.year})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Código de Matrícula (Único)</label>
                <input
                  type="text"
                  required
                  value={enrollmentCode}
                  onChange={(e) => setEnrollmentCode(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Ex: MAT482"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Data de Nascimento</label>
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                />
              </div>

              {/* Campo de Senha de Acesso (apenas para cadastro novo) */}
              {!editingAluno && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Senha de Acesso</label>
                  <input
                    type="text"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                    placeholder="Digite a senha de login do aluno"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-1 font-medium">
                    Ao preencher, a conta do aluno será criada e ativada imediatamente com esta senha.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {formLoading && <Loader2 className="animate-spin" size={14} />}
                  <span>{editingAluno ? 'Atualizar' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importação CSV */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setIsCsvModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-xl font-bold text-white">Importar Alunos por CSV</h2>
              <p className="text-xs text-slate-450 mt-1">Carregue um arquivo para importar em lote para esta turma.</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-750 text-xs text-slate-350 space-y-2">
                <p className="font-semibold text-slate-200">Instruções do arquivo:</p>
                <p>O cabeçalho do CSV deve conter exatamente as seguintes colunas:</p>
                <pre className="p-2 bg-slate-950 rounded text-indigo-400 overflow-x-auto">full_name,birth_date,enrollment_code</pre>
                <p>Exemplo de linha:</p>
                <pre className="p-2 bg-slate-950 rounded text-slate-450 overflow-x-auto">Gabriel Silva,2019-10-15,MAT988</pre>
                <p className="text-amber-500 font-semibold">Os alunos importados serão vinculados automaticamente à turma selecionada.</p>
              </div>

              <label className="flex flex-col items-center justify-center border border-dashed border-slate-600 hover:border-slate-500 rounded-xl p-8 cursor-pointer hover:bg-slate-750/30 transition-colors">
                <Upload size={32} className="text-slate-400" />
                <span className="text-sm text-slate-300 mt-2 font-medium">Escolher arquivo CSV</span>
                <span className="text-xs text-slate-500 mt-1">Apenas arquivos .csv</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  disabled={formLoading}
                  className="hidden"
                />
              </label>

              {formLoading && (
                <div className="flex items-center justify-center space-x-2 text-indigo-400 py-2">
                  <Loader2 className="animate-spin" size={16} />
                  <span className="text-xs font-semibold">Processando importação...</span>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2 border border-slate-600 hover:bg-slate-750 rounded-lg text-sm font-semibold text-slate-300 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exibição das Credenciais Geradas */}
      {credentialsModalOpen && generatedCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-800 border border-indigo-500 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
            <div>
              <h2 className="text-xl font-bold text-emerald-400">Credenciais Geradas!</h2>
              <p className="text-xs text-slate-400 mt-1">Guarde estas credenciais. O aluno poderá utilizá-las para fazer login.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-750 space-y-3">
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wider block font-semibold">Nome</span>
                <span className="text-white font-medium">{generatedCreds.name}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wider block font-semibold">Código de Matrícula (Login)</span>
                <span className="text-indigo-400 font-mono font-bold text-lg">{generatedCreds.code}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wider block font-semibold">Senha Temporária</span>
                <span className="text-yellow-400 font-mono font-bold text-lg">{generatedCreds.password}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setCredentialsModalOpen(false)
                  setGeneratedCreds(null)
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Acompanhamento de Leituras do Aluno */}
      <AlunoReadingModal
        isOpen={isReadingsModalOpen}
        onClose={() => {
          setIsReadingsModalOpen(false)
          setSelectedAlunoForReadings(null)
        }}
        student={selectedAlunoForReadings}
      />
    </div>
  )
}
