import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const DEFAULT_LEVELS = [
  { level: 1, min_xp: 0, name: 'Iniciante', icon: '📖' },
  { level: 2, min_xp: 200, name: 'Explorador', icon: '🔍' },
  { level: 3, min_xp: 500, name: 'Aventureiro', icon: '⚔️' },
  { level: 4, min_xp: 1000, name: 'Sábio', icon: '🧠' },
  { level: 5, min_xp: 2000, name: 'Mestre', icon: '🎓' },
  { level: 6, min_xp: 5000, name: 'Lenda da Leitura', icon: '👑' }
]

function getLevelInfo(xp: number, levels: any[]) {
  const sorted = [...levels].sort((a, b) => a.level - b.level)
  let currentLvl = sorted[0] || DEFAULT_LEVELS[0]
  let nextMin = sorted[1]?.min_xp ?? sorted[0]?.min_xp ?? 200

  for (let i = 0; i < sorted.length; i++) {
    if (xp >= (sorted[i].min_xp ?? sorted[i].min ?? 0)) {
      currentLvl = sorted[i]
      nextMin = (i + 1 < sorted.length) ? (sorted[i+1].min_xp ?? sorted[i+1].min) : (sorted[i].min_xp ?? sorted[i].min)
    }
  }

  return { 
    level: currentLvl.level, 
    name: currentLvl.name, 
    icon: currentLvl.icon || '📖',
    xpForNextLevel: currentLvl.level < sorted.length ? nextMin : xp 
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const studentId = searchParams.get('studentId')

    if (!studentId) {
      return NextResponse.json({ error: 'Missing studentId' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 0. Carregar configuração de níveis
    const { data: configData } = await adminSupabase
      .from('gamification_config')
      .select('levels')
      .limit(1)
      .maybeSingle()

    const levels = configData?.levels && Array.isArray(configData.levels) ? configData.levels : DEFAULT_LEVELS

    const { data: gamification } = await adminSupabase
      .from('student_gamification')
      .select('*')
      .eq('student_id', studentId)
      .single()
      
    const record = gamification || {
      total_xp: 0,
      current_streak: 0,
      longest_streak: 0,
      last_reading_date: null,
      pages_read: 0,
      books_completed: 0,
      quizzes_passed: 0
    }

    const { data: studentBadgesData } = await adminSupabase
      .from('student_badges')
      .select('badge_id, unlocked_at')
      .eq('student_id', studentId)
      
    const { data: allBadgesData } = await adminSupabase
      .from('badges')
      .select('*')
      
    const { data: xpLogs } = await adminSupabase
      .from('xp_log')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(10)

    const unlockedIds = new Set(studentBadgesData?.map(sb => sb.badge_id) || [])
    
    const unlockedBadges = []
    const allBadgesFormatted = []
    
    if (allBadgesData) {
      for (const b of allBadgesData) {
        const isUnlocked = unlockedIds.has(b.id)
        const sb = studentBadgesData?.find(s => s.badge_id === b.id)
        
        const badgeObj = {
          id: b.id,
          name: b.name,
          description: b.description,
          icon: b.icon,
          xpReward: b.xp_reward,
          isSecret: b.is_secret,
          isUnlocked,
          unlockedAt: sb ? sb.unlocked_at : null
        }
        
        allBadgesFormatted.push(badgeObj)
        if (isUnlocked) {
          unlockedBadges.push(badgeObj)
        }
      }
    }

    const { level, name, icon, xpForNextLevel } = getLevelInfo(record.total_xp, levels)
    const currentLevelObj = levels.find((t: any) => t.level === level)
    const currentLevelThreshold = currentLevelObj ? (currentLevelObj.min_xp ?? currentLevelObj.min ?? 0) : 0
    
    const xpProgress = level >= levels.length ? 0 : record.total_xp - currentLevelThreshold
    const xpNeeded = level >= levels.length ? 0 : xpForNextLevel - currentLevelThreshold

    return NextResponse.json({
      totalXp: record.total_xp,
      level,
      levelName: name,
      levelIcon: icon,
      xpForNextLevel,
      xpProgress: level >= levels.length ? record.total_xp : xpProgress,
      xpNeeded,
      currentStreak: record.current_streak,
      longestStreak: record.longest_streak,
      lastReadingDate: record.last_reading_date,
      pagesRead: record.pages_read,
      booksCompleted: record.books_completed,
      quizzesPassed: record.quizzes_passed,
      unlockedBadges,
      allBadges: allBadgesFormatted,
      recentXpLog: xpLogs || []
    })

  } catch (error: any) {
    console.error('Error in gamification profile:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
