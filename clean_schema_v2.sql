-- ==========================================
-- SCHEMA LIMPO (NOVO BANCO MULTI-TENANT)
-- ==========================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Limpeza (caso precise rodar de novo)
DROP TABLE IF EXISTS public.club_discussions CASCADE;
DROP TABLE IF EXISTS public.club_members CASCADE;
DROP TABLE IF EXISTS public.book_clubs CASCADE;
DROP TABLE IF EXISTS public.student_badges CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;
DROP TABLE IF EXISTS public.xp_log CASCADE;
DROP TABLE IF EXISTS public.student_gamification CASCADE;
DROP TABLE IF EXISTS public.gamification_config CASCADE;
DROP TABLE IF EXISTS public.quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.book_quiz_questions CASCADE;
DROP TABLE IF EXISTS public.quiz_config CASCADE;
DROP TABLE IF EXISTS public.reading_progress CASCADE;
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.book_grade_levels CASCADE;
DROP TABLE IF EXISTS public.books CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.grade_levels CASCADE;
DROP TABLE IF EXISTS public.schools CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;

-- 1. Clientes (SaaS)
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    contact_name TEXT,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Escolas
CREATE TABLE public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    logo_url TEXT,
    contact_name TEXT,
    contact_email TEXT,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Séries Globais
CREATE TABLE public.grade_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    order_index INT NOT NULL,
    default_age_min INT NOT NULL,
    default_age_max INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Turmas
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES public.grade_levels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    year INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Perfis (Usuários do Auth)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'client', 'admin', 'teacher', 'student')),
    display_name TEXT,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Professores
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES public.grade_levels(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Alunos
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    enrollment_code TEXT NOT NULL UNIQUE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Livros
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    synopsis TEXT,
    cover_url TEXT,
    pdf_url TEXT,
    genre TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    age_min INT,
    age_max INT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.book_grade_levels (
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES public.grade_levels(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, grade_level_id)
);

-- 9. Leitura e Progresso
CREATE TABLE public.reading_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    current_page INT NOT NULL DEFAULT 1,
    total_pages INT NOT NULL DEFAULT 1,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Quiz e Gamificação
CREATE TABLE public.quiz_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    num_questions INT NOT NULL DEFAULT 5,
    num_choices INT NOT NULL DEFAULT 4,
    passing_score INT NOT NULL DEFAULT 70,
    max_attempts INT NOT NULL DEFAULT 0,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.book_quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    choices JSONB NOT NULL,
    correct_index INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    score INT NOT NULL,
    total_questions INT NOT NULL,
    correct_answers INT NOT NULL,
    questions JSONB NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.gamification_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    levels JSONB NOT NULL DEFAULT '[{"icon": "📖", "name": "Iniciante", "level": 1, "min_xp": 0}]'::jsonb,
    xp_per_page INT NOT NULL DEFAULT 1,
    xp_book_complete INT NOT NULL DEFAULT 50,
    xp_quiz_pass INT NOT NULL DEFAULT 100,
    xp_quiz_perfect INT NOT NULL DEFAULT 150,
    xp_streak_7 INT NOT NULL DEFAULT 30,
    xp_streak_30 INT NOT NULL DEFAULT 100,
    xp_club_join INT NOT NULL DEFAULT 20,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.student_gamification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    total_xp INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_reading_date DATE,
    streak_shield BOOLEAN NOT NULL DEFAULT false,
    pages_read INT NOT NULL DEFAULT 0,
    books_completed INT NOT NULL DEFAULT 0,
    quizzes_passed INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.xp_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    xp_amount INT NOT NULL,
    reason TEXT NOT NULL,
    book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Conquistas (Badges)
CREATE TABLE public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    condition_type TEXT NOT NULL,
    condition_value INT NOT NULL DEFAULT 1,
    xp_reward INT NOT NULL DEFAULT 0,
    is_secret BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.student_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, badge_id)
);

-- 12. Clubes do Livro
CREATE TABLE public.book_clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    max_members INT NOT NULL DEFAULT 6,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.club_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.club_discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- FUNÇÕES AUXILIARES
-- ==========================================
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.user_client_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ==========================================
-- SEEDS BÁSICOS
-- ==========================================

-- Séries padrão
INSERT INTO public.grade_levels (id, name, order_index, default_age_min, default_age_max) VALUES
('11111111-1111-1111-1111-111111111111', '1º ano', 1, 6, 7),
('22222222-2222-2222-2222-222222222222', '2º ano', 2, 7, 8),
('33333333-3333-3333-3333-333333333333', '3º ano', 3, 8, 9),
('44444444-4444-4444-4444-444444444444', '4º ano', 4, 9, 10),
('55555555-5555-5555-5555-555555555555', '5º ano', 5, 10, 11)
ON CONFLICT (id) DO NOTHING;

