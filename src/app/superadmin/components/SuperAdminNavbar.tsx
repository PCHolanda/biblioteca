'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Building, LogOut, Menu, X, LayoutDashboard } from 'lucide-react'
import ThemeToggle from '../../components/ThemeToggle'

interface SuperAdminNavbarProps {
  profile: any
}

export default function SuperAdminNavbar({ profile }: SuperAdminNavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  const menuItems = [
    { name: 'Dashboard', href: '/superadmin', icon: LayoutDashboard },
    { name: 'Clientes', href: '/superadmin/clientes', icon: Building },
  ]

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="flex md:hidden items-center justify-between bg-slate-950 p-4 border-b border-slate-800 text-white sticky top-0 z-50 w-full">
        <span className="font-bold text-lg text-indigo-400">Painel Super Admin</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-400 hover:text-white focus:outline-none"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6">
          <div className="hidden md:block mb-8">
            <h1 className="font-bold text-xl text-indigo-400">Biblioteca Escolar</h1>
            <p className="text-xs text-slate-500 mt-1">Painel Super Administrador</p>
          </div>

          <div className="mb-6 pb-6 border-b border-slate-800 flex items-center justify-between">
            <div className="truncate mr-2">
              <p className="text-sm font-semibold text-white truncate">{profile?.display_name || 'Super Admin'}</p>
              <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
            </div>
            <ThemeToggle />
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/') && item.href !== '/superadmin' || pathname === item.href && item.href === '/superadmin'
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="p-6 border-t border-slate-800">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Overlay for Mobile Drawer */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}
    </>
  )
}
