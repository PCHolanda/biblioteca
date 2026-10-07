import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import EstanteClient from './components/EstanteClient'

export const revalidate = 0

export default async function AlunoPage() {
  const supabase = createClient()
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

  // Buscar livros elegíveis chamando o RPC Postgres get_eligible_books
  const { data: eligibleBooks, error: rpcError } = await supabase
    .rpc('get_eligible_books', { p_student_id: studentId })

  if (rpcError || !eligibleBooks) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 font-semibold">Erro ao carregar livros da estante.</p>
      </div>
    )
  }

  // Buscar favoritos do aluno
  const { data: favorites } = await supabase
    .from('favorites')
    .select('book_id')
    .eq('student_id', studentId)

  const favoriteIds = favorites ? favorites.map((f: any) => f.book_id) : []

  // Buscar progresso de leitura
  const { data: progress } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('student_id', studentId)

  // Buscar tentativas de quiz do aluno
  const { data: quizAttempts } = await supabase
    .from('quiz_attempts')
    .select('book_id, passed, score')
    .eq('student_id', studentId)

  return (
    <EstanteClient
      books={eligibleBooks}
      favoriteIds={favoriteIds}
      readingProgress={progress || []}
      quizAttempts={quizAttempts || []}
      studentId={studentId}
    />
  )
}