-- Badges padrão
INSERT INTO public.badges (name, description, icon, category, condition_type, condition_value, xp_reward, is_secret) VALUES
('Primeiro Capítulo', 'Complete a leitura do seu primeiro livro', '📖', 'reading', 'books_completed', 1, 20, false),
('Devorador de Livros', 'Complete a leitura de 10 livros', '📚', 'reading', 'books_completed', 10, 50, false),
('Leitor Voraz', 'Complete a leitura de 25 livros', '🏆', 'reading', 'books_completed', 25, 100, true),
('Gênio do Quiz', 'Acerte 100% em um quiz', '⚡', 'quiz', 'perfect_quiz', 1, 30, false),
('Pensador Crítico', 'Seja aprovado em 10 quizzes', '🧠', 'quiz', 'quizzes_passed', 10, 50, false),
('Mestre dos Quizzes', 'Seja aprovado em 25 quizzes', '🎯', 'quiz', 'quizzes_passed', 25, 100, true),
('Chama Acesa', 'Mantenha uma sequência de 7 dias de leitura', '🔥', 'streak', 'streak_days', 7, 30, false),
('Inferno Literário', 'Mantenha uma sequência de 30 dias de leitura', '🌋', 'streak', 'streak_days', 30, 100, false),
('Explorador de Gêneros', 'Leia livros de 5 gêneros diferentes', '🌈', 'reading', 'genres_read', 5, 40, false),
('Amigo Leitor', 'Participe de um Clube do Livro', '🤝', 'social', 'club_member', 1, 20, false),
('Colecionador', 'Desbloqueie 10 badges', '💎', 'special', 'badges_unlocked', 10, 100, true),
('Lenda Suprema', 'Alcance 5000 XP no total', '👑', 'special', 'xp_total', 5000, 200, true)
ON CONFLICT DO NOTHING;

-- Bucket para logotipos de clientes
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- SUPER ADMIN PADRÃO (SEGURO E IDEMPOTENTE)
-- ==========================================
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- 1. Verifica se o usuário admin já existe pelo e-mail
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@escola.com' LIMIT 1;

    -- 2. Se não existir, cria no auth.users e auth.identities
    IF v_user_id IS NULL THEN
        v_user_id := 'd8cbe7b1-2e6f-47cf-8c8d-6a56cd532e8d';
        
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            'admin@escola.com',
            extensions.crypt('admin', extensions.gen_salt('bf', 10)),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"role":"superadmin","display_name":"Diretor Admin"}',
            now(),
            now(),
            '',
            '',
            '',
            ''
        );

        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', 'admin@escola.com'),
            'email',
            v_user_id::text,
            now(),
            now(),
            now()
        );
    ELSE
        -- Se já existir, garante a senha 'admin', confirmação e metadados de superadmin
        UPDATE auth.users
        SET 
            encrypted_password = extensions.crypt('admin', extensions.gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}',
            raw_user_meta_data = '{"role":"superadmin","display_name":"Diretor Admin"}',
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change = COALESCE(email_change, ''),
            updated_at = now()
        WHERE id = v_user_id;

        -- Garante identidade em auth.identities
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', 'admin@escola.com'),
            'email',
            v_user_id::text,
            now(),
            now(),
            now()
        )
        ON CONFLICT DO NOTHING;
    END IF;

    -- 3. Garante o perfil em public.profiles vinculado ao UUID correto do auth.users
    INSERT INTO public.profiles (id, role, display_name)
    VALUES (v_user_id, 'superadmin', 'Diretor Admin')
    ON CONFLICT (id) DO UPDATE SET role = 'superadmin', display_name = 'Diretor Admin';

END $$;

-- ==========================================
-- HABILITAR RLS E POLÍTICAS DE SEGURANÇA
-- ==========================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_read_own_profile" ON public.profiles;
CREATE POLICY "user_read_own_profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "user_update_own_profile" ON public.profiles;
CREATE POLICY "user_update_own_profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "admin_manage_profiles" ON public.profiles;
CREATE POLICY "admin_manage_profiles" ON public.profiles FOR ALL TO authenticated USING (public.user_role() IN ('admin', 'superadmin') OR auth.uid() = id);

-- Clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_clients" ON public.clients;
CREATE POLICY "superadmin_all_clients" ON public.clients FOR ALL TO authenticated USING (public.user_role() = 'superadmin');
DROP POLICY IF EXISTS "client_read_clients" ON public.clients;
CREATE POLICY "client_read_clients" ON public.clients FOR SELECT TO authenticated USING (public.user_role() IN ('client', 'admin') AND id = public.user_client_id());

-- Schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_schools" ON public.schools;
CREATE POLICY "superadmin_all_schools" ON public.schools FOR ALL TO authenticated USING (public.user_role() = 'superadmin');
DROP POLICY IF EXISTS "client_admin_schools" ON public.schools;
CREATE POLICY "client_admin_schools" ON public.schools FOR ALL TO authenticated USING (public.user_role() IN ('client', 'admin') AND client_id = public.user_client_id());
DROP POLICY IF EXISTS "user_read_schools" ON public.schools;
CREATE POLICY "user_read_schools" ON public.schools FOR SELECT TO authenticated USING (true);

-- Grade levels
ALTER TABLE public.grade_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_grade_levels" ON public.grade_levels;
CREATE POLICY "superadmin_all_grade_levels" ON public.grade_levels FOR ALL TO authenticated USING (public.user_role() = 'superadmin');
DROP POLICY IF EXISTS "authenticated_read_grade_levels" ON public.grade_levels;
CREATE POLICY "authenticated_read_grade_levels" ON public.grade_levels FOR SELECT TO authenticated USING (true);

-- Classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_classes" ON public.classes;
CREATE POLICY "superadmin_all_classes" ON public.classes FOR ALL TO authenticated USING (public.user_role() = 'superadmin');
DROP POLICY IF EXISTS "client_admin_classes" ON public.classes;
CREATE POLICY "client_admin_classes" ON public.classes FOR ALL TO authenticated USING (public.user_role() IN ('client', 'admin') AND school_id IN (SELECT id FROM public.schools WHERE client_id = public.user_client_id()));
DROP POLICY IF EXISTS "authenticated_read_classes" ON public.classes;
CREATE POLICY "authenticated_read_classes" ON public.classes FOR SELECT TO authenticated USING (true);

-- Teachers
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_teachers" ON public.teachers;
CREATE POLICY "superadmin_all_teachers" ON public.teachers FOR ALL TO authenticated USING (public.user_role() = 'superadmin');
DROP POLICY IF EXISTS "client_admin_teachers" ON public.teachers;
CREATE POLICY "client_admin_teachers" ON public.teachers FOR ALL TO authenticated USING (public.user_role() IN ('client', 'admin') AND school_id IN (SELECT id FROM public.schools WHERE client_id = public.user_client_id()));
DROP POLICY IF EXISTS "teacher_read_own" ON public.teachers;
CREATE POLICY "teacher_read_own" ON public.teachers FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

-- Students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_students" ON public.students;
CREATE POLICY "superadmin_all_students" ON public.students FOR ALL TO authenticated USING (public.user_role() = 'superadmin');
DROP POLICY IF EXISTS "client_admin_students" ON public.students;
CREATE POLICY "client_admin_students" ON public.students FOR ALL TO authenticated USING (public.user_role() IN ('client', 'admin') AND class_id IN (SELECT c.id FROM public.classes c JOIN public.schools s ON c.school_id = s.id WHERE s.client_id = public.user_client_id()));
DROP POLICY IF EXISTS "student_read_own" ON public.students;
CREATE POLICY "student_read_own" ON public.students FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
DROP POLICY IF EXISTS "anon_read_student_enrollment" ON public.students;
CREATE POLICY "anon_read_student_enrollment" ON public.students FOR SELECT TO anon USING (true);

-- Books
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_grade_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_books" ON public.books;
CREATE POLICY "authenticated_read_books" ON public.books FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_books" ON public.books;
CREATE POLICY "manage_books" ON public.books FOR ALL TO authenticated USING (public.user_role() IN ('superadmin', 'admin', 'client', 'teacher'));
DROP POLICY IF EXISTS "authenticated_read_book_grades" ON public.book_grade_levels;
CREATE POLICY "authenticated_read_book_grades" ON public.book_grade_levels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_book_grades" ON public.book_grade_levels;
CREATE POLICY "manage_book_grades" ON public.book_grade_levels FOR ALL TO authenticated USING (public.user_role() IN ('superadmin', 'admin', 'client', 'teacher'));

