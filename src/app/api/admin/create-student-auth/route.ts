import { createClient as createRequesterClient, createAdminClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    // 1. Validar se o usuário requisitante é admin
    const requesterSupabase = createRequesterClient()
    const { data: { user }, error: authError } = await requesterSupabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: profile } = await requesterSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || (user.user_metadata?.role as string)

    if (role !== 'superadmin' && role !== 'admin' && role !== 'client' && role !== 'teacher') {
      return NextResponse.json({ error: 'Acesso proibido. Apenas administradores ou professores podem realizar esta ação.' }, { status: 403 })
    }

    // 2. Obter parâmetros do corpo da requisição
    const { studentId, enrollmentCode, password, displayName } = await req.json()

    if (!studentId || !enrollmentCode || !password || !displayName) {
      return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 })
    }

    // Se o requisitante for professor, validar se o aluno pertence à mesma turma dele
    if (role === 'teacher') {
      const { data: teacher } = await requesterSupabase
        .from('teachers')
        .select('class_id')
        .eq('auth_user_id', user.id)
        .single()

      if (!teacher) {
        return NextResponse.json({ error: 'Professor não configurado ou sem turma' }, { status: 403 })
      }

      const { data: student } = await requesterSupabase
        .from('students')
        .select('class_id')
        .eq('id', studentId)
        .single()

      if (!student || student.class_id !== teacher.class_id) {
        return NextResponse.json({ error: 'Acesso negado: o estudante não pertence à sua turma' }, { status: 403 })
      }
    }

    const adminSupabase = createAdminClient()
    const email = `${enrollmentCode.toLowerCase()}@biblioteca.escolar`

    // 3. Criar usuário no Auth do Supabase usando a Service Role Key
    const { data: authUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'student',
        display_name: displayName,
      },
    })

    if (createError || !authUser.user) {
      const errMsg = createError?.message || ''
      if (errMsg.includes('already registered') || errMsg.includes('already exists')) {
        return NextResponse.json({ error: 'Este código de matrícula (usuário) já está cadastrado. Por favor, escolha outro.' }, { status: 400 })
      }
      return NextResponse.json({ error: errMsg || 'Erro ao criar usuário Auth' }, { status: 500 })
    }

    // 4. Vincular o auth_user_id ao registro de estudantes
    const { error: updateError } = await adminSupabase
      .from('students')
      .update({ auth_user_id: authUser.user.id })
      .eq('id', studentId)

    if (updateError) {
      // Reverter a criação do usuário para manter integridade
      await adminSupabase.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: 'Erro ao vincular conta: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId: authUser.user.id, email })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
