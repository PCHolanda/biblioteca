-- ==========================================
-- CORREÇÃO DE POLÍTICAS DE SEGURANÇA (RLS)
-- Rode este script no SQL Editor do Supabase para corrigir o Erro 403 no Insert
-- ==========================================

-- 1. Tabela reading_progress
DROP POLICY IF EXISTS "reading_progress_all" ON public.reading_progress;
DROP POLICY IF EXISTS "reading_progress_insert" ON public.reading_progress;
DROP POLICY IF EXISTS "reading_progress_update" ON public.reading_progress;
DROP POLICY IF EXISTS "reading_progress_select" ON public.reading_progress;

CREATE POLICY "reading_progress_select" ON public.reading_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "reading_progress_insert" ON public.reading_progress FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reading_progress_update" ON public.reading_progress FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "reading_progress_delete" ON public.reading_progress FOR DELETE TO authenticated USING (true);

-- 2. Tabela student_gamification
DROP POLICY IF EXISTS "student_gamification_all" ON public.student_gamification;
DROP POLICY IF EXISTS "student_gamification_insert" ON public.student_gamification;
DROP POLICY IF EXISTS "student_gamification_update" ON public.student_gamification;
DROP POLICY IF EXISTS "student_gamification_select" ON public.student_gamification;

CREATE POLICY "student_gamification_select" ON public.student_gamification FOR SELECT TO authenticated USING (true);
CREATE POLICY "student_gamification_insert" ON public.student_gamification FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "student_gamification_update" ON public.student_gamification FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 3. Tabela quiz_attempts
DROP POLICY IF EXISTS "quiz_attempts_all" ON public.quiz_attempts;
DROP POLICY IF EXISTS "quiz_attempts_insert" ON public.quiz_attempts;

CREATE POLICY "quiz_attempts_select" ON public.quiz_attempts FOR SELECT TO authenticated USING (true);
CREATE POLICY "quiz_attempts_insert" ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "quiz_attempts_update" ON public.quiz_attempts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- FIM.