-- Reading, Gamification, Badges, Clubs
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reading_progress_all" ON public.reading_progress;
CREATE POLICY "reading_progress_all" ON public.reading_progress FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "favorites_all" ON public.favorites;
CREATE POLICY "favorites_all" ON public.favorites FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "quiz_config_select" ON public.quiz_config;
CREATE POLICY "quiz_config_select" ON public.quiz_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "quiz_config_manage" ON public.quiz_config;
CREATE POLICY "quiz_config_manage" ON public.quiz_config FOR ALL TO authenticated USING (public.user_role() IN ('superadmin', 'admin', 'client'));
DROP POLICY IF EXISTS "quiz_questions_select" ON public.book_quiz_questions;
CREATE POLICY "quiz_questions_select" ON public.book_quiz_questions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "quiz_questions_manage" ON public.book_quiz_questions;
CREATE POLICY "quiz_questions_manage" ON public.book_quiz_questions FOR ALL TO authenticated USING (public.user_role() IN ('superadmin', 'admin', 'client', 'teacher'));
DROP POLICY IF EXISTS "quiz_attempts_all" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_all" ON public.quiz_attempts FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "gamification_config_select" ON public.gamification_config;
CREATE POLICY "gamification_config_select" ON public.gamification_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "gamification_config_manage" ON public.gamification_config;
CREATE POLICY "gamification_config_manage" ON public.gamification_config FOR ALL TO authenticated USING (public.user_role() IN ('superadmin', 'admin', 'client'));
DROP POLICY IF EXISTS "student_gamification_all" ON public.student_gamification;
CREATE POLICY "student_gamification_all" ON public.student_gamification FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "xp_log_all" ON public.xp_log;
CREATE POLICY "xp_log_all" ON public.xp_log FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "badges_select" ON public.badges;
CREATE POLICY "badges_select" ON public.badges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "badges_manage" ON public.badges;
CREATE POLICY "badges_manage" ON public.badges FOR ALL TO authenticated USING (public.user_role() IN ('superadmin', 'admin', 'client'));
DROP POLICY IF EXISTS "student_badges_all" ON public.student_badges;
CREATE POLICY "student_badges_all" ON public.student_badges FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "book_clubs_all" ON public.book_clubs;
CREATE POLICY "book_clubs_all" ON public.book_clubs FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "club_members_all" ON public.club_members;
CREATE POLICY "club_members_all" ON public.club_members FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "club_discussions_all" ON public.club_discussions;
CREATE POLICY "club_discussions_all" ON public.club_discussions FOR ALL TO authenticated USING (true);

-- 11. BUCKETS E POLÍTICAS PARA STORAGE (storage.objects)
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('school-logos', 'school-logos', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('client-logos', 'client-logos', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('book-pdfs', 'book-pdfs', false) ON CONFLICT (id) DO UPDATE SET public = false;

-- Limpar políticas antigas do storage.objects para evitar conflito
DROP POLICY IF EXISTS "admin_storage_all" ON storage.objects;
DROP POLICY IF EXISTS "superadmin_client_storage_all" ON storage.objects;
DROP POLICY IF EXISTS "public_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "teacher_storage_covers" ON storage.objects;
DROP POLICY IF EXISTS "public_read_client_logos" ON storage.objects;
DROP POLICY IF EXISTS "storage_upload_all_roles" ON storage.objects;
DROP POLICY IF EXISTS "public_read_storage" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_storage" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_storage" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_storage" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_storage" ON storage.objects;

-- Leitura pública para buckets públicos
CREATE POLICY "public_read_storage" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id IN ('covers', 'school-logos', 'client-logos'));

-- Upload permitido para usuários autenticados (superadmin, client, admin, teacher)
CREATE POLICY "authenticated_upload_storage" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id IN ('covers', 'school-logos', 'client-logos')
  OR (
    bucket_id = 'book-pdfs' 
    AND public.user_role() IN ('superadmin', 'admin', 'client')
  )
);

-- Atualização de arquivos permitida
CREATE POLICY "authenticated_update_storage" ON storage.objects 
FOR UPDATE TO authenticated 
USING (
  bucket_id IN ('covers', 'school-logos', 'client-logos')
  OR (
    bucket_id = 'book-pdfs' 
    AND public.user_role() IN ('superadmin', 'admin', 'client')
  )
);

-- Deleção de arquivos permitida para administradores
CREATE POLICY "authenticated_delete_storage" ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id IN ('covers', 'school-logos', 'client-logos')
  OR (
    bucket_id = 'book-pdfs' 
    AND public.user_role() IN ('superadmin', 'admin', 'client')
  )
);

-- FIM.
