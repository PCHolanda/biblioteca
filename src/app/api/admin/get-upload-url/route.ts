import { createClient as createRequesterClient, createAdminClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    // 1. Validar se o requisitante é admin
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
      return NextResponse.json({ error: 'Acesso proibido. Apenas administradores podem enviar livros.' }, { status: 403 })
    }

    // 2. Extrair parâmetros
    const { filename } = await req.json()
    if (!filename) {
      return NextResponse.json({ error: 'filename é obrigatório' }, { status: 400 })
    }

    // Gerar um nome de arquivo único
    const fileId = crypto.randomUUID()
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${fileId}-${cleanFilename}`

    // 3. Criar a URL assinada de upload usando o admin client
    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .storage
      .from('book-pdfs')
      .createSignedUploadUrl(filePath)

    if (error || !data) {
      return NextResponse.json({ error: 'Erro ao gerar URL assinada de upload: ' + error?.message }, { status: 500 })
    }

    return NextResponse.json({ 
      signedUrl: data.signedUrl, 
      path: filePath,
      token: data.token
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
