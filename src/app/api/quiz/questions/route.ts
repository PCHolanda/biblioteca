import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// 1. GET: Buscar todas as questões de um livro
export async function GET(req: NextRequest) {
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

    const adminSupabase = createAdminClient()
    const { data: questions, error } = await adminSupabase
      .from('book_quiz_questions')
      .select('id, book_id, question, choices, correct_index, created_at')
      .eq('book_id', bookId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Erro ao buscar questões:', error)
      return NextResponse.json({ error: 'Erro ao buscar questões do livro' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      questions: questions || []
    })
  } catch (err: any) {
    console.error('Erro no GET /api/quiz/questions:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

// 2. POST: Criar nova questão para o livro
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validar permissão (staff: admin, superadmin, client, teacher)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || (user.user_metadata?.role as string)
    const isStaff = ['admin', 'teacher', 'client', 'superadmin'].includes(role)
    if (!isStaff) {
      return NextResponse.json({ error: 'Apenas administradores e professores podem criar questões.' }, { status: 403 })
    }

    const body = await req.json()
    const { bookId, question, choices, correctIndex } = body

    if (!bookId) {
      return NextResponse.json({ error: 'bookId é obrigatório' }, { status: 400 })
    }

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'O enunciado da questão é obrigatório.' }, { status: 400 })
    }

    if (!Array.isArray(choices) || choices.length < 2) {
      return NextResponse.json({ error: 'A questão deve conter no mínimo 2 alternativas de resposta.' }, { status: 400 })
    }

    const cleanedChoices = choices.map((c) => String(c).trim()).filter(Boolean)
    if (cleanedChoices.length !== choices.length) {
      return NextResponse.json({ error: 'Todas as alternativas devem ter um texto preenchido.' }, { status: 400 })
    }

    const parsedCorrectIndex = Number(correctIndex)
    if (isNaN(parsedCorrectIndex) || parsedCorrectIndex < 0 || parsedCorrectIndex >= cleanedChoices.length) {
      return NextResponse.json({ error: 'Índice da resposta correta inválido.' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()
    const { data: newQuestion, error: insertError } = await adminSupabase
      .from('book_quiz_questions')
      .insert({
        book_id: bookId,
        question: question.trim(),
        choices: cleanedChoices,
        correct_index: parsedCorrectIndex
      })
      .select()
      .single()

    if (insertError) {
      console.error('Erro ao inserir questão:', insertError)
      return NextResponse.json({ error: 'Erro ao salvar questão no banco de dados' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      question: newQuestion
    })
  } catch (err: any) {
    console.error('Erro no POST /api/quiz/questions:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

// 3. PUT: Corrigir / Atualizar questão existente
export async function PUT(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validar permissão
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || (user.user_metadata?.role as string)
    const isStaff = ['admin', 'teacher', 'client', 'superadmin'].includes(role)
    if (!isStaff) {
      return NextResponse.json({ error: 'Apenas administradores e professores podem editar questões.' }, { status: 403 })
    }

    const body = await req.json()
    const { id, question, choices, correctIndex } = body

    if (!id) {
      return NextResponse.json({ error: 'ID da questão é obrigatório' }, { status: 400 })
    }

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'O enunciado da questão não pode ficar vazio.' }, { status: 400 })
    }

    if (!Array.isArray(choices) || choices.length < 2) {
      return NextResponse.json({ error: 'A questão deve conter no mínimo 2 alternativas de resposta.' }, { status: 400 })
    }

    const cleanedChoices = choices.map((c) => String(c).trim()).filter(Boolean)
    if (cleanedChoices.length !== choices.length) {
      return NextResponse.json({ error: 'Todas as alternativas devem ter um texto preenchido.' }, { status: 400 })
    }

    const parsedCorrectIndex = Number(correctIndex)
    if (isNaN(parsedCorrectIndex) || parsedCorrectIndex < 0 || parsedCorrectIndex >= cleanedChoices.length) {
      return NextResponse.json({ error: 'Índice da resposta correta inválido.' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()
    const { data: updatedQuestion, error: updateError } = await adminSupabase
      .from('book_quiz_questions')
      .update({
        question: question.trim(),
        choices: cleanedChoices,
        correct_index: parsedCorrectIndex
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Erro ao atualizar questão:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar questão no banco de dados' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      question: updatedQuestion
    })
  } catch (err: any) {
    console.error('Erro no PUT /api/quiz/questions:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

// 4. DELETE: Eliminar questão do banco
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validar permissão
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || (user.user_metadata?.role as string)
    const isStaff = ['admin', 'teacher', 'client', 'superadmin'].includes(role)
    if (!isStaff) {
      return NextResponse.json({ error: 'Apenas administradores e professores podem excluir questões.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID da questão é obrigatório para exclusão' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()
    const { error: deleteError } = await adminSupabase
      .from('book_quiz_questions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Erro ao excluir questão:', deleteError)
      return NextResponse.json({ error: 'Erro ao excluir questão do banco de dados' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deletedId: id
    })
  } catch (err: any) {
    console.error('Erro no DELETE /api/quiz/questions:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
