import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AlunoNavbar from './components/AlunoNavbar'
import ThemeToggle from '../components/ThemeToggle'

export default async function AlunoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: student } = await supabase
    .from('students')
    .select(`
      *,
      classes (
        name,
        schools (name)
      )
    `)
    .eq('auth_user_id', user.id)
    .single()

  if (!student) {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* Top Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 py-4 px-6 sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg text-indigo-650 dark:text-indigo-400">Biblioteca Digital</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px] sm:max-w-none">
              {(student.classes as any)?.schools?.name} • {(student.classes as any)?.name}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-slate-600 dark:text-slate-300 font-semibold hidden sm:inline">
              Olá, {student.full_name}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Área de Conteúdo Principal com espaço seguro para o menu flutuante */}
      <main className="flex-1 pb-32 md:pb-36 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Menu Inferior do Aluno */}
      <AlunoNavbar />
    </div>
  )
}
