'use client'

import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-300 dark:border-slate-700"
      title={theme === 'light' ? 'Ativar Tema Escuro' : 'Ativar Tema Claro'}
    >
      {theme === 'light' ? (
        <Moon size={18} className="text-slate-700" />
      ) : (
        <Sun size={18} className="text-amber-400" />
      )}
    </button>
  )
}
