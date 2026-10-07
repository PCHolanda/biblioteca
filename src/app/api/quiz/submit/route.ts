import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { bookId, studentId, questions } = body

    if (!bookId || !studentId || !questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // 3. Load quiz config for passing_score
    const { data: quizConfig, error: configError } = await supabase
      .from('quiz_config')
      .select('passing_score')
      .limit(1)
      .maybeSingle()

    const passingScorePercentage = quizConfig?.passing_score ?? 70

    // 4. Calculate score
    let correctAnswers = 0
    const totalQuestions = questions.length

    for (const q of questions) {
      if (q.studentAnswer === q.correctIndex) {
        correctAnswers++
      }
    }

    const score = (correctAnswers / totalQuestions) * 100

    // 5. Determine passed
    const passed = score >= passingScorePercentage

    // 6. Insert into quiz_attempts table using admin client
    const adminSupabase = createAdminClient()
    const { error: insertError } = await adminSupabase
      .from('quiz_attempts')
      .insert({
        student_id: studentId,
        book_id: bookId,
        score: Math.round(score),
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        questions: questions,
        passed: passed
      })

    if (insertError) {
      console.error("Erro ao salvar tentativa:", insertError)
      return NextResponse.json({ error: 'Falha ao salvar a tentativa do quiz' }, { status: 500 })
    }

    // 7. Se foi aprovado no quiz, marcar a leitura do livro como 100% concluída e conceder XP!
    let xpGained = 0

    if (passed) {
      await adminSupabase
        .from('reading_progress')
        .update({ completed: true })
        .eq('student_id', studentId)
        .eq('book_id', bookId)

      // Conceder XP por aprovação no Quiz (+100 XP)
      try {
        xpGained = Math.round(score) === 100 ? 150 : 100
        const xpReason = Math.round(score) === 100 ? 'quiz_perfect' : 'quiz_pass'
        
        const { data: gamif } = await adminSupabase
          .from('student_gamification')
          .select('*')
          .eq('student_id', studentId)
          .limit(1)
          .maybeSingle()

        const currentXp = (gamif?.total_xp || 0) + xpGained
        const currentQuizzes = (gamif?.quizzes_passed || 0) + 1
        const currentBooks = (gamif?.books_completed || 0) + 1
        
        let newLevel = 1
        if (currentXp >= 5000) newLevel = 6
        else if (currentXp >= 2000) newLevel = 5
        else if (currentXp >= 1000) newLevel = 4
        else if (currentXp >= 500) newLevel = 3
        else if (currentXp >= 200) newLevel = 2

        const gamifPayload = {
          total_xp: currentXp,
          level: newLevel,
          quizzes_passed: currentQuizzes,
          books_completed: currentBooks,
          updated_at: new Date().toISOString()
        }

        const { data: gamifUpdate, error: gamifUpdateErr } = await adminSupabase
          .from('student_gamification')
          .update(gamifPayload)
          .eq('student_id', studentId)
          .select()

        if (!gamifUpdateErr && (!gamifUpdate || gamifUpdate.length === 0)) {
          await adminSupabase.from('student_gamification').insert({
            student_id: studentId,
            ...gamifPayload
          })
        }

        await adminSupabase
          .from('xp_log')
          .insert({
            student_id: studentId,
            xp_amount: xpGained,
            reason: xpReason,
            book_id: bookId
          })
      } catch (gamifErr) {
        console.warn('Erro ao conceder XP do quiz:', gamifErr)
      }
    }

    // 8. Return result
    return NextResponse.json({
      score,
      passed,
      correctAnswers,
      totalQuestions,
      xpGained
    })

  } catch (error: any) {
    console.error("Quiz submit error:", error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
