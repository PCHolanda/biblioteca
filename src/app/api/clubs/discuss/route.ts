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
    const { clubId, message } = body

    if (!clubId || !message || !message.trim()) {
      return NextResponse.json({ error: 'Mensagem e ID do clube são obrigatórios' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 1. Obter aluno autenticado
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, full_name')
      .eq('auth_user_id', user.id)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Perfil de aluno não encontrado' }, { status: 403 })
    }

    const studentId = student.id

    // 2. Verificar se o aluno é membro do clube
    const { data: member, error: memberError } = await adminSupabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (memberError || !member) {
      return NextResponse.json({ error: 'Você precisa fazer parte deste clube para postar no mural' }, { status: 403 })
    }

    // 3. Inserir discussão pendente de aprovação
    const { error: insertError } = await adminSupabase
      .from('club_discussions')
      .insert({
        club_id: clubId,
        student_id: studentId,
        message: message.trim(),
        approved: false,
        created_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Erro ao postar discussão:', insertError)
      return NextResponse.json({ error: 'Erro ao enviar mensagem: ' + insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Mensagem enviada! Ela aparecerá no mural assim que o professor aprovar.' })
  } catch (err: any) {
    console.error('Erro em /api/clubs/discuss:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
