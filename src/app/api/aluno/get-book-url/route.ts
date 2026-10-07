import { createClient, createAdminClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const bookId = searchParams.get('bookId')

    if (!bookId) {
      return NextResponse.json({ error: 'bookId é obrigatório' }, { status: 400 })
    }

    // 1. Obter o registro de student do usuário logado
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Estudante não vinculado a este usuário do Auth' }, { status: 404 })
    }

    // 2. Chamar RPC do banco de dados para verificar se o livro está disponível/elegível para o aluno
    const { data: eligibleBooks, error: rpcError } = await supabase
      .rpc('get_eligible_books', { p_student_id: student.id })

    if (rpcError || !eligibleBooks) {
      return NextResponse.json({ error: 'Erro ao verificar elegibilidade do livro' }, { status: 500 })
    }

    const isEligible = (eligibleBooks as any[]).some((b: any) => b.id === bookId)

    if (!isEligible) {
      return NextResponse.json({ error: 'Este livro não está disponível para o seu perfil ou série' }, { status: 403 })
    }

    // 3. Buscar o caminho do PDF
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('pdf_url')
      .eq('id', bookId)
      .single()

    if (bookError || !book || !book.pdf_url) {
      return NextResponse.json({ error: 'PDF do livro não encontrado' }, { status: 404 })
    }

    // Limpar o caminho se contiver o nome do bucket no início
    const filePath = book.pdf_url.startsWith('book-pdfs/') 
      ? book.pdf_url.replace('book-pdfs/', '') 
      : book.pdf_url

    // 4. Gerar a URL assinada (Signed URL) com 1 hora de validade
    const adminSupabase = createAdminClient()
    const { data: signedData, error: signedError } = await adminSupabase
      .storage
      .from('book-pdfs')
      .createSignedUrl(filePath, 3600)

    if (signedError || !signedData) {
      return NextResponse.json({ error: 'Erro ao gerar URL do leitor: ' + signedError?.message }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: signedData.signedUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
