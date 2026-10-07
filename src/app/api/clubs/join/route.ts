import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { clubId } = body

    if (!clubId) {
      return NextResponse.json({ error: 'clubId é obrigatório' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 1. Obter o aluno autenticado
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, full_name')
      .eq('auth_user_id', user.id)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Perfil de aluno não encontrado' }, { status: 403 })
    }

    const studentId = student.id

    // 2. Verificar se o clube existe e está ativo
    const { data: club, error: clubError } = await adminSupabase
      .from('book_clubs')
      .select('id, max_members, status')
      .eq('id', clubId)
      .single()

    if (clubError || !club) {
      return NextResponse.json({ error: 'Clube do Livro não encontrado' }, { status: 404 })
    }

    if (club.status !== 'active') {
      return NextResponse.json({ error: 'Este clube não está ativo no momento' }, { status: 400 })
    }

    // 3. Verificar se o aluno já é membro
    const { data: existingMember } = await adminSupabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json({ success: true, message: 'Você já faz parte deste clube' })
    }

    // 4. Verificar limite de vagas
    const { count: currentMemberCount } = await adminSupabase
      .from('club_members')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)

    if ((currentMemberCount || 0) >= club.max_members) {
      return NextResponse.json({ error: 'Este clube já atingiu o limite de membros' }, { status: 400 })
    }

    // 5. Inserir membro no clube
    const { error: insertError } = await adminSupabase
      .from('club_members')
      .insert({
        club_id: clubId,
        student_id: studentId,
        joined_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Erro ao ingressar no clube:', insertError)
      return NextResponse.json({ error: 'Não foi possível entrar no clube: ' + insertError.message }, { status: 500 })
    }

    // 6. Conceder +20 XP de Leitura Social
    try {
      await adminSupabase.from('xp_log').insert({
        student_id: studentId,
        xp_amount: 20,
        reason: 'club_complete',
        created_at: new Date().toISOString()
      })

      const { data: gamification } = await adminSupabase
        .from('student_gamification')
        .select('total_xp')
        .eq('student_id', studentId)
        .maybeSingle()

      if (gamification) {
        await adminSupabase
          .from('student_gamification')
          .update({ total_xp: (gamification.total_xp || 0) + 20 })
          .eq('student_id', studentId)
      }
    } catch (xpErr) {
      console.warn('Erro ao conceder XP do clube:', xpErr)
    }

    return NextResponse.json({ success: true, message: 'Ingressou com sucesso no clube!' })
  } catch (err: any) {
    console.error('Erro em /api/clubs/join:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
