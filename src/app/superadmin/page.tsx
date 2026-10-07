import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Building, School, Users } from 'lucide-react'

export const revalidate = 0 // Desativar cache para estatísticas sempre atualizadas

export default async function SuperAdminDashboardPage() {
  const supabase = createClient()

  const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true })
  const { count: schoolCount } = await supabase.from('schools').select('*', { count: 'exact', head: true })
  const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true })

  const stats = [
    { name: 'Clientes', value: clientCount || 0, icon: Building, href: '/superadmin/clientes', color: 'bg-emerald-600' },
    { name: 'Escolas', value: schoolCount || 0, icon: School, href: '#', color: 'bg-blue-600' },
    { name: 'Alunos', value: studentCount || 0, icon: Users, href: '#', color: 'bg-purple-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard Super Admin</h1>
        <p className="text-slate-400 mt-2">Visão geral e métricas gerais do sistema (todos os clientes).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/superadmin/clientes" className="flex items-center space-x-4 p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 transition-colors">
            <div className="p-3 bg-emerald-600 rounded-lg text-white">
              <Building size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Gerenciar Clientes</h3>
              <p className="text-xs text-slate-400">Criar ou editar clientes e seus acessos admin.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
