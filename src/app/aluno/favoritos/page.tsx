import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import EstanteClient from '../components/EstanteClient'

export const revalidate = 0

export default async function FavoritosPage() {
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

  // Buscar os favoritos do aluno
  const { data: favorites } = await supabase
    .from('favorites')
    .select('book_id')
    .eq('student_id', studentId)

  const favoriteIds = favorites ? favorites.map((f: any) => f.book_id) : []

  // Buscar os livros elegíveis
  const { data: eligibleBooks } = await supabase
    .rpc('get_eligible_books', { p_student_id: studentId })

  // Filtrar apenas os livros que foram favoritados
  const favoriteBooks = eligibleBooks 
    ? (eligibleBooks as any[]).filter((b: any) => favoriteIds.includes(b.id))
    : []

  const { data: progress } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('student_id', studentId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white">Seus Favoritos</h2>
        <p className="text-slate-400 text-xs mt-1">Livros que você favoritou para ler.</p>
      </div>
      <EstanteClient
        books={favoriteBooks}
        favoriteIds={favoriteIds}
        readingProgress={progress || []}
        studentId={studentId}
      />
    </div>
  )
}
