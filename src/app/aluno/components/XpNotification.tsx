'use client'

import React, { useEffect, useState } from 'react'
import { Star, Sparkles } from 'lucide-react'

interface BadgeInfo {
  name: string
  icon: string
  description: string
}

interface XpNotificationProps {
  xpAmount: number
  reason: string
  leveledUp?: boolean
  newLevel?: number
  newLevelName?: string
  badgesUnlocked?: BadgeInfo[]
  onDismiss: () => void
}

const REASON_LABELS: Record<string, string> = {
  page_read: 'Leitura',
  book_complete: 'Livro Completo!',
  quiz_pass: 'Quiz Aprovado!',
  quiz_perfect: 'Quiz Perfeito!',
  streak_bonus: 'Bônus de Sequência!',
  badge_reward: 'Conquista!'
}

export default function XpNotification({
  xpAmount,
  reason,
  leveledUp,
  newLevel,
  newLevelName,
  badgesUnlocked = [],
  onDismiss
}: XpNotificationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Animate in
    setTimeout(() => setVisible(true), 50)

    const isComplex = leveledUp || badgesUnlocked.length > 0
    const duration = isComplex ? 6000 : 4000

    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300) // wait for animation
    }, duration)

    return () => clearTimeout(timer)
  }, [leveledUp, badgesUnlocked.length, onDismiss])

  const reasonLabel = REASON_LABELS[reason] || reason

  if (leveledUp) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 max-w-sm w-full text-center text-white shadow-2xl border-4 border-indigo-400 transition-all duration-500 transform ${visible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-10'}`}>
          <div className="relative inline-block mb-4">
            <span className="text-6xl">🎉</span>
            <div className="absolute -top-4 -right-4 animate-spin-slow">
              <Sparkles className="w-8 h-8 text-yellow-300" />
            </div>
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">Subiu de Nível!</h2>
          <div className="text-indigo-200 font-medium mb-6">
            Você agora é um <span className="text-white font-bold">{newLevelName}</span> (Nv.{newLevel})
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl py-3 px-6 inline-block font-bold text-xl">
            +{xpAmount} XP
          </div>
        </div>
      </div>
    )
  }

  if (badgesUnlocked.length > 0) {
    return (
      <div className={`fixed bottom-8 right-8 z-50 transition-all duration-500 transform ${visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-slate-800 dark:to-slate-800 rounded-2xl p-4 shadow-xl border-2 border-yellow-400 max-w-sm flex items-center gap-4">
          <div className="text-4xl">{badgesUnlocked[0].icon || '🏆'}</div>
          <div>
            <div className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-wider mb-1">Nova Conquista!</div>
            <div className="font-bold text-slate-800 dark:text-white">{badgesUnlocked[0].name}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">+{xpAmount} XP</div>
          </div>
        </div>
      </div>
    )
  }

  // Normal XP toast
  return (
    <div className={`fixed bottom-20 right-4 md:right-8 z-50 transition-all duration-300 transform ${visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
      <div className="bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 border border-indigo-400">
        <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
        <div className="flex flex-col">
          <span className="font-bold leading-tight">+{xpAmount} XP</span>
          <span className="text-xs text-indigo-200 leading-tight">{reasonLabel}</span>
        </div>
      </div>
    </div>
  )
}
