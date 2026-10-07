import { createClient as createRequesterClient, createAdminClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
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
      return NextResponse.json({ error: 'Acesso proibido. Sem permissão para enviar capas.' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${crypto.randomUUID()}.${fileExt}`
    const filePath = `covers/${fileName}`

    const adminSupabase = createAdminClient()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await adminSupabase.storage
      .from('covers')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Falha no upload da capa: ' + uploadError.message }, { status: 500 })
    }

    const { data } = adminSupabase.storage.from('covers').getPublicUrl(filePath)

    return NextResponse.json({ publicUrl: data.publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
