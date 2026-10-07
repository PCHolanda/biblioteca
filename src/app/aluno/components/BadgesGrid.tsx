'use client'

import React, { useState } from 'react'
import { Lock } from 'lucide-react'

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  category: string
  condition_type: string
  condition_value: number
  is_secret: boolean
  unlocked?: boolean
  unlocked_at?: string
}

interface BadgesGridProps {
  allBadges: Badge[]
  unlockedBadgeIds: string[]
}

export default function BadgesGrid({ allBadges, unlockedBadgeIds }: BadgesGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const badges = allBadges.map(badge => ({
    ...badge,
    unlocked: unlockedBadgeIds.includes(badge.id)
  }))

  const unlockedCount = badges.filter(b => b.unlocked).length
  const totalCount = badges.length

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">🏅 Conquistas</h3>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
          {unlockedCount}/{totalCount} desbloqueadas
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {badges.map((badge) => {
          const isUnlocked = badge.unlocked
          const isSecretLocked = !isUnlocked && badge.is_secret

          if (isSecretLocked) {
            return (
              <div 
                key={badge.id}
                className="aspect-square bg-slate-200 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl flex flex-col items-center justify-center p-2 relative group"
              >
                <span className="text-3xl text-slate-400 dark:text-slate-600 mb-1">?</span>
                <span className="text-[10px] text-center font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Badge Secreto</span>
              </div>
            )
          }

          return (
            <div 
              key={badge.id}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 relative transition-all duration-200
                ${isUnlocked 
                  ? 'bg-white dark:bg-slate-800 border-2 border-indigo-300 dark:border-indigo-700 shadow-md hover:shadow-lg hover:-translate-y-1 hover:border-indigo-400' 
                  : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 opacity-60'}
              `}
              onMouseEnter={() => setHoveredId(badge.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="text-4xl mb-2 relative">
                {badge.icon || '🏆'}
                {!isUnlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50 dark:bg-slate-900/50 rounded-full backdrop-blur-[1px]">
                    <Lock className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                  </div>
                )}
              </div>
              <span className={`text-xs text-center font-bold leading-tight line-clamp-2
                ${isUnlocked ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                {badge.name}
              </span>

              {/* Tooltip */}
              {hoveredId === badge.id && (
                <div className="absolute z-10 -top-2 left-1/2 -translate-x-1/2 -translate-y-full w-48 bg-slate-800 text-white text-xs p-3 rounded-xl shadow-xl pointer-events-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-800">
                  <div className="font-bold mb-1 text-sm">{badge.name}</div>
                  <div className="text-slate-300">{badge.description}</div>
                  {!isUnlocked && (
                    <div className="mt-2 pt-2 border-t border-slate-600 text-amber-300 font-medium">
                      💡 Dica: Continue explorando para desbloquear.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
