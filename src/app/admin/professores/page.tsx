'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Users, Plus, Edit2, Trash2, X, Loader2, Key } from 'lucide-react'

export default function ProfessoresPage() {
  // Dados de apoio
  const [escolas, setEscolas] = useState<any[]>([])
  const [series, setSeries] = useState<any[]>([])
  const [turmas, setTurmas] = useState<any[]>([])
  const [professores, setProfessores] = useState<any[]>([])

  // Filtros de busca/cabeçalho
  const [selectedEscolaId, setSelectedEscolaId] = useState('')
  
  // Estados operacionais
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingProfs, setLoadingProfs] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProf, setEditingProf] = useState<any>(null)

  // Campos do formulário
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Seleções dentro do modal
  const [modalEscolaId, setModalEscolaId] = useState('')
  const [modalSerieId, setModalSerieId] = useState('')
  const [modalTurmaId, setModalTurmaId] = useState('')
  const [modalTurmas, setModalTurmas] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchInitialFilters()
  }, [])

  useEffect(() => {
    fetchProfessores()
  }, [selectedEscolaId])

  const fetchInitialFilters = async () => {
    setLoadingInitial(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingInitial(false); return; }
    const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).single()

    const { data: schools } = await supabase.from('schools').select('id, name').eq('client_id', profile?.client_id).order('name')
    const { data: grades } = await supabase.from('grade_levels').select('id, name').order('order_index')

    if (schools) {
      setEscolas(schools)
      if (schools.length > 0) {
        setSelectedEscolaId(schools[0].id)
      }
    }
    if (grades) {
      setSeries(grades)
    }
    setLoadingInitial(false)
  }

  const fetchProfessores = async () => {
    if (!selectedEscolaId) return
    setLoadingProfs(true)
    const { data, error } = await supabase
      .from('teachers')
      .select(`
        *,
        schools (id, name),
        grade_levels (id, name),
        classes (id, name, year)
      `)
      .eq('school_id', selectedEscolaId)
      .order('full_name')

    if (error) {
      console.error('Erro ao buscar professores:', error.message)
    } else if (data) {
      setProfessores(data)
    }
    setLoadingProfs(false)
  }

  // Monitora alterações de Escola e Série dentro do modal para buscar as Turmas
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
    setEditingProf(null)
    setFullName('')
    setUsername('')
    setPassword('')
    setModalEscolaId(selectedEscolaId)
    setModalSerieId(series.length > 0 ? series[0].id : '')
    setModalTurmaId('')
    setModalTurmas([])

    if (selectedEscolaId && series.length > 0) {
      handleModalFilterChange(selectedEscolaId, series[0].id)
    }
    setIsModalOpen(true)
  }

  const openEditModal = async (prof: any) => {
    setEditingProf(prof)
    setFullName(prof.full_name)
    setUsername('') // Não exibe login na edição por segurança
    setPassword('')

    setModalEscolaId(prof.school_id)
    setModalSerieId(prof.grade_level_id)
    setModalTurmaId(prof.class_id)

    // Buscar turmas específicas para o modal
    const { data } = await supabase
      .from('classes')
      .select('id, name, year')
      .eq('school_id', prof.school_id)
      .eq('grade_level_id', prof.grade_level_id)
      .order('name')

    if (data) {
      setModalTurmas(data)
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      if (!modalEscolaId || !modalSerieId || !modalTurmaId) {
        throw new Error('Por favor, selecione escola, série e turma válidas.')
      }

      const profPayload = {
        full_name: fullName,
        school_id: modalEscolaId,
        grade_level_id: modalSerieId,
        class_id: modalTurmaId,
      }

      let teacherId = ''

      if (editingProf) {
        const { error } = await supabase
          .from('teachers')
          .update(profPayload)
          .eq('id', editingProf.id)

        if (error) throw error
        teacherId = editingProf.id
        alert('Professor atualizado com sucesso!')
      } else {
        // Exige usuário e senha na criação
        if (!username.trim() || !password.trim()) {
          throw new Error('Para novos professores, o usuário de acesso e senha são obrigatórios.')
        }

        const { data, error } = await supabase
          .from('teachers')
          .insert([profPayload])
          .select('id')
          .single()

        if (error) throw error
        teacherId = data.id

        // Criar conta de autenticação via API administrativa
        const res = await fetch('/api/admin/create-teacher-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacherId,
            username: username.trim().toLowerCase(),
            password: password.trim(),
            displayName: fullName
          })
        })

        const authData = await res.json()
        if (!res.ok) {
          // Reverter a inserção do professor no banco de dados para evitar órfãos
          await supabase.from('teachers').delete().eq('id', teacherId)
          throw new Error(authData.error || 'Erro ao gerar login de acesso')
        }

        alert(`Professor cadastrado com sucesso!\nLogin: ${username.trim().toLowerCase()}@biblioteca.professor\nSenha: ${password.trim()}`)
      }

      setIsModalOpen(false)
      fetchProfessores()
    } catch (err: any) {
      alert('Erro ao salvar professor: ' + err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este professor? Todas as vinculações de acesso associadas serão perdidas.')) return

    try {
      const { error } = await supabase.from('teachers').delete().eq('id', id)
      if (error) throw error
      alert('Professor excluído com sucesso!')
      fetchProfessores()
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  if (loadingInitial) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Users className="text-indigo-600" size={24} />
            <span>Gerenciamento de Professores</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Cadastre professores e vincule-os às suas respectivas escolas, séries e turmas.
          </p>
        </div>

        <button
          onClick={openNewModal}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95"
        >
          <Plus size={16} />
          <span>Cadastrar Professor</span>
        </button>
      </div>

      {/* Barra de Filtros no Topo */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 transition-colors duration-200">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Filtrar por Escola</label>
          <select
            value={selectedEscolaId}
            onChange={(e) => setSelectedEscolaId(e.target.value)}
            className="block w-full sm:w-72 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
          >
            {escolas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Listagem de Professores */}
      {loadingProfs ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : professores.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 transition-colors">
          <p className="text-sm text-slate-500 dark:text-slate-450">Nenhum professor cadastrado para esta escola.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {professores.map((prof) => (
            <div
              key={prof.id}
              className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all duration-200"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                    {prof.full_name}
                  </h3>
                  {!prof.auth_user_id && (
                    <span className="text-[9px] px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded-full font-bold uppercase">
                      Sem Login
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-450 mt-1">
                  🏫 Escola: <span className="font-semibold text-slate-750 dark:text-slate-300">{prof.schools?.name}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">
                  📚 Série: <span className="font-semibold text-slate-750 dark:text-slate-300">{prof.grade_levels?.name}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">
                  👥 Turma: <span className="font-semibold text-slate-750 dark:text-slate-300">{prof.classes?.name || 'Não definida'}</span>
                </p>
                {prof.email && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-750/50 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60 font-mono">
                    🔑 Login: <span className="font-bold text-indigo-600 dark:text-indigo-400">{prof.email}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  onClick={() => openEditModal(prof)}
                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/45 hover:bg-indigo-100 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Edit2 size={12} />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(prof.id)}
                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950 text-red-650 dark:text-red-400 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Professor */}
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
                {editingProf ? 'Editar Professor' : 'Novo Professor'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-450 mt-1">Preencha as informações cadastrais e vinculação.</p>
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
                  placeholder="Nome do Professor"
                />
              </div>

              {/* Escola e Série */}
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
                    <option value="">Selecione...</option>
                    {series.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Turma */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Turma Vinculada</label>
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

              {/* Credenciais de Acesso (Apenas para novos professores) */}
              {!editingProf && (
                <div className="bg-slate-50 dark:bg-slate-750 p-4 rounded-xl border border-slate-200 dark:border-slate-650 space-y-3">
                  <div className="flex items-center space-x-2 text-slate-800 dark:text-white">
                    <Key size={14} className="text-indigo-500" />
                    <span className="text-xs font-bold uppercase tracking-wide">Credenciais de Acesso</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-400 mb-0.5">Usuário (ex: prof1)</label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors text-xs"
                        placeholder="Ex: prof.paulo"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-400 mb-0.5">Senha</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors text-xs"
                        placeholder="Mínimo 6 chars"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    O e-mail final de login do professor será: <span className="font-semibold text-slate-700 dark:text-indigo-400 font-mono">{username ? username : 'usuario'}@biblioteca.professor</span>
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-350 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-650 text-white rounded-xl text-xs font-bold transition-all"
                >
                  {formLoading && <Loader2 className="animate-spin" size={12} />}
                  <span>{editingProf ? 'Salvar Alterações' : 'Salvar Professor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
