import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Este bloco try/catch silencia erros caso setAll seja chamado
            // de dentro de um Server Component (onde cookies não podem ser alterados).
          }
        },
      },
    }
  )
}

// Cliente que ignora RLS usando a Service Role Key, útil para operações administrativas server-side
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  )
}
