'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'

interface StreakCardProps {
  currentStreak: number
  longestStreak: number
  lastReadingDate: string | null
}

export default function StreakCard({ currentStreak, longestStreak, lastReadingDate }: StreakCardProps) {
  const getFireSize = () => {
    if (currentStreak >= 30) return 'text-6xl'
    if (currentStreak >= 7) return 'text-5xl'
    return 'text-4xl'
  }

  const isPulse = currentStreak >= 7

  // Check if streak is at risk
  const isAtRisk = () => {
    if (!lastReadingDate || currentStreak === 0) return false
    const lastDate = new Date(lastReadingDate)
    const today = new Date()
    
    // Normalize to midnight
    lastDate.setHours(0,0,0,0)
    today.setHours(0,0,0,0)
    
    const diffTime = Math.abs(today.getTime() - lastDate.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays === 1
  }

  const generateDays = () => {
    const days = []
    const today = new Date()
    today.setHours(0,0,0,0)
    
    let lastDate: Date | null = null
    if (lastReadingDate) {
      lastDate = new Date(lastReadingDate)
      lastDate.setHours(0,0,0,0)
    }

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      
      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).charAt(0).toUpperCase()
      
      let isRead = false
      if (lastDate && currentStreak > 0) {
        // Rough estimation based on streak count for visualization
        const readYesterdayOrToday = lastDate.getTime() === today.getTime() || (lastDate.getTime() === today.getTime() - 86400000)
        
        if (readYesterdayOrToday) {
           const earliestStreakDay = new Date(lastDate)
           earliestStreakDay.setDate(lastDate.getDate() - currentStreak + 1)
           if (d.getTime() >= earliestStreakDay.getTime() && d.getTime() <= lastDate.getTime()) {
             isRead = true
           }
        }
      }

      days.push({
        id: i,
        dayName,
        isRead,
        isToday: i === 0
      })
    }
    return days
  }

  const days = generateDays()
  const showWarning = isAtRisk()

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 p-5 rounded-2xl border border-amber-200 dark:border-slate-700 shadow-sm relative overflow-hidden flex flex-col items-center">
      {/* Top Section */}
      <div className="flex flex-col items-center justify-center text-center mb-6">
        <div className={`mb-2 ${isPulse ? 'animate-pulse drop-shadow-md' : 'opacity-80'}`}>
          <span className={getFireSize()}>🔥</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black text-amber-600 dark:text-amber-500">{currentStreak}</span>
          <span className="text-lg font-medium text-amber-800/70 dark:text-amber-200/70">dias seguidos</span>
        </div>
      </div>

      {/* Calendar Row */}
      <div className="flex justify-between items-center w-full max-w-[240px] mb-6">
        {days.map((day) => (
          <div key={day.id} className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-slate-400">{day.dayName}</span>
            <div 
              className={`w-6 h-6 rounded-full flex items-center justify-center
                ${day.isRead ? 'bg-emerald-500 shadow-sm' : 'bg-slate-200 dark:bg-slate-700'}
                ${day.isToday && !day.isRead ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-800 animate-pulse' : ''}
              `}
            >
              {day.isRead && <span className="text-white text-[10px]">✓</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
        Recorde: {longestStreak} dias
      </div>

      {/* Warning Banner */}
      {showWarning && (
        <div className="mt-4 w-full bg-amber-100 dark:bg-amber-900/50 rounded-xl p-3 flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-bold">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Leia hoje para manter sua sequência!</span>
        </div>
      )}
    </div>
  )
}
