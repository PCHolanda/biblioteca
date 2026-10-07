import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { School, Layers, GraduationCap, Users, BookOpen } from 'lucide-react'

export const revalidate = 0 // Desativar cache para estatísticas sempre atualizadas

export default async function AdminDashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user?.id).single();
  const clientId = profile?.client_id;

  // Buscar contagens rápidas diretamente do Postgres
  const { count: schoolCount } = await supabase.from('schools').select('*', { count: 'exact', head: true }).eq('client_id', clientId)
  const { count: gradeCount } = await supabase.from('grade_levels').select('*', { count: 'exact', head: true })
  const { count: classCount } = await supabase.from('classes').select('*', { count: 'exact', head: true })
  const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true })
  const { count: bookCount } = await supabase.from('books').select('*', { count: 'exact', head: true })

  const stats = [
    { name: 'Escolas', value: schoolCount || 0, icon: School, href: '/admin/escolas', color: 'bg-blue-600' },
    { name: 'Séries', value: gradeCount || 0, icon: Layers, href: '/admin/series', color: 'bg-emerald-600' },
    { name: 'Turmas', value: classCount || 0, icon: GraduationCap, href: '/admin/turmas', color: 'bg-amber-600' },
    { name: 'Alunos', value: studentCount || 0, icon: Users, href: '/admin/alunos', color: 'bg-purple-600' },
    { name: 'Livros', value: bookCount || 0, icon: BookOpen, href: '/admin/livros', color: 'bg-indigo-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard Administrativo</h1>
        <p className="text-slate-400 mt-2">Visão geral e métricas do sistema da biblioteca digital escolar.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.name} href={stat.href} className="block group">
              <div className="bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-5 transition-all hover:scale-[1.02] shadow-lg flex flex-col items-center text-center">
                <div className={`p-3 rounded-lg ${stat.color} text-white mb-3`}>
                  <Icon size={24} />
                </div>
                <span className="text-2xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                  {stat.value}
                </span>
                <span className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                  {stat.name}
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg mt-8">
        <h2 className="text-xl font-bold text-white mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/admin/leituras" className="flex items-center space-x-4 p-4 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-700/60 transition-colors">
            <div className="p-3 bg-indigo-600 rounded-lg text-white">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Acompanhar Leituras</h3>
              <p className="text-xs text-indigo-300">Identificar em qual página cada aluno parou e seu progresso.</p>
            </div>
          </Link>

          <Link href="/admin/alunos" className="flex items-center space-x-4 p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 transition-colors">
            <div className="p-3 bg-purple-600 rounded-lg text-white">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Importar Alunos</h3>
              <p className="text-xs text-slate-400">Importação em lote de alunos via arquivo CSV.</p>
            </div>
          </Link>

          <Link href="/admin/livros" className="flex items-center space-x-4 p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 transition-colors">
            <div className="p-3 bg-blue-600 rounded-lg text-white">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Cadastrar Livro</h3>
              <p className="text-xs text-slate-400">Enviar novo livro PDF e configurar a recomendação.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
