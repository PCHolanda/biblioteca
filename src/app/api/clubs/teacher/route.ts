import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()

    // 1. Buscar perfil do professor
    const { data: teacher } = await adminSupabase
      .from('teachers')
      .select('id, class_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    // 2. Buscar clubes criados pelo professor ou da sua turma
    let query = adminSupabase
      .from('book_clubs')
      .select(`
        *,
        book:book_id (id, title, cover_url, author),
        members:club_members (id, student_id, joined_at),
        discussions:club_discussions (id, student_id, message, approved, created_at)
      `)
      .order('created_at', { ascending: false })

    if (teacher?.class_id) {
      query = query.or(`created_by.eq.${user.id},class_id.eq.${teacher.class_id}`)
    } else {
      query = query.eq('created_by', user.id)
    }

    const { data: clubs, error: clubsError } = await query

    if (clubsError) {
      console.error('Erro ao buscar clubes do professor:', clubsError)
      return NextResponse.json({ error: clubsError.message }, { status: 500 })
    }

    // 3. Buscar nomes dos alunos para as discussões e membros
    const { data: allStudents } = await adminSupabase
      .from('students')
      .select('id, full_name')

    const studentMap = new Map((allStudents || []).map(s => [s.id, s.full_name]))

    // 4. Formatar os dados para o frontend
    const formattedClubs = (clubs || []).map((club: any) => {
      const bookData = Array.isArray(club.book) ? club.book[0] : club.book
      const membersList = Array.isArray(club.members) ? club.members : []
      const discussionsList = (Array.isArray(club.discussions) ? club.discussions : []).map((d: any) => ({
        ...d,
        student: {
          full_name: studentMap.get(d.student_id) || 'Aluno'
        }
      }))

      return {
        ...club,
        book: bookData,
        members: membersList,
        discussions: discussionsList
      }
    })

    return NextResponse.json({ clubs: formattedClubs })
  } catch (error: any) {
    console.error('Erro em /api/clubs/teacher:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
