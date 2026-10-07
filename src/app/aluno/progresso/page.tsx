import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import EstanteClient from '../components/EstanteClient'
import StreakCard from '../components/StreakCard'
import BadgesGrid from '../components/BadgesGrid'
import { Trophy, BookOpen, Flame, Star } from 'lucide-react'

export const revalidate = 0

const LEVEL_NAMES: { [lvl: number]: string } = {
  1: 'Iniciante',
  2: 'Explorador',
  3: 'Aventureiro',
  4: 'Sábio',
  5: 'Mestre',
  6: 'Lenda da Leitura'
}

export default async function ProgressoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!student) {
    redirect('/unauthorized')
  }

  const studentId = student.id
  const adminSupabase = createAdminClient()

  // 1. Gamificação do Aluno
  const { data: gamification } = await adminSupabase
    .from('student_gamification')
    .select('*')
    .eq('student_id', studentId)
    .single()

  // 2. Badges
  const { data: allBadges } = await adminSupabase
    .from('badges')
    .select('*')
    .order('condition_value', { ascending: true })

  const { data: studentBadges } = await adminSupabase
    .from('student_badges')
    .select('badge_id')
    .eq('student_id', studentId)

  const unlockedBadgeIds = studentBadges ? studentBadges.map((b: any) => b.badge_id) : []

  // 3. Progresso de Leitura
  const { data: progress } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('student_id', studentId)

  const progressBookIds = progress ? progress.map((p: any) => p.book_id) : []

  // 4. Livros elegíveis
  const { data: eligibleBooks } = await supabase
    .rpc('get_eligible_books', { p_student_id: studentId })

  const progressBooks = eligibleBooks
    ? (eligibleBooks as any[]).filter((b: any) => progressBookIds.includes(b.id))
    : []

  const { data: favorites } = await supabase
    .from('favorites')
    .select('book_id')
    .eq('student_id', studentId)

  const favoriteIds = favorites ? favorites.map((f: any) => f.book_id) : []

  // 5. Tentativas de Quiz
  const { data: quizAttempts } = await supabase
    .from('quiz_attempts')
    .select('book_id, passed, score')
    .eq('student_id', studentId)

  const currentLevel = gamification?.level || 1
  const levelName = LEVEL_NAMES[currentLevel] || 'Iniciante'
  const totalXp = gamification?.total_xp || 0
  const currentStreak = gamification?.current_streak || 0
  const longestStreak = gamification?.longest_streak || 0
  const lastReadingDate = gamification?.last_reading_date || null
  const booksCompleted = gamification?.books_completed || progress?.filter((p: any) => p.completed)?.length || 0
  const pagesRead = gamification?.pages_read || 0
  const quizzesPassed = gamification?.quizzes_passed || quizAttempts?.filter((q: any) => q.passed)?.length || 0

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
          <Trophy className="text-amber-500" size={24} />
          <span>Sua Jornada de Leitura</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
          Acompanhe seu nível, sequência diária, conquistas e livros lidos.
        </p>
      </div>

      {/* Grid de Estatísticas Rápidas & Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card de Nível e XP */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-2xl shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
              Nível {currentLevel}
            </span>
            <Star className="text-yellow-300 fill-yellow-300" size={20} />
          </div>
          <div className="my-4">
            <h3 className="text-2xl font-extrabold">{levelName}</h3>
            <p className="text-indigo-100 text-sm mt-1">{totalXp} XP acumulados</p>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/20 text-center">
            <div>
              <p className="text-xs text-indigo-100">Livros</p>
              <p className="text-lg font-bold">{booksCompleted}</p>
            </div>
            <div>
              <p className="text-xs text-indigo-100">Páginas</p>
              <p className="text-lg font-bold">{pagesRead}</p>
            </div>
            <div>
              <p className="text-xs text-indigo-100">Quizzes</p>
              <p className="text-lg font-bold">{quizzesPassed}</p>
            </div>
          </div>
        </div>

        {/* Card de Sequência (Streak) */}
        <div className="md:col-span-2">
          <StreakCard
            currentStreak={currentStreak}
            longestStreak={longestStreak}
            lastReadingDate={lastReadingDate}
          />
        </div>
      </div>

      {/* Grade de Conquistas (Badges) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <BadgesGrid
          allBadges={allBadges || []}
          unlockedBadgeIds={unlockedBadgeIds}
        />
      </div>

      {/* Histórico de Livros */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
          <BookOpen className="text-indigo-500" size={20} />
          <span>Livros em Andamento e Concluídos</span>
        </h3>
        <EstanteClient
          books={progressBooks}
          favoriteIds={favoriteIds}
          readingProgress={progress || []}
          quizAttempts={quizAttempts || []}
          studentId={studentId}
        />
      </div>
    </div>
  )
}
