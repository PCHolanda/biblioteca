'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Layers, Plus, Edit2, Trash2, X, Loader2, ArrowUpDown } from 'lucide-react'

export default function SeriesPage() {
  const [series, setSeries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSerie, setEditingSerie] = useState<any>(null)

  // Campos do formulário
  const [name, setName] = useState('')
  const [orderIndex, setOrderIndex] = useState('1')
  const [defaultAgeMin, setDefaultAgeMin] = useState('6')
  const [defaultAgeMax, setDefaultAgeMax] = useState('7')
  const [formLoading, setFormLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchSeries()
  }, [])

  const fetchSeries = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('grade_levels')
      .select('*')
      .order('order_index')
    if (data) setSeries(data)
    setLoading(false)
  }

  const openNewModal = () => {
    setEditingSerie(null)
    setName('')
    setOrderIndex(String(series.length + 1))
    setDefaultAgeMin('6')
    setDefaultAgeMax('7')
    setIsModalOpen(true)
  }

  const openEditModal = (serie: any) => {
    setEditingSerie(serie)
    setName(serie.name)
    setOrderIndex(String(serie.order_index))
    setDefaultAgeMin(String(serie.default_age_min))
    setDefaultAgeMax(String(serie.default_age_max))
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const seriePayload = {
        name,
        order_index: parseInt(orderIndex, 10),
        default_age_min: parseInt(defaultAgeMin, 10),
        default_age_max: parseInt(defaultAgeMax, 10),
      }

      if (editingSerie) {
        const { error } = await supabase
          .from('grade_levels')
          .update(seriePayload)
          .eq('id', editingSerie.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('grade_levels')
          .insert([seriePayload])
        if (error) throw error
      }

      setIsModalOpen(false)
      fetchSeries()
    } catch (error: any) {
      alert('Erro ao salvar série: ' + error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta série? Esta ação pode impactar a elegibilidade de livros e turmas associadas.')) return

    const { error } = await supabase
      .from('grade_levels')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao deletar série: ' + error.message)
    } else {
      fetchSeries()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Séries / Anos Escolares</h1>
          <p className="text-slate-400 mt-1">Gerencie os anos escolares globais e suas faixas etárias recomendadas.</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Cadastrar Série</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : series.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-slate-400">Nenhuma série cadastrada.</p>
        </div>
      ) : (
        <>
          {/* Tabela para Desktop */}
          <div className="hidden md:block overflow-x-auto bg-slate-800 border border-slate-700 rounded-xl shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Índice Ordinal</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Identificação</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Idade Mínima Padrão</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Idade Máxima Padrão</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {series.map((serie) => (
                  <tr key={serie.id} className="hover:bg-slate-750/30 transition-colors">
                    <td className="p-4 font-mono text-slate-450">{serie.order_index}º</td>
                    <td className="p-4 font-semibold text-white">{serie.name}</td>
                    <td className="p-4 text-slate-300">{serie.default_age_min} anos</td>
                    <td className="p-4 text-slate-300">{serie.default_age_max} anos</td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(serie)}
                        className="inline-flex p-2 text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(serie.id)}
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
            {series.map((serie) => (
              <div key={serie.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-mono">
                      {serie.order_index}º
                    </div>
                    <h3 className="font-bold text-white leading-tight">{serie.name}</h3>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-3 text-xs text-slate-300 grid grid-cols-2 gap-2">
                  <div><span className="text-slate-500 block">Idade Mínima:</span> {serie.default_age_min} anos</div>
                  <div><span className="text-slate-500 block">Idade Máxima:</span> {serie.default_age_max} anos</div>
                </div>

                <div className="flex items-center justify-end space-x-2 border-t border-slate-700 pt-3">
                  <button
                    onClick={() => openEditModal(serie)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-indigo-400 transition-colors"
                  >
                    <Edit2 size={14} />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(serie.id)}
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
                {editingSerie ? 'Editar Série' : 'Nova Série'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-455 mt-1">Defina o nome e as idades recomendadas.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Identificação da Série</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Ex: 3º ano"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Índice de Ordenação (Ordem Visual)</label>
                <input
                  type="number"
                  required
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Ex: 3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Idade Mínima Padrão</label>
                  <input
                    type="number"
                    required
                    value={defaultAgeMin}
                    onChange={(e) => setDefaultAgeMin(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                    placeholder="Ex: 8"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Idade Máxima Padrão</label>
                  <input
                    type="number"
                    required
                    value={defaultAgeMax}
                    onChange={(e) => setDefaultAgeMax(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                    placeholder="Ex: 9"
                  />
                </div>
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
                  <span>{editingSerie ? 'Atualizar' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
