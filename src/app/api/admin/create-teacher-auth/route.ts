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

    if (role !== 'superadmin' && role !== 'admin' && role !== 'client') {
      return NextResponse.json({ error: 'Acesso proibido. Apenas administradores podem realizar esta ação.' }, { status: 403 })
    }

    // 2. Obter parâmetros do corpo da requisição
    const { teacherId, username, password, displayName } = await req.json()

    if (!teacherId || !username || !password || !displayName) {
      return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()
    // Identificador para o professor (ex: professor1@biblioteca.professor)
    const email = `${username.toLowerCase()}@biblioteca.professor`

    // 3. Criar usuário no Auth do Supabase usando a Service Role Key
    const { data: authUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'teacher',
        display_name: displayName,
      },
    })

    if (createError || !authUser.user) {
      const errMsg = createError?.message || ''
      if (errMsg.includes('already registered') || errMsg.includes('already exists')) {
        return NextResponse.json({ error: 'Este nome de usuário de acesso já está cadastrado. Por favor, escolha outro.' }, { status: 400 })
      }
      return NextResponse.json({ error: errMsg || 'Erro ao criar usuário Auth' }, { status: 500 })
    }

    // 4. Vincular o auth_user_id ao registro de professores e salvar o e-mail de login
    const { error: updateError } = await adminSupabase
      .from('teachers')
      .update({ 
        auth_user_id: authUser.user.id,
        email: email
      })
      .eq('id', teacherId)

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
