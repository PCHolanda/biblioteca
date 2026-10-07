'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const email = identifier.trim().toLowerCase()
    let authData = null
    let signInError = null

    if (email.includes('@')) {
      // Se tem @, tenta logar direto com o email fornecido
      const res = await supabase.auth.signInWithPassword({ email, password })
      authData = res.data
      signInError = res.error
    } else {
      // Se não tem @, tenta logar como aluno, depois cliente, depois professor
      const suffixes = ['@biblioteca.escolar', '@biblioteca.admin', '@biblioteca.professor']
      
      for (const suffix of suffixes) {
        const attemptEmail = `${email}${suffix}`
        const res = await supabase.auth.signInWithPassword({ email: attemptEmail, password })
        
        if (res.data?.user) {
          authData = res.data
          signInError = null
          break
        } else {
          signInError = res.error
        }
      }
    }

    if (signInError || !authData?.user) {
      setError(signInError?.message || 'Erro ao realizar login')
      setLoading(false)
      return
    }

    // Buscar perfil do usuário para redirecionar de forma robusta no cliente
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle()

    // Papel identificado pelo perfil ou pelos metadados do auth
    const role = profile?.role || (authData.user.user_metadata?.role as string)

    if (!role) {
      setError('Perfil de usuário não encontrado no banco de dados.')
      setLoading(false)
      return
    }

    router.refresh()
    
    if (role === 'superadmin') {
      router.push('/superadmin')
    } else if (role === 'admin' || role === 'client') {
      router.push('/admin')
    } else if (role === 'teacher') {
      router.push('/professor')
    } else {
      router.push('/aluno')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white dark:bg-slate-800 p-8 border border-slate-200 dark:border-slate-700 shadow-2xl transition-colors duration-200">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Biblioteca Digital</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Escolas e Alunos</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 p-4 text-sm text-red-650 dark:text-red-200">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Matrícula ou E-mail
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-3 text-slate-900 dark:text-white placeholder-slate-450 dark:placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm transition-colors"
                placeholder="Ex: MAT001 ou admin@escola.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-3 text-slate-900 dark:text-white placeholder-slate-455 dark:placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm transition-colors"
                placeholder="Sua senha secreta"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg border border-transparent bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar na Biblioteca'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
