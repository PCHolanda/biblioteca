import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const DEFAULT_LEVELS = [
  { level: 1, min_xp: 0, name: 'Iniciante' },
  { level: 2, min_xp: 200, name: 'Explorador' },
  { level: 3, min_xp: 500, name: 'Aventureiro' },
  { level: 4, min_xp: 1000, name: 'Sábio' },
  { level: 5, min_xp: 2000, name: 'Mestre' },
  { level: 6, min_xp: 5000, name: 'Lenda da Leitura' }
]

function calculateLevel(xp: number, levels: any[]) {
  const sorted = [...levels].sort((a, b) => b.level - a.level)
  for (const lvl of sorted) {
    if (xp >= (lvl.min_xp ?? lvl.min ?? 0)) {
      return lvl.level
    }
  }
  return 1
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { studentId, xpAmount, reason, bookId } = body

    if (!studentId || typeof xpAmount !== 'number' || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validReasons = ['page_read', 'book_complete', 'quiz_pass', 'quiz_perfect', 'streak_bonus', 'club_complete', 'badge_reward']
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 0. Carregar configuração de níveis
    const { data: configData } = await adminSupabase
      .from('gamification_config')
      .select('levels')
      .limit(1)
      .maybeSingle()

    const levels = configData?.levels && Array.isArray(configData.levels) ? configData.levels : DEFAULT_LEVELS

    // 1. Get current gamification state
    const { data: gamification, error: getError } = await adminSupabase
      .from('student_gamification')
      .select('*')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle()

    let currentTotalXp = gamification?.total_xp || 0
    let currentPages = gamification?.pages_read || 0
    let currentBooks = gamification?.books_completed || 0
    let currentQuizzes = gamification?.quizzes_passed || 0
    const currentStreak = gamification?.current_streak || 0
    const longestStreak = gamification?.longest_streak || 0

    // 2. Apply updates
    currentTotalXp += xpAmount
    if (reason === 'page_read') currentPages += 1
    if (reason === 'book_complete') currentBooks += 1
    if (reason === 'quiz_pass' || reason === 'quiz_perfect') currentQuizzes += 1

    const newLevel = calculateLevel(currentTotalXp, levels)
    const oldLevel = gamification ? gamification.level : 1
    const leveledUp = newLevel > oldLevel

    // 3. Update or Insert gamification
    const gamifPayload = {
      total_xp: currentTotalXp,
      level: newLevel,
      pages_read: currentPages,
      books_completed: currentBooks,
      quizzes_passed: currentQuizzes,
      updated_at: new Date().toISOString()
    }

    const { data: updatedGamification, error: updateError } = await adminSupabase
      .from('student_gamification')
      .update(gamifPayload)
      .eq('student_id', studentId)
      .select()

    let finalGamif = null
    if (!updateError && (!updatedGamification || updatedGamification.length === 0)) {
       const { data: insertedGamif, error: insertError } = await adminSupabase.from('student_gamification').insert({
         student_id: studentId,
         ...gamifPayload
       }).select()
       if (insertError) {
         console.error('Gamification insert error:', insertError)
         return NextResponse.json({ error: 'Failed to create gamification' }, { status: 500 })
       }
       finalGamif = insertedGamif?.[0]
    } else if (updateError) {
       console.error('Gamification update error:', updateError)
       return NextResponse.json({ error: 'Failed to update gamification' }, { status: 500 })
    } else {
       finalGamif = updatedGamification?.[0]
    }

    // 4. Insert xp log
    await adminSupabase
      .from('xp_log')
      .insert({
        student_id: studentId,
        xp_amount: xpAmount,
        reason: reason,
        book_id: bookId || null
      })

    // 5. Check badges
    const { data: allBadges } = await adminSupabase.from('badges').select('*')
    const { data: studentBadges } = await adminSupabase.from('student_badges').select('badge_id').eq('student_id', studentId)
    
    const unlockedBadgeIds = new Set(studentBadges?.map(sb => sb.badge_id) || [])
    const newlyUnlocked = []
    
    if (allBadges) {
      for (const badge of allBadges) {
        if (unlockedBadgeIds.has(badge.id)) continue
        
        let conditionMet = false
        const value = badge.condition_value
        
        switch (badge.condition_type) {
          case 'books_completed':
            conditionMet = currentBooks >= value; break;
          case 'quizzes_passed':
            conditionMet = currentQuizzes >= value; break;
          case 'perfect_quiz':
            if (reason === 'quiz_perfect') {
               const { count } = await adminSupabase.from('xp_log').select('*', { count: 'exact', head: true }).eq('student_id', studentId).eq('reason', 'quiz_perfect')
               conditionMet = (count || 0) + 1 >= value
            }
            break;
          case 'streak_days':
            conditionMet = longestStreak >= value || currentStreak >= value; break;
          case 'xp_total':
            conditionMet = currentTotalXp >= value; break;
          case 'badges_unlocked':
            conditionMet = unlockedBadgeIds.size >= value; break;
          case 'club_member':
            const { count: clubCount } = await adminSupabase.from('club_members').select('*', { count: 'exact', head: true }).eq('student_id', studentId)
            conditionMet = (clubCount || 0) >= value; break;
          case 'genres_read':
            const { data: userBooks } = await adminSupabase.from('reading_progress').select('book_id').eq('student_id', studentId).eq('completed', true)
            if (userBooks && userBooks.length > 0) {
               const bookIds = userBooks.map(b => b.book_id)
               const { data: booksData } = await adminSupabase.from('books').select('genre').in('id', bookIds)
               const genres = new Set(booksData?.map(b => b.genre).filter(Boolean))
               conditionMet = genres.size >= value
            }
            break;
        }

        if (conditionMet) {
          newlyUnlocked.push(badge)
          unlockedBadgeIds.add(badge.id)
          
          await adminSupabase.from('student_badges').insert({ student_id: studentId, badge_id: badge.id })
          
          if (badge.xp_reward > 0) {
            currentTotalXp += badge.xp_reward
            const finalLevel = calculateLevel(currentTotalXp, levels)
            
            await adminSupabase.from('student_gamification').update({
              total_xp: currentTotalXp,
              level: finalLevel
            }).eq('student_id', studentId)
            
            await adminSupabase.from('xp_log').insert({
              student_id: studentId,
              xp_amount: badge.xp_reward,
              reason: 'badge_reward'
            })
          }
        }
      }
    }

    const finalLevel = calculateLevel(currentTotalXp, levels)
    const finalLeveledUp = finalLevel > oldLevel

    return NextResponse.json({
      newTotalXp: currentTotalXp,
      newLevel: finalLevel,
      leveledUp: finalLeveledUp,
      badgesUnlocked: newlyUnlocked.map(b => ({ name: b.name, icon: b.icon, description: b.description, xpReward: b.xp_reward }))
    })

  } catch (error: any) {
    console.error('Error in gamification XP:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
