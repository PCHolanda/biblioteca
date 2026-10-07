import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import LeitorClient from '../../components/LeitorClient'

export const revalidate = 0
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface LeitorPageProps {
  params: {
    id: string
  }
}

export default async function LeitorPage({ params }: LeitorPageProps) {
  const bookId = params.id
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!student) {
    redirect('/unauthorized')
  }

  const studentId = student.id

  // Obter metadados do livro
  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .single()

  if (!book || !book.pdf_url) {
    notFound()
  }

  // Gerar URL assinada (Signed URL) do PDF
  const filePath = book.pdf_url.startsWith('book-pdfs/') 
    ? book.pdf_url.replace('book-pdfs/', '') 
    : book.pdf_url

  const adminSupabase = createAdminClient()
  const { data: signedData } = await adminSupabase
    .storage
    .from('book-pdfs')
    .createSignedUrl(filePath, 3600) // Válido por 1 hora

  if (!signedData || !signedData.signedUrl) {
    return (
      <div className="text-center py-12 text-slate-400">
        Não foi possível abrir o leitor. Tente novamente mais tarde.
      </div>
    )
  }

  // Obter progresso de leitura atual
  const { data: progress } = await supabase
    .from('reading_progress')
    .select('current_page')
    .eq('student_id', studentId)
    .eq('book_id', bookId)
    .limit(1)
    .maybeSingle()

  const startPage = progress?.current_page || 1

  // Verificar se é favorito
  const { data: favorite } = await supabase
    .from('favorites')
    .select('id')
    .eq('student_id', studentId)
    .eq('book_id', bookId)
    .limit(1)
    .maybeSingle()

  const isFavorite = !!favorite

  return (
    <LeitorClient
      book={book}
      pdfUrl={signedData.signedUrl}
      startPage={startPage}
      isFavorite={isFavorite}
      studentId={studentId}
    />
  )
}
