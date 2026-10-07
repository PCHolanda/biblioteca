'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { School, Plus, Edit2, Trash2, X, Upload, Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function EscolasPage() {
  const [escolas, setEscolas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEscola, setEditingEscola] = useState<any>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  
  // Campos do formulário
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchEscolas()
  }, [])

  const fetchEscolas = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).maybeSingle()
    const activeClientId = profile?.client_id || (user.user_metadata?.client_id as string)
    if (activeClientId) {
      setClientId(activeClientId)
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('client_id', activeClientId)
        .order('name')
      if (data) setEscolas(data)
    }
    setLoading(false)
  }

  const openNewModal = () => {
    setEditingEscola(null)
    setName('')
    setAddress('')
    setContactName('')
    setContactEmail('')
    setLogoFile(null)
    setLogoUrl('')
    setIsModalOpen(true)
  }

  const openEditModal = (escola: any) => {
    setEditingEscola(escola)
    setName(escola.name)
    setAddress(escola.address || '')
    setContactName(escola.contact_name || '')
    setContactEmail(escola.contact_email || '')
    setLogoFile(null)
    setLogoUrl(escola.logo_url || '')
    setIsModalOpen(true)
  }

  const handleUploadLogo = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', 'school-logos')

    const res = await fetch('/api/admin/upload-logo', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao enviar logotipo da escola')
    }

    return data.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      let finalLogoUrl = logoUrl

      if (logoFile) {
        finalLogoUrl = await handleUploadLogo(logoFile)
      }

      let activeClientId = clientId
      if (!activeClientId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).maybeSingle()
          activeClientId = profile?.client_id || (user.user_metadata?.client_id as string)
        }
      }

      const escolaPayload = {
        name,
        address,
        contact_name: contactName,
        contact_email: contactEmail,
        logo_url: finalLogoUrl,
        client_id: activeClientId || null,
      }

      if (editingEscola) {
        const { error } = await supabase
          .from('schools')
          .update(escolaPayload)
          .eq('id', editingEscola.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('schools')
          .insert([escolaPayload])
        if (error) throw error
      }

      setIsModalOpen(false)
      fetchEscolas()
    } catch (error: any) {
      alert('Erro ao salvar escola: ' + error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta escola? Esta ação removerá todas as turmas e alunos vinculados.')) return

    const { error } = await supabase
      .from('schools')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao deletar escola: ' + error.message)
    } else {
      fetchEscolas()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Escolas</h1>
          <p className="text-slate-400 mt-1">Gerencie as escolas cadastradas no sistema.</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Cadastrar Escola</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : escolas.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-slate-400">Nenhuma escola cadastrada.</p>
        </div>
      ) : (
        <>
          {/* Tabela para Desktop */}
          <div className="hidden md:block overflow-x-auto bg-slate-800 border border-slate-700 rounded-xl shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Logo</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Nome</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Endereço</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Contato</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {escolas.map((escola) => (
                  <tr key={escola.id} className="hover:bg-slate-750/30 transition-colors">
                    <td className="p-4">
                      {escola.logo_url ? (
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-650">
                          <Image src={escola.logo_url} alt={escola.name} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400">
                          <School size={20} />
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-white">{escola.name}</td>
                    <td className="p-4 text-slate-300 max-w-xs truncate">{escola.address || '-'}</td>
                    <td className="p-4 text-slate-350">
                      <div className="text-sm">{escola.contact_name || '-'}</div>
                      <div className="text-xs text-slate-500">{escola.contact_email || ''}</div>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(escola)}
                        className="inline-flex p-2 text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(escola.id)}
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
            {escolas.map((escola) => (
              <div key={escola.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4 shadow-md">
                <div className="flex items-center space-x-3">
                  {escola.logo_url ? (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-650">
                      <Image src={escola.logo_url} alt={escola.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400">
                      <School size={24} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-white leading-tight">{escola.name}</h3>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{escola.address || 'Sem endereço'}</p>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-3 text-xs text-slate-300 space-y-1">
                  <div><span className="text-slate-500">Contato:</span> {escola.contact_name || '-'}</div>
                  {escola.contact_email && <div><span className="text-slate-500">E-mail:</span> {escola.contact_email}</div>}
                </div>

                <div className="flex items-center justify-end space-x-2 border-t border-slate-700 pt-3">
                  <button
                    onClick={() => openEditModal(escola)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-indigo-400 transition-colors"
                  >
                    <Edit2 size={14} />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(escola.id)}
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
                {editingEscola ? 'Editar Escola' : 'Nova Escola'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-455 mt-1">Preencha os metadados da instituição.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nome da Escola</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Ex: Escola Mundial"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Endereço</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Ex: Av. Principal, 123"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Contato Responsável</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                    placeholder="Nome"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">E-mail Contato</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                    placeholder="email@escola.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Logo da Escola</label>
                <div className="mt-1 flex items-center space-x-4">
                  {logoUrl && !logoFile && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-650 bg-slate-100 dark:bg-slate-700 flex-shrink-0">
                      <Image src={logoUrl} alt="Logo preview" fill className="object-cover" />
                    </div>
                  )}
                  {logoFile && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-650 bg-slate-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center text-xs text-indigo-650 dark:text-indigo-400 font-semibold truncate">
                      File
                    </div>
                  )}
                  <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750/30 transition-colors">
                    <Upload size={18} className="text-slate-500 dark:text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Carregar Imagem</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setLogoFile(e.target.files[0])
                        }
                      }}
                      className="hidden"
                    />
                  </label>
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
                  <span>{editingEscola ? 'Atualizar' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
