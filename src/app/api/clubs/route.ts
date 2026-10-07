import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('class_id')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const classId = student.class_id

    let query = supabase
      .from('book_clubs')
      .select(`
        id, name, description, max_members, start_date, end_date, status,
        book:book_id (id, title, cover_url),
        members:club_members (student_id)
      `)
      .eq('status', 'active')

    if (classId) {
      query = query.or(`class_id.eq.${classId},class_id.is.null`)
    } else {
      query = query.is('class_id', null)
    }

    const { data: clubs, error: clubsError } = await query

    if (clubsError) {
      return NextResponse.json({ error: clubsError.message }, { status: 500 })
    }

    const formattedClubs = (clubs || []).map(club => {
      const isMember = club.members.some((m: any) => m.student_id === studentId)
      return {
        ...club,
        member_count: club.members.length,
        is_member: isMember,
      }
    })

    return NextResponse.json({ clubs: formattedClubs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profileData?.role || (user.user_metadata?.role as string)
    const canCreateClub = ['superadmin', 'admin', 'client', 'teacher'].includes(role)
    if (!canCreateClub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, bookId, classId, maxMembers, startDate, endDate } = body

    const adminSupabase = createAdminClient()

    const { data: club, error: insertError } = await adminSupabase
      .from('book_clubs')
      .insert({
        name,
        description: description || null,
        book_id: bookId,
        class_id: classId || null,
        max_members: maxMembers || 6,
        start_date: startDate || null,
        end_date: endDate || null,
        status: 'active',
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Erro no insert do clube:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ club }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
