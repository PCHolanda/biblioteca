'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { GraduationCap, Plus, Edit2, Trash2, X, Loader2 } from 'lucide-react'

export default function TurmasPage() {
  const [turmas, setTurmas] = useState<any[]>([])
  const [escolas, setEscolas] = useState<any[]>([])
  const [series, setSeries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTurma, setEditingTurma] = useState<any>(null)

  // Campos do formulário
  const [schoolId, setSchoolId] = useState('')
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [name, setName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [formLoading, setFormLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).single()

    // Buscar escolas
    const { data: schoolsData } = await supabase
      .from('schools')
      .select('id, name')
      .eq('client_id', profile?.client_id)
      .order('name')

    // Buscar séries
    const { data: gradesData } = await supabase
      .from('grade_levels')
      .select('id, name')
      .order('order_index')

    if (schoolsData) setEscolas(schoolsData)
    if (gradesData) setSeries(gradesData)

    await fetchTurmas()
    setLoading(false)
  }

  const fetchTurmas = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        schools (name),
        grade_levels (name)
      `)
      .order('year', { ascending: false })
      .order('name')
    if (data) setTurmas(data)
  }

  const openNewModal = () => {
    setEditingTurma(null)
    setSchoolId(escolas[0]?.id || '')
    setGradeLevelId(series[0]?.id || '')
    setName('')
    setYear(new Date().getFullYear().toString())
    setIsModalOpen(true)
  }

  const openEditModal = (turma: any) => {
    setEditingTurma(turma)
    setSchoolId(turma.school_id)
    setGradeLevelId(turma.grade_level_id)
    setName(turma.name)
    setYear(String(turma.year))
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const turmaPayload = {
        school_id: schoolId,
        grade_level_id: gradeLevelId,
        name,
        year: parseInt(year, 10),
      }

      if (editingTurma) {
        const { error } = await supabase
          .from('classes')
          .update(turmaPayload)
          .eq('id', editingTurma.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('classes')
          .insert([turmaPayload])
        if (error) throw error
      }

      setIsModalOpen(false)
      fetchTurmas()
    } catch (error: any) {
      alert('Erro ao salvar turma: ' + error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta turma? Alunos vinculados a ela serão impactados.')) return

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao deletar turma: ' + error.message)
    } else {
      fetchTurmas()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Turmas</h1>
          <p className="text-slate-400 mt-1">Gerencie as turmas ativas de cada escola.</p>
        </div>
        <button
          onClick={openNewModal}
          disabled={escolas.length === 0 || series.length === 0}
          className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto disabled:bg-slate-700 disabled:text-slate-500"
        >
          <Plus size={16} />
          <span>Cadastrar Turma</span>
        </button>
      </div>

      {escolas.length === 0 || series.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-slate-400">
            Você precisa cadastrar pelo menos uma **Escola** e uma **Série** antes de cadastrar uma turma.
          </p>
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : turmas.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-slate-400">Nenhuma turma cadastrada.</p>
        </div>
      ) : (
        <>
          {/* Tabela para Desktop */}
          <div className="hidden md:block overflow-x-auto bg-slate-800 border border-slate-700 rounded-xl shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Escola</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Série Base</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Identificação</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Ano Letivo</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {turmas.map((turma) => (
                  <tr key={turma.id} className="hover:bg-slate-750/30 transition-colors">
                    <td className="p-4 font-semibold text-white">{(turma.schools as any)?.name}</td>
                    <td className="p-4 text-slate-300">{(turma.grade_levels as any)?.name}</td>
                    <td className="p-4 text-indigo-400 font-medium">{turma.name}</td>
                    <td className="p-4 text-slate-350">{turma.year}</td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(turma)}
                        className="inline-flex p-2 text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(turma.id)}
                        className="inline-flex p-2 text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
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
            {turmas.map((turma) => (
              <div key={turma.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4 shadow-md">
                <div>
                  <h3 className="font-bold text-white text-lg leading-tight">{turma.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{(turma.schools as any)?.name}</p>
                </div>

                <div className="border-t border-slate-700 pt-3 text-xs text-slate-300 grid grid-cols-2 gap-2">
                  <div><span className="text-slate-500 block">Série Recomendada:</span> {(turma.grade_levels as any)?.name}</div>
                  <div><span className="text-slate-500 block">Ano Letivo:</span> {turma.year}</div>
                </div>

                <div className="flex items-center justify-end space-x-2 border-t border-slate-700 pt-3">
                  <button
                    onClick={() => openEditModal(turma)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-indigo-400 transition-colors"
                  >
                    <Edit2 size={14} />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(turma.id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 rounded-lg text-xs font-semibold text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de Cadastro / Edição */}
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
                {editingTurma ? 'Editar Turma' : 'Nova Turma'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-455 mt-1">Preencha as informações para organizar a turma.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Escola</label>
                <select
                  required
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                >
                  {escolas.map((esc) => (
                    <option key={esc.id} value={esc.id}>
                      {esc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Série Base</label>
                <select
                  required
                  value={gradeLevelId}
                  onChange={(e) => setGradeLevelId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                >
                  {series.map((ser) => (
                    <option key={ser.id} value={ser.id}>
                      {ser.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nome da Turma</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Ex: 3º ano B"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Ano Letivo</label>
                <input
                  type="number"
                  required
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Ex: 2026"
                />
              </div>

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
                  <span>{editingTurma ? 'Atualizar' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
