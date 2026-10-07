-- =========================================================================
-- HABILITAR RLS E CRIAR POLÍTICAS SEGURAS (SEM RECURSÃO)
-- =========================================================================

-- 1. Otimizar a função user_role para ler direto do JWT (evita qualquer loop)
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

-- 2. POLÍTICAS PARA PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_read_own_profile" ON public.profiles;
CREATE POLICY "user_read_own_profile" ON public.profiles 
FOR SELECT TO authenticated 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "user_update_own_profile" ON public.profiles;
CREATE POLICY "user_update_own_profile" ON public.profiles 
FOR UPDATE TO authenticated 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin_manage_profiles" ON public.profiles;
CREATE POLICY "admin_manage_profiles" ON public.profiles 
FOR ALL TO authenticated 
USING (
  public.user_role() IN ('admin', 'superadmin')
  OR auth.uid() = id
);

-- 3. POLÍTICAS PARA CLIENTS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_all_clients" ON public.clients;
CREATE POLICY "superadmin_all_clients" ON public.clients 
FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');

DROP POLICY IF EXISTS "client_read_clients" ON public.clients;
CREATE POLICY "client_read_clients" ON public.clients 
FOR SELECT TO authenticated 
USING (public.user_role() IN ('client', 'admin') AND id = public.user_client_id());

-- 4. POLÍTICAS PARA SCHOOLS
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_all_schools" ON public.schools;
CREATE POLICY "superadmin_all_schools" ON public.schools 
FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');

DROP POLICY IF EXISTS "client_admin_schools" ON public.schools;
CREATE POLICY "client_admin_schools" ON public.schools 
FOR ALL TO authenticated 
USING (public.user_role() IN ('client', 'admin') AND client_id = public.user_client_id());

DROP POLICY IF EXISTS "user_read_schools" ON public.schools;
CREATE POLICY "user_read_schools" ON public.schools 
FOR SELECT TO authenticated 
USING (true);

-- 5. POLÍTICAS PARA GRADE_LEVELS
ALTER TABLE public.grade_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_all_grade_levels" ON public.grade_levels;
CREATE POLICY "superadmin_all_grade_levels" ON public.grade_levels 
FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');

DROP POLICY IF EXISTS "authenticated_read_grade_levels" ON public.grade_levels;
CREATE POLICY "authenticated_read_grade_levels" ON public.grade_levels 
FOR SELECT TO authenticated 
USING (true);

-- 6. POLÍTICAS PARA CLASSES
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_all_classes" ON public.classes;
CREATE POLICY "superadmin_all_classes" ON public.classes 
FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');

DROP POLICY IF EXISTS "client_admin_classes" ON public.classes;
CREATE POLICY "client_admin_classes" ON public.classes 
FOR ALL TO authenticated 
USING (
  public.user_role() IN ('client', 'admin') 
  AND school_id IN (SELECT id FROM public.schools WHERE client_id = public.user_client_id())
);

DROP POLICY IF EXISTS "authenticated_read_classes" ON public.classes;
CREATE POLICY "authenticated_read_classes" ON public.classes 
FOR SELECT TO authenticated 
USING (true);

-- 7. POLÍTICAS PARA TEACHERS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_all_teachers" ON public.teachers;
CREATE POLICY "superadmin_all_teachers" ON public.teachers 
FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');

DROP POLICY IF EXISTS "client_admin_teachers" ON public.teachers;
CREATE POLICY "client_admin_teachers" ON public.teachers 
FOR ALL TO authenticated 
USING (
  public.user_role() IN ('client', 'admin') 
  AND school_id IN (SELECT id FROM public.schools WHERE client_id = public.user_client_id())
);

DROP POLICY IF EXISTS "teacher_read_own" ON public.teachers;
CREATE POLICY "teacher_read_own" ON public.teachers 
FOR SELECT TO authenticated 
USING (auth_user_id = auth.uid());

-- 8. POLÍTICAS PARA STUDENTS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_all_students" ON public.students;
CREATE POLICY "superadmin_all_students" ON public.students 
FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');

