'use client'

import React, { useEffect, useState } from 'react'
import { Trophy, ChevronRight } from 'lucide-react'

interface GamificationBarProps {
  studentId: string
}

interface ProfileData {
  xp: number
  level: number
  streak: number
  badges_count: number
  next_level_xp: number
}

const LEVEL_NAMES: Record<number, string> = {
  1: 'Iniciante',
  2: 'Explorador',
  3: 'Aventureiro',
  4: 'Sábio',
  5: 'Mestre',
  6: 'Lenda da Leitura'
}

const LEVEL_ICONS: Record<number, string> = {
  1: '📖',
  2: '🔍',
  3: '⚔️',
  4: '🧠',
  5: '🎓',
  6: '👑'
}

export default function GamificationBar({ studentId }: GamificationBarProps) {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/gamification/profile?studentId=${studentId}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [studentId])

  if (loading) {
    return (
      <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse h-16 w-full mb-6"></div>
    )
  }

  if (!data) return null

  const levelName = LEVEL_NAMES[data.level] || `Nível ${data.level}`
  const levelIcon = LEVEL_ICONS[data.level] || '⭐'
  const xpPercent = Math.min(100, Math.max(0, (data.xp / (data.next_level_xp || 1)) * 100))

  return (
    <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-amber-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Streak */}
      <div className="flex items-center gap-2">
        {data.streak > 0 ? (
          <>
            <span className="text-xl animate-pulse">🔥</span>
            <span className="font-bold text-amber-600 dark:text-amber-500">{data.streak} dias</span>
          </>
        ) : (
          <>
            <span className="text-xl grayscale opacity-50">🔥</span>
            <span className="text-sm font-medium text-slate-500">Comece hoje!</span>
          </>
        )}
      </div>

      {/* Center - Level & XP */}
      <div className="flex-1 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-1 text-sm">
          <span className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
            {levelIcon} Nv.{data.level} {levelName}
          </span>
          <span className="text-slate-600 dark:text-slate-400 font-medium">
            {data.xp} / {data.next_level_xp} XP
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>

      {/* Right - Badges */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{data.badges_count}</span>
        </div>
        <button className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
