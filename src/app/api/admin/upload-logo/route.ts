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
      return NextResponse.json({ error: 'Acesso proibido. Sem permissão para enviar logotipos.' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const requestedBucket = formData.get('bucket') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Permitir bucket school-logos ou client-logos
    const bucket = (requestedBucket === 'client-logos' || requestedBucket === 'school-logos') 
      ? requestedBucket 
      : 'school-logos'

    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `${crypto.randomUUID()}.${fileExt}`
    const filePath = `logos/${fileName}`

    const adminSupabase = createAdminClient()

    // Garantir que o bucket exista antes de tentar upload
    await adminSupabase.storage.createBucket(bucket, { public: true }).catch(() => {})

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let contentType = file.type
    const lowerExt = fileExt.toLowerCase()
    if (!contentType || contentType === 'application/octet-stream') {
      if (lowerExt === 'jfif' || lowerExt === 'jpeg' || lowerExt === 'jpg') {
        contentType = 'image/jpeg'
      } else if (lowerExt === 'png') {
        contentType = 'image/png'
      } else if (lowerExt === 'webp') {
        contentType = 'image/webp'
      } else if (lowerExt === 'svg') {
        contentType = 'image/svg+xml'
      } else {
        contentType = 'image/jpeg'
      }
    }

    const { error: uploadError } = await adminSupabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType,
        upsert: true
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Falha no upload do logo: ' + uploadError.message }, { status: 500 })
    }

    const { data } = adminSupabase.storage.from(bucket).getPublicUrl(filePath)

    return NextResponse.json({ publicUrl: data.publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
