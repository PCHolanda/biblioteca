import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { studentId } = body

    if (!studentId) {
      return NextResponse.json({ error: 'Missing studentId' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    const { data: gamification, error: getError } = await adminSupabase
      .from('student_gamification')
      .select('*')
      .eq('student_id', studentId)
      .single()

    let record = gamification
    if (!record || getError) {
      const { data: newRecord, error: insertError } = await adminSupabase
        .from('student_gamification')
        .insert({ student_id: studentId, current_streak: 0, longest_streak: 0 })
        .select()
        .single()
      
      if (insertError) {
        return NextResponse.json({ error: 'Failed to create gamification record' }, { status: 500 })
      }
      record = newRecord
    }

    const todayDate = new Date()
    todayDate.setUTCHours(0,0,0,0)
    const today = todayDate.toISOString().split('T')[0]
    
    const lastReadingDate = record.last_reading_date ? new Date(record.last_reading_date) : null
    if (lastReadingDate) {
      lastReadingDate.setUTCHours(0,0,0,0)
    }

    const yesterdayDate = new Date(todayDate)
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1)

    let currentStreak = record.current_streak || 0
    let longestStreak = record.longest_streak || 0
    let streakShield = record.streak_shield || false
    let isNewDay = false
    let streakXpGained = 0

    if (!lastReadingDate) {
      currentStreak = 1
      isNewDay = true
    } else {
      const lastReadingStr = lastReadingDate.toISOString().split('T')[0]
      const yesterdayStr = yesterdayDate.toISOString().split('T')[0]
      
      if (lastReadingStr === today) {
        isNewDay = false
      } else if (lastReadingStr === yesterdayStr) {
        currentStreak += 1
        isNewDay = true
      } else {
        if (streakShield) {
          streakShield = false
          currentStreak += 1
        } else {
          currentStreak = 1
        }
        isNewDay = true
      }
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak
    }

    if (isNewDay) {
      if (currentStreak === 7) {
        streakXpGained = 30
      } else if (currentStreak === 30) {
        streakXpGained = 100
      }

      let totalXp = record.total_xp || 0
      totalXp += streakXpGained

      await adminSupabase
        .from('student_gamification')
        .update({
          current_streak: currentStreak,
          longest_streak: longestStreak,
          streak_shield: streakShield,
          last_reading_date: today,
          total_xp: totalXp
        })
        .eq('student_id', studentId)

      if (streakXpGained > 0) {
        await adminSupabase.from('xp_log').insert({
          student_id: studentId,
          xp_amount: streakXpGained,
          reason: 'streak_bonus'
        })
      }
    }

    return NextResponse.json({
      currentStreak,
      longestStreak,
      isNewDay,
      streakXpGained
    })

  } catch (error: any) {
    console.error('Error in gamification streak:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
