'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { BookMarked, Heart, History, LogOut, Users } from 'lucide-react'

export default function AlunoNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    if (confirm('Deseja realmente sair da biblioteca?')) {
      await supabase.auth.signOut()
      router.refresh()
      router.push('/login')
    }
  }

  const navItems = [
    { name: 'Estante', href: '/aluno', icon: BookMarked },
    { name: 'Clubes', href: '/aluno/clubes', icon: Users },
    { name: 'Favoritos', href: '/aluno/favoritos', icon: Heart },
    { name: 'Progresso', href: '/aluno/progresso', icon: History },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-md md:rounded-full md:max-w-xl md:mx-auto md:bottom-5 md:border md:shadow-2xl z-40 transition-all duration-300">
      <div className="flex justify-between items-center py-2 px-3 md:px-5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center space-y-0.5 text-[11px] md:text-xs font-semibold px-2.5 sm:px-4 py-1.5 rounded-xl transition-all ${
                isActive
                  ? 'text-indigo-400 bg-indigo-950/60 md:bg-indigo-950/70 scale-[1.05]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Icon size={18} className="md:w-5 md:h-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}

        <button
          onClick={handleSignOut}
          className="flex flex-col items-center justify-center space-y-0.5 text-[11px] md:text-xs font-semibold px-2.5 sm:px-4 py-1.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors"
        >
          <LogOut size={18} className="md:w-5 md:h-5" />
          <span>Sair</span>
        </button>
      </div>
    </nav>
  )
}
