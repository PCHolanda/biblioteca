'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Building2, Plus, Edit2, Trash2, X, Upload, Loader2, Power, PowerOff } from 'lucide-react'
import Image from 'next/image'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<any>(null)
  
  // Campos do formulário
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  
  const [formLoading, setFormLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchClientes()
  }, [])

  const fetchClientes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name')
    if (data) setClientes(data)
    setLoading(false)
  }

  const openNewModal = () => {
    setEditingCliente(null)
    setName('')
    setContactName('')
    setContactEmail('')
    setLogoFile(null)
    setLogoUrl('')
    setUsername('')
    setPassword('')
    setIsModalOpen(true)
  }

  const openEditModal = (cliente: any) => {
    setEditingCliente(cliente)
    setName(cliente.name)
    setContactName(cliente.contact_name || '')
    setContactEmail(cliente.contact_email || '')
    setLogoFile(null)
    setLogoUrl(cliente.logo_url || '')
    setIsModalOpen(true)
  }

  const handleUploadLogo = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', 'client-logos')

    const res = await fetch('/api/admin/upload-logo', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao enviar logotipo do cliente')
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

      const clientePayload = {
        name,
        contact_name: contactName,
        contact_email: contactEmail,
        logo_url: finalLogoUrl,
      }

      if (editingCliente) {
        const { error } = await supabase
          .from('clients')
          .update(clientePayload)
          .eq('id', editingCliente.id)
        if (error) throw error
      } else {
        if (!username || !password) {
          throw new Error("Login e Senha são obrigatórios para novos clientes.")
        }

        const { data, error } = await supabase
          .from('clients')
          .insert([{ ...clientePayload, status: 'active' }])
          .select()
          .single()
          
        if (error) throw error
        
        if (data) {
          const res = await fetch('/api/superadmin/create-client-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: data.id,
              username,
              password,
              displayName: name
            })
          })
          
          if (!res.ok) {
            const errData = await res.json()
            throw new Error(errData.error || "Erro ao criar autenticação do cliente.")
          }
        }
      }

      setIsModalOpen(false)
      fetchClientes()
    } catch (error: any) {
      alert('Erro ao salvar cliente: ' + error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const toggleStatus = async (cliente: any) => {
    const newStatus = cliente.status === 'active' ? 'suspended' : 'active'
    if (!confirm(`Deseja realmente ${newStatus === 'active' ? 'ativar' : 'suspender'} este cliente?`)) return

    const { error } = await supabase
      .from('clients')
      .update({ status: newStatus })
      .eq('id', cliente.id)

    if (error) {
      alert('Erro ao alterar status: ' + error.message)
    } else {
      fetchClientes()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Clientes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gerencie os clientes (redes de ensino/escolas) do sistema.</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Cadastrar Cliente</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
          <p className="text-slate-500 dark:text-slate-400">Nenhum cliente cadastrado.</p>
        </div>
      ) : (
        <>
          {/* Tabela para Desktop */}
          <div className="hidden md:block overflow-x-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Logo</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nome</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contato</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/30 transition-colors">
                    <td className="p-4">
                      {cliente.logo_url ? (
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-650">
                          <Image src={cliente.logo_url} alt={cliente.name} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                          <Building2 size={20} />
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-slate-900 dark:text-white">{cliente.name}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-350">
                      <div className="text-sm">{cliente.contact_name || '-'}</div>
                      <div className="text-xs text-slate-500">{cliente.contact_email || ''}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cliente.status === 'active' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-400' 
                          : 'bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-400'
                      }`}>
                        {cliente.status === 'active' ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(cliente)}
                        className="inline-flex p-2 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => toggleStatus(cliente)}
                        className={`inline-flex p-2 rounded-lg transition-colors ${
                          cliente.status === 'active'
                            ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20'
                        }`}
                        title={cliente.status === 'active' ? 'Suspender' : 'Ativar'}
                      >
                        {cliente.status === 'active' ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards para Mobile */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {clientes.map((cliente) => (
              <div key={cliente.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 shadow-md">
                <div className="flex items-center space-x-3">
                  {cliente.logo_url ? (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-650">
                      <Image src={cliente.logo_url} alt={cliente.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                      <Building2 size={24} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{cliente.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium ${
                      cliente.status === 'active' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-400' 
                        : 'bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-400'
                    }`}>
                      {cliente.status === 'active' ? 'Ativo' : 'Suspenso'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  <div><span className="text-slate-500">Contato:</span> {cliente.contact_name || '-'}</div>
                  {cliente.contact_email && <div><span className="text-slate-500">E-mail:</span> {cliente.contact_email}</div>}
                </div>

                <div className="flex items-center justify-end space-x-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                  <button
                    onClick={() => openEditModal(cliente)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 transition-colors"
                  >
                    <Edit2 size={14} />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => toggleStatus(cliente)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      cliente.status === 'active'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                    }`}
                  >
                    {cliente.status === 'active' ? <PowerOff size={14} /> : <Power size={14} />}
                    <span>{cliente.status === 'active' ? 'Suspender' : 'Ativar'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de Cadastro / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative transition-colors duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {editingCliente ? 'Atualize as informações do cliente.' : 'Preencha os dados do novo cliente.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nome do Cliente</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                  placeholder="Ex: Rede Ensino x"
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

              {!editingCliente && (
                <div className="grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                  <div className="col-span-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Credenciais de Acesso</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Estas credenciais serão usadas pelo cliente para acessar o painel.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Login (Username)</label>
                    <input
                      type="text"
                      required={!editingCliente}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                      placeholder="Login"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Senha</label>
                    <input
                      type="password"
                      required={!editingCliente}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Logo da Escola</label>
                <div className="mt-1 flex items-center space-x-4">
                  {logoUrl && !logoFile && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-650 bg-slate-100 dark:bg-slate-700 flex-shrink-0">
                      <Image src={logoUrl} alt="Logo preview" fill className="object-cover" />
                    </div>
                  )}
                  {logoFile && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-650 bg-slate-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center text-xs text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                      File
                    </div>
                  )}
                  <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750/30 transition-colors">
                    <Upload size={18} className="text-slate-400 dark:text-slate-500" />
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
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {formLoading && <Loader2 className="animate-spin" size={14} />}
                  <span>{editingCliente ? 'Atualizar' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
