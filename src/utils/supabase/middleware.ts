import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Atualizar a sessão se necessário
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // Evitar loops em páginas públicas/não protegidas
  const isAuthPage = url.pathname === '/login' || url.pathname === '/'
  const isUnauthorizedPage = url.pathname === '/unauthorized'

  // Buscar papel do usuário com fallback para metadados de autenticação
  let role: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    role = profile?.role || (user.user_metadata?.role as string) || null
  }

  if (url.pathname.startsWith('/superadmin')) {
    if (!user) {
      url.pathname = '/login'
      return { response: NextResponse.redirect(url), user: null }
    }

    if (role !== 'superadmin') {
      url.pathname = '/unauthorized'
      return { response: NextResponse.redirect(url), user }
    }
  }

  if (url.pathname.startsWith('/admin')) {
    if (!user) {
      url.pathname = '/login'
      return { response: NextResponse.redirect(url), user: null }
    }

    if (role !== 'admin' && role !== 'client') {
      url.pathname = '/unauthorized'
      return { response: NextResponse.redirect(url), user }
    }
  }

  if (url.pathname.startsWith('/aluno')) {
    if (!user) {
      url.pathname = '/login'
      return { response: NextResponse.redirect(url), user: null }
    }

    if (role !== 'student') {
      url.pathname = '/unauthorized'
      return { response: NextResponse.redirect(url), user }
    }
  }

  if (url.pathname.startsWith('/professor')) {
    if (!user) {
      url.pathname = '/login'
      return { response: NextResponse.redirect(url), user: null }
    }

    if (role !== 'teacher') {
      url.pathname = '/unauthorized'
      return { response: NextResponse.redirect(url), user }
    }
  }

  // Redirecionamento inteligente ao acessar rotas básicas (/ ou /login) se já logado
  if (isAuthPage && user) {
    if (role === 'superadmin') {
      url.pathname = '/superadmin'
      return { response: NextResponse.redirect(url), user }
    } else if (role === 'admin' || role === 'client') {
      url.pathname = '/admin'
      return { response: NextResponse.redirect(url), user }
    } else if (role === 'student') {
      url.pathname = '/aluno'
      return { response: NextResponse.redirect(url), user }
    } else if (role === 'teacher') {
      url.pathname = '/professor'
      return { response: NextResponse.redirect(url), user }
    }
  }

  return { response: supabaseResponse, user }
}
