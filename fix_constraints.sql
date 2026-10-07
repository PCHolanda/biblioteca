-- ==========================================
-- CORREÇÃO DE CONSTRAINTS (RESTRIÇÕES ÚNICAS)
-- Rode este script no SQL Editor do Supabase para corrigir os erros de salvamento
-- ==========================================

-- 1. Garante que cada aluno tenha apenas UM registro de progresso por livro
ALTER TABLE public.reading_progress 
ADD CONSTRAINT reading_progress_student_book_unique UNIQUE (student_id, book_id);

-- 2. Garante que cada aluno tenha apenas UM registro de gamificação (XP)
ALTER TABLE public.student_gamification 
ADD CONSTRAINT student_gamification_student_unique UNIQUE (student_id);

-- 3. Garante que cada cliente/escola tenha apenas UMA configuração de quiz
ALTER TABLE public.quiz_config 
ADD CONSTRAINT quiz_config_client_unique UNIQUE (client_id);

-- 4. Garante que cada cliente/escola tenha apenas UMA configuração de gamificação
ALTER TABLE public.gamification_config 
ADD CONSTRAINT gamification_config_client_unique UNIQUE (client_id);

-- FIM.