DROP POLICY IF EXISTS "client_admin_students" ON public.students;
CREATE POLICY "client_admin_students" ON public.students 
FOR ALL TO authenticated 
USING (
  public.user_role() IN ('client', 'admin') 
  AND class_id IN (
    SELECT c.id FROM public.classes c 
    JOIN public.schools s ON c.school_id = s.id 
    WHERE s.client_id = public.user_client_id()
  )
);

DROP POLICY IF EXISTS "student_read_own" ON public.students;
CREATE POLICY "student_read_own" ON public.students 
FOR SELECT TO authenticated 
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "anon_read_student_enrollment" ON public.students;
CREATE POLICY "anon_read_student_enrollment" ON public.students 
FOR SELECT TO anon 
USING (true);

-- 9. POLÍTICAS PARA BOOKS E BOOK_GRADE_LEVELS
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_grade_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_books" ON public.books;
CREATE POLICY "authenticated_read_books" ON public.books 
FOR SELECT TO authenticated 
USING (true);

DROP POLICY IF EXISTS "manage_books" ON public.books;
CREATE POLICY "manage_books" ON public.books 
FOR ALL TO authenticated 
USING (public.user_role() IN ('superadmin', 'admin', 'client', 'teacher'));

DROP POLICY IF EXISTS "authenticated_read_book_grades" ON public.book_grade_levels;
CREATE POLICY "authenticated_read_book_grades" ON public.book_grade_levels 
FOR SELECT TO authenticated 
USING (true);

DROP POLICY IF EXISTS "manage_book_grades" ON public.book_grade_levels;
CREATE POLICY "manage_book_grades" ON public.book_grade_levels 
FOR ALL TO authenticated 
USING (public.user_role() IN ('superadmin', 'admin', 'client', 'teacher'));

-- 10. POLÍTICAS PARA GAMIFICAÇÃO, QUIZ E CLUBES
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

-- Reading & Favorites
DROP POLICY IF EXISTS "reading_progress_all" ON public.reading_progress;
CREATE POLICY "reading_progress_all" ON public.reading_progress FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "favorites_all" ON public.favorites;
CREATE POLICY "favorites_all" ON public.favorites FOR ALL TO authenticated USING (true);

-- Quiz
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

-- Gamification
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

-- Book clubs
DROP POLICY IF EXISTS "book_clubs_all" ON public.book_clubs;
CREATE POLICY "book_clubs_all" ON public.book_clubs FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "club_members_all" ON public.club_members;
CREATE POLICY "club_members_all" ON public.club_members FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "club_discussions_all" ON public.club_discussions;
CREATE POLICY "club_discussions_all" ON public.club_discussions FOR ALL TO authenticated USING (true);

-- ==========================================
-- 11. POLÍTICAS PARA STORAGE (storage.objects)
-- ==========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('school-logos', 'school-logos', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('client-logos', 'client-logos', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('book-pdfs', 'book-pdfs', false) ON CONFLICT (id) DO NOTHING;

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

-- Leitura pública de capas e logotipos
CREATE POLICY "public_read_storage" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id IN ('covers', 'school-logos', 'client-logos'));

-- Upload de capas e logos para usuários da gestão (superadmin, admin, client, teacher)
CREATE POLICY "authenticated_upload_storage" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id IN ('covers', 'school-logos', 'client-logos')
  AND (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('superadmin', 'admin', 'client', 'teacher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin', 'client', 'teacher'))
  )
);

-- Atualização e exclusão de capas e logos
CREATE POLICY "authenticated_update_storage" ON storage.objects 
FOR UPDATE TO authenticated 
USING (
  bucket_id IN ('covers', 'school-logos', 'client-logos')
  AND (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('superadmin', 'admin', 'client', 'teacher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin', 'client', 'teacher'))
  )
);

CREATE POLICY "authenticated_delete_storage" ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id IN ('covers', 'school-logos', 'client-logos')
  AND (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('superadmin', 'admin', 'client', 'teacher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin', 'client', 'teacher'))
  )
);
