import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ClubeDetailClient from './ClubeDetailClient'

export const revalidate = 0

export const metadata = {
  title: 'Detalhes do Clube | Biblioteca Digital',
}

export default async function ClubeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  const adminSupabase = createAdminClient()

  const { data: student } = await adminSupabase
    .from('students')
    .select('id, full_name')
    .eq('auth_user_id', user.id)
    .single()

  if (!student) {
    redirect('/unauthorized')
  }

  const { data: club } = await adminSupabase
    .from('book_clubs')
    .select(`
      id, name, description,
      book:book_id (id, title, cover_url, synopsis)
    `)
    .eq('id', params.id)
    .single()

  if (!club) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <p className="text-slate-600 dark:text-slate-400">Clube não encontrado.</p>
        <Link href="/aluno/clubes" className="text-indigo-600 mt-4 inline-block font-semibold">Voltar para Clubes</Link>
      </div>
    )
  }

  const { data: membership } = await adminSupabase
    .from('club_members')
    .select('id')
    .eq('club_id', club.id)
    .eq('student_id', student.id)
    .maybeSingle()

  if (!membership) {
    redirect('/aluno/clubes')
  }

  const { data: rawMembers } = await adminSupabase
    .from('club_members')
    .select('id, student_id, joined_at')
    .eq('club_id', club.id)

  const { data: rawDiscussions } = await adminSupabase
    .from('club_discussions')
    .select('id, student_id, message, created_at')
    .eq('club_id', club.id)
    .eq('approved', true)
    .order('created_at', { ascending: true })

  // Buscar nomes de todos os alunos do clube
  const { data: allStudents } = await adminSupabase
    .from('students')
    .select('id, full_name')

  const studentMap = new Map((allStudents || []).map(s => [s.id, s.full_name]))

  const members = (rawMembers || []).map(m => ({
    ...m,
    student: {
      id: m.student_id,
      full_name: studentMap.get(m.student_id) || 'Aluno'
    }
  }))

  const discussions = (rawDiscussions || []).map(d => ({
    ...d,
    student: {
      full_name: studentMap.get(d.student_id) || 'Aluno'
    }
  }))

  const bookData: any = Array.isArray(club.book) ? club.book[0] : club.book

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl">
      <Link href="/aluno/clubes" className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors">
        <ArrowLeft size={20} />
        <span>Voltar para Clubes</span>
      </Link>

      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 mb-8 flex flex-col md:flex-row gap-8">
        <div className="w-48 h-72 relative rounded-xl overflow-hidden shrink-0 mx-auto md:mx-0 bg-slate-100 dark:bg-slate-700">
          {bookData?.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bookData.cover_url} alt={bookData.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">Sem Capa</div>
          )}
        </div>
        
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{club.name}</h1>
          <h2 className="text-xl text-indigo-600 dark:text-indigo-400 mb-4">{bookData?.title}</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {club.description || bookData?.synopsis || 'Sem descrição.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Membros</h3>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4">
            {(members || []).map((m: any, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{m.student?.full_name || 'Aluno'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <ClubeDetailClient 
            clubId={club.id} 
            studentId={student.id} 
            initialDiscussions={discussions || []} 
          />
        </div>
      </div>
    </div>
  )
}
