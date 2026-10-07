import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import SuperAdminNavbar from './components/SuperAdminNavbar'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role || user.user_metadata?.role

  if (role !== 'superadmin') {
    redirect('/unauthorized')
  }

  const activeProfile = profile || {
    id: user.id,
    role: 'superadmin',
    display_name: user.user_metadata?.display_name || 'Super Admin',
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row">
      <SuperAdminNavbar profile={activeProfile} />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
