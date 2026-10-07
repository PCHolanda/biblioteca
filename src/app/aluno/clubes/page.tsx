import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ClubesClient from './ClubesClient'

export const revalidate = 0

export const metadata = {
  title: 'Clubes do Livro | Biblioteca Digital',
}

export default async function ClubesPage() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  const { data: student } = await supabase
    .from('students')
    .select('id, class_id, full_name')
    .eq('auth_user_id', user.id)
    .single()

  if (!student) {
    redirect('/unauthorized')
  }

  const adminSupabase = createAdminClient()

  // Buscar todos os clubes ativos (da turma do aluno ou gerais)
  let query = adminSupabase
    .from('book_clubs')
    .select(`
      id, name, description, max_members, start_date, end_date, status, class_id,
      book:book_id (id, title, cover_url, author),
      members:club_members (student_id)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (student.class_id) {
    query = query.or(`class_id.eq.${student.class_id},class_id.is.null`)
  }

  const { data: clubs, error: clubsError } = await query

  if (clubsError) {
    console.error('Erro ao buscar clubes:', clubsError)
  }

  const formattedClubs = (clubs || []).map((club: any) => {
    const membersList = Array.isArray(club.members) ? club.members : []
    const isMember = membersList.some((m: any) => m.student_id === student.id)
    const bookData = Array.isArray(club.book) ? club.book[0] : club.book

    return {
      ...club,
      book: bookData,
      member_count: membersList.length,
      is_member: isMember,
    }
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>👥 Clubes do Livro</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
          Leia livros junto com seus colegas de turma e debata no mural!
        </p>
      </div>

      <ClubesClient initialClubs={formattedClubs} studentId={student.id} />
    </div>
  )
}
