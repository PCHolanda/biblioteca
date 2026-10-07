-- ==========================================
-- 1. CLEANUP (Para facilitar a execução repetida no editor SQL)
-- ==========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_eligible_books_for_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_eligible_books(UUID) CASCADE;

-- Limpar políticas existentes do storage
DROP POLICY IF EXISTS admin_storage_all ON storage.objects;
DROP POLICY IF EXISTS public_storage_select ON storage.objects;
DROP POLICY IF EXISTS teacher_storage_covers ON storage.objects;

DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.reading_progress CASCADE;
DROP TABLE IF EXISTS public.book_grade_levels CASCADE;
DROP TABLE IF EXISTS public.books CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.grade_levels CASCADE;
DROP TABLE IF EXISTS public.schools CASCADE;

-- ==========================================
-- 2. TABELAS DO MODELO DE DADOS
-- ==========================================

-- Tabela: schools
CREATE TABLE public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    logo_url TEXT,
    contact_name TEXT,
    contact_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: grade_levels (Séries globais)
CREATE TABLE public.grade_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    order_index INT NOT NULL,
    default_age_min INT NOT NULL,
    default_age_max INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: classes (Turmas)
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES public.grade_levels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    year INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: students (Alunos)
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

-- Tabela: profiles (Espelho de auth.users para permissões)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student', 'teacher')),
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: books (Livros)
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela N:N: book_grade_levels
CREATE TABLE public.book_grade_levels (
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES public.grade_levels(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, grade_level_id)
);

-- Tabela: reading_progress (Progresso de leitura)
CREATE TABLE public.reading_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    current_page INT NOT NULL DEFAULT 1,
    total_pages INT NOT NULL DEFAULT 1,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (student_id, book_id)
);

-- Tabela: favorites (Livros favoritos)
CREATE TABLE public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, book_id)
);

-- ==========================================
-- 3. TRIGGERS E FUNÇÕES AUXILIARES
-- ==========================================

-- Trigger para atualizar profiles automaticamente quando um usuário se cadastrar no auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    COALESCE(new.raw_user_meta_data->>'display_name', new.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para updated_at automático nas tabelas
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_schools_modtime BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_grade_levels_modtime BEFORE UPDATE ON public.grade_levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classes_modtime BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_modtime BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_books_modtime BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 4. FUNÇÕES DE ELEGIBILIDADE DE LIVROS
-- ==========================================

-- get_eligible_books(student_id): Retorna os livros elegíveis para um estudante
CREATE OR REPLACE FUNCTION public.get_eligible_books(p_student_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    author TEXT,
    synopsis TEXT,
    cover_url TEXT,
    pdf_url TEXT,
    genre TEXT,
    tags TEXT[],
    age_min INT,
    age_max INT,
    created_by UUID,
    school_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_birth_date DATE;
    v_grade_level_id UUID;
    v_school_id UUID;
    v_age INT;
    v_default_age_min INT;
    v_default_age_max INT;
BEGIN
    -- Obter informações do aluno, série e escola
    SELECT s.birth_date, c.grade_level_id, c.school_id, gl.default_age_min, gl.default_age_max
    INTO v_birth_date, v_grade_level_id, v_school_id, v_default_age_min, v_default_age_max
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    JOIN public.grade_levels gl ON c.grade_level_id = gl.id
    WHERE s.id = p_student_id;

    -- Se o aluno não for encontrado, não retorna nada
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Calcular idade (em anos completos)
    v_age := date_part('year', age(current_date, v_birth_date));

    RETURN QUERY
    WITH book_defaults AS (
        -- Calcula o menor default_age_min e maior default_age_max a partir das séries recomendadas
        SELECT 
            b.id AS book_id,
            MIN(gl.default_age_min) AS def_min,
            MAX(gl.default_age_max) AS def_max
        FROM public.books b
        LEFT JOIN public.book_grade_levels bgl ON b.id = bgl.book_id
        LEFT JOIN public.grade_levels gl ON bgl.grade_level_id = gl.id
        GROUP BY b.id
    )
    SELECT DISTINCT b.id, b.title, b.author, b.synopsis, b.cover_url, b.pdf_url, b.genre, b.tags, b.age_min, b.age_max, b.created_by, b.school_id, b.created_at, b.updated_at
    FROM public.books b
    LEFT JOIN public.book_grade_levels bgl ON b.id = bgl.book_id
    LEFT JOIN book_defaults bd ON b.id = bd.book_id
    WHERE 
        -- Regra da Escola: O livro deve pertencer à escola do aluno (ou ser legado global se school_id for nulo)
        (b.school_id IS NULL OR b.school_id = v_school_id)
        AND
        (
            -- Regra A: A série do aluno está explicitamente vinculada ao livro
            (bgl.grade_level_id = v_grade_level_id)
            OR
            -- Regra B: A idade do aluno cai na faixa efetiva do livro
            (
                v_age >= COALESCE(b.age_min, bd.def_min, 0) AND
                v_age <= COALESCE(b.age_max, bd.def_max, 99)
            )
        );
END;
$$;

-- get_eligible_books_for_user(user_id): Retorna os IDs dos livros elegíveis baseados no auth.uid() do aluno
CREATE OR REPLACE FUNCTION public.get_eligible_books_for_user(p_user_id UUID)
RETURNS TABLE (book_id UUID) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student_id UUID;
BEGIN
    SELECT id INTO v_student_id FROM public.students WHERE auth_user_id = p_user_id;
    IF v_student_id IS NOT NULL THEN
        RETURN QUERY 
        SELECT id FROM public.get_eligible_books(v_student_id);
    END IF;
END;
$$;

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Ativar RLS
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Auxiliar: Admin tem acesso total a tudo
-- Podemos criar uma política geral ou políticas explícitas. Criaremos políticas separadas.

-- Políticas para: schools
CREATE POLICY admin_all ON public.schools FOR ALL TO authenticated USING (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
CREATE POLICY student_select ON public.schools FOR SELECT TO authenticated USING (true);

-- Políticas para: grade_levels
CREATE POLICY admin_all ON public.grade_levels FOR ALL TO authenticated USING (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
CREATE POLICY student_select ON public.grade_levels FOR SELECT TO authenticated USING (true);

-- Políticas para: classes
CREATE POLICY admin_all ON public.classes FOR ALL TO authenticated USING (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
CREATE POLICY student_select ON public.classes FOR SELECT TO authenticated USING (true);

-- Políticas para: students
CREATE POLICY admin_all ON public.students FOR ALL TO authenticated USING (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
CREATE POLICY student_select ON public.students FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);

-- Políticas para: profiles
CREATE POLICY admin_all ON public.profiles FOR ALL TO authenticated USING (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
CREATE POLICY user_select ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY user_update ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Políticas para: books
CREATE POLICY admin_all ON public.books FOR ALL TO authenticated USING (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
CREATE POLICY student_select_eligible ON public.books FOR SELECT TO authenticated USING (
    id IN (SELECT book_id FROM public.get_eligible_books_for_user(auth.uid()))
);

-- Políticas para: book_grade_levels
CREATE POLICY admin_all ON public.book_grade_levels FOR ALL TO authenticated USING (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
CREATE POLICY student_select_eligible_relation ON public.book_grade_levels FOR SELECT TO authenticated USING (
    book_id IN (SELECT book_id FROM public.get_eligible_books_for_user(auth.uid()))
);

-- Políticas para: reading_progress
CREATE POLICY admin_all ON public.reading_progress FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY student_progress_all ON public.reading_progress FOR ALL TO authenticated USING (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
) WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
);

-- Políticas para: favorites
CREATE POLICY admin_all ON public.favorites FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY student_favorites_all ON public.favorites FOR ALL TO authenticated USING (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
) WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
);

-- ==========================================
-- 6. CONFIGURAÇÃO DE BUCKETS DE STORAGE (POLICIES)
-- ==========================================
-- No Supabase, buckets de storage são criados via insert na tabela `storage.buckets`.
-- Vamos rodar scripts para garantir que os buckets existam.

INSERT INTO storage.buckets (id, name, public) VALUES ('school-logos', 'school-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('book-pdfs', 'book-pdfs', false) ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para Storage (storage.objects)
-- Admin pode fazer qualquer coisa em todos os buckets
-- Alunos podem ler ('SELECT') dos buckets públicos 'school-logos' e 'covers'.
-- Alunos NÃO podem ver arquivos diretamente do bucket 'book-pdfs' a menos que seja via Signed URL (gerado pelo backend do Next.js via service_role).
-- Logo, não damos permissão de SELECT no bucket 'book-pdfs' para alunos autenticados.

CREATE POLICY admin_storage_all ON storage.objects FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY public_storage_select ON storage.objects FOR SELECT TO public USING (
    bucket_id IN ('school-logos', 'covers')
);

-- Professor pode enviar, alterar e excluir capas do bucket covers
CREATE POLICY teacher_storage_covers ON storage.objects FOR ALL TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    bucket_id = 'covers'
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    bucket_id = 'covers'
);

-- ==========================================
-- 7. SEED DE DADOS (EXEMPLOS)
-- ==========================================

-- Escola de Exemplo
INSERT INTO public.schools (id, name, address, contact_name, contact_email)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Escola Mundial',
    'Rua das Flores, 123 - Centro',
    'Diretora Helena',
    'contato@escolamundial.edu.br'
) ON CONFLICT (id) DO NOTHING;

-- Séries Globais (Grade Levels)
-- 1º Ano (6-7 anos)
INSERT INTO public.grade_levels (id, name, order_index, default_age_min, default_age_max)
VALUES ('11111111-1111-1111-1111-111111111111', '1º ano', 1, 6, 7) ON CONFLICT (id) DO NOTHING;
-- 2º Ano (7-8 anos)
INSERT INTO public.grade_levels (id, name, order_index, default_age_min, default_age_max)
VALUES ('22222222-2222-2222-2222-222222222222', '2º ano', 2, 7, 8) ON CONFLICT (id) DO NOTHING;
-- 3º Ano (8-9 anos)
INSERT INTO public.grade_levels (id, name, order_index, default_age_min, default_age_max)
VALUES ('33333333-3333-3333-3333-333333333333', '3º ano', 3, 8, 9) ON CONFLICT (id) DO NOTHING;

-- Turmas (Classes)
-- 1º ano A (Ano Letivo 2026)
INSERT INTO public.classes (id, school_id, grade_level_id, name, year)
VALUES (
    'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
    '550e8400-e29b-41d4-a716-446655440000',
    '11111111-1111-1111-1111-111111111111',
    '1º ano A',
    2026
) ON CONFLICT (id) DO NOTHING;

-- 3º ano B (Ano Letivo 2026)
INSERT INTO public.classes (id, school_id, grade_level_id, name, year)
VALUES (
    'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
    '550e8400-e29b-41d4-a716-446655440000',
    '33333333-3333-3333-3333-333333333333',
    '3º ano B',
    2026
) ON CONFLICT (id) DO NOTHING;

-- Alunos (Students)
-- Aluno A: 6 anos de idade (Nascido em 2019-10-15) - Está no 1º Ano A
INSERT INTO public.students (id, class_id, full_name, birth_date, enrollment_code)
VALUES (
    'aa11aa11-11aa-11aa-11aa-11aa11aa11aa',
    'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
    'Gabriel Souza',
    '2019-10-15',
    'MAT001'
) ON CONFLICT (id) DO NOTHING;

-- Aluno B: 9 anos de idade (Nascido em 2017-05-20) - Está no 3º Ano B
INSERT INTO public.students (id, class_id, full_name, birth_date, enrollment_code)
VALUES (
    'bb22bb22-22bb-22bb-22bb-22bb22bb22bb',
    'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
    'Mariana Lima',
    '2017-05-20',
    'MAT002'
) ON CONFLICT (id) DO NOTHING;

-- Livros de Exemplo (Books)
-- Livro 1: O Pequeno Urso (Sem override de idade, associado ao 1º ano)
INSERT INTO public.books (id, title, author, synopsis, genre, tags)
VALUES (
    'b001b001-b001-b001-b001-b001b001b001',
    'O Pequeno Urso',
    'Ana Maria',
    'As aventuras de um urso brincalhão na floresta selvagem.',
    'Fantasia Infantil',
    ARRAY['urso', 'floresta', 'natureza']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.book_grade_levels (book_id, grade_level_id)
VALUES ('b001b001-b001-b001-b001-b001b001b001', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (book_id, grade_level_id) DO NOTHING;

-- Livro 2: Mistérios Matemáticos (Sem override de idade, associado ao 3º ano)
INSERT INTO public.books (id, title, author, synopsis, genre, tags)
VALUES (
    'b002b002-b002-b002-b002-b002b002b002',
    'Mistérios Matemáticos',
    'Professor Júlio',
    'Desvende enigmas e treine seu raciocínio com problemas curiosos.',
    'Didático',
    ARRAY['matematica', 'raciocinio', 'enigmas']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.book_grade_levels (book_id, grade_level_id)
VALUES ('b002b002-b002-b002-b002-b002b002b002', '33333333-3333-3333-3333-333333333333')
ON CONFLICT (book_id, grade_level_id) DO NOTHING;

-- Livro 3: Enciclopédia dos Animais (Sem séries específicas, override manual de 6 a 12 anos)
INSERT INTO public.books (id, title, author, synopsis, genre, tags, age_min, age_max)
VALUES (
    'b003b003-b003-b003-b003-b003b003b003',
    'Enciclopédia dos Animais',
    'Marta Rocha',
    'Tudo sobre mamíferos, aves, répteis e anfíbios de todo o mundo.',
    'Ciências',
    ARRAY['animais', 'natureza', 'ciencia'],
    6,
    12
) ON CONFLICT (id) DO NOTHING;

-- Livro 4: Aventuras no Espaço (Associado ao 3º ano, override manual de 9 a 14 anos)
INSERT INTO public.books (id, title, author, synopsis, genre, tags, age_min, age_max)
VALUES (
    'b004b004-b004-b004-b004-b004b004b004',
    'Aventuras no Espaço',
    'Carlos Sagan',
    'Uma viagem fantástica pelo sistema solar e além.',
    'Ficção Científica',
    ARRAY['espaco', 'planetas', 'viagem'],
    9,
    14
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.book_grade_levels (book_id, grade_level_id)
VALUES ('b004b004-b004-b004-b004-b004b004b004', '33333333-3333-3333-3333-333333333333')
ON CONFLICT (book_id, grade_level_id) DO NOTHING;

-- ==========================================
-- 8. SEED DA CONTA ADMINISTRATIVA (PRE-DEFINIDA)
-- ==========================================
-- Habilitar pgcrypto para criptografia bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Inserir usuário Admin na tabela interna do Supabase Auth com todos os campos exigidos pelo GoTrue
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
    'd8cbe7b1-2e6f-47cf-8c8d-6a56cd532e8d',
    'authenticated',
    'authenticated',
    'admin@escola.com',
    extensions.crypt('admin', extensions.gen_salt('bf', 10)), -- Criptografa a senha 'admin'
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin","display_name":"Diretor Admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO UPDATE SET
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change = '';

-- Inserir a identidade em auth.identities (obrigatório para autenticação por email)
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
    'd8cbe7b1-2e6f-47cf-8c8d-6a56cd532e8d',
    'd8cbe7b1-2e6f-47cf-8c8d-6a56cd532e8d',
    jsonb_build_object('sub', 'd8cbe7b1-2e6f-47cf-8c8d-6a56cd532e8d', 'email', 'admin@escola.com'),
    'email',
    'd8cbe7b1-2e6f-47cf-8c8d-6a56cd532e8d',
    now(),
    now(),
    now()
) ON CONFLICT DO NOTHING;

-- Forçar criação/atualização do profile com a role 'admin'
INSERT INTO public.profiles (id, role, display_name)
VALUES ('d8cbe7b1-2e6f-47cf-8c8d-6a56cd532e8d', 'admin', 'Diretor Admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = 'Diretor Admin';

-- ==========================================
-- 9. SUPORTE PARA O PAPEL DE PROFESSOR
-- ==========================================

-- Tabela: teachers (Professores)
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES public.grade_levels(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_teachers_modtime ON public.teachers;
CREATE TRIGGER update_teachers_modtime BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Políticas RLS para teachers
DROP POLICY IF EXISTS admin_all_teachers ON public.teachers;
CREATE POLICY admin_all_teachers ON public.teachers FOR ALL TO authenticated 
USING (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');

DROP POLICY IF EXISTS teacher_select_self ON public.teachers;
CREATE POLICY teacher_select_self ON public.teachers FOR SELECT TO authenticated 
USING (auth.uid() = auth_user_id);

-- Políticas RLS para gerenciar estudantes por professor
DROP POLICY IF EXISTS teacher_manage_own_students ON public.students;
CREATE POLICY teacher_manage_own_students ON public.students FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    class_id = (SELECT class_id FROM public.teachers WHERE auth_user_id = auth.uid())
);

-- Políticas RLS para livros (Professor)
DROP POLICY IF EXISTS teacher_select_books ON public.books;
CREATE POLICY teacher_select_books ON public.books 
FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
);

DROP POLICY IF EXISTS teacher_insert_books ON public.books;
CREATE POLICY teacher_insert_books ON public.books 
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
);

DROP POLICY IF EXISTS teacher_update_books ON public.books;
CREATE POLICY teacher_update_books ON public.books 
FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    created_by = auth.uid()
)
WITH CHECK (
    created_by = auth.uid()
);

DROP POLICY IF EXISTS teacher_delete_books ON public.books;
CREATE POLICY teacher_delete_books ON public.books 
FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    created_by = auth.uid()
);

-- Políticas RLS para recomendações de livros (Professor)
DROP POLICY IF EXISTS teacher_modify_own_book_grades ON public.book_grade_levels;

DROP POLICY IF EXISTS teacher_select_book_grades ON public.book_grade_levels;
CREATE POLICY teacher_select_book_grades ON public.book_grade_levels 
FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
);

DROP POLICY IF EXISTS teacher_insert_book_grades ON public.book_grade_levels;
CREATE POLICY teacher_insert_book_grades ON public.book_grade_levels 
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
);

DROP POLICY IF EXISTS teacher_delete_book_grades ON public.book_grade_levels;
CREATE POLICY teacher_delete_book_grades ON public.book_grade_levels 
FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    book_id IN (SELECT id FROM public.books WHERE created_by = auth.uid())
);

-- ==========================================
-- 10. SISTEMA DE QUESTIONÁRIO DE LEITURA
-- ==========================================

-- Tabela: quiz_config (Configuração Global de Quizzes)
CREATE TABLE IF NOT EXISTS public.quiz_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    num_questions INT NOT NULL DEFAULT 5,
    num_choices INT NOT NULL DEFAULT 4,
    passing_score INT NOT NULL DEFAULT 70,
    max_attempts INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_config ENABLE ROW LEVEL SECURITY;

-- Admin pode ler e alterar a configuração
DROP POLICY IF EXISTS admin_all_quiz_config ON public.quiz_config;
CREATE POLICY admin_all_quiz_config ON public.quiz_config FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Qualquer usuário autenticado pode ler a configuração (necessário para o endpoint de geração)
DROP POLICY IF EXISTS authenticated_select_quiz_config ON public.quiz_config;
CREATE POLICY authenticated_select_quiz_config ON public.quiz_config FOR SELECT TO authenticated
USING (true);

-- Inserir configuração padrão
INSERT INTO public.quiz_config (num_questions, num_choices, passing_score, max_attempts)
VALUES (5, 4, 70, 0)
ON CONFLICT DO NOTHING;

-- Tabela: quiz_attempts (Tentativas de Quiz dos Alunos)
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
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

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Admin pode ver todas as tentativas
DROP POLICY IF EXISTS admin_all_quiz_attempts ON public.quiz_attempts;
CREATE POLICY admin_all_quiz_attempts ON public.quiz_attempts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Aluno pode ver suas próprias tentativas
DROP POLICY IF EXISTS student_select_own_quiz_attempts ON public.quiz_attempts;
CREATE POLICY student_select_own_quiz_attempts ON public.quiz_attempts FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student') AND
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
);

-- Inserção de tentativas via service role (backend) - não precisa de policy de INSERT para aluno
-- O endpoint de submit usa createAdminClient() para inserir

-- Professor pode ver tentativas dos alunos da sua turma
DROP POLICY IF EXISTS teacher_select_quiz_attempts ON public.quiz_attempts;
CREATE POLICY teacher_select_quiz_attempts ON public.quiz_attempts FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    student_id IN (
        SELECT s.id FROM public.students s
        INNER JOIN public.teachers t ON s.class_id = t.class_id
        WHERE t.auth_user_id = auth.uid()
    )
);

-- Tabela: book_quiz_questions (Banco de 50 Questões por Livro)
CREATE TABLE IF NOT EXISTS public.book_quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    choices JSONB NOT NULL,
    correct_index INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca rápida de questões por livro
CREATE INDEX IF NOT EXISTS idx_book_quiz_questions_book_id ON public.book_quiz_questions(book_id);

ALTER TABLE public.book_quiz_questions ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode consultar as questões (usado na geração randômica para o aluno)
DROP POLICY IF EXISTS authenticated_select_book_quiz_questions ON public.book_quiz_questions;
CREATE POLICY authenticated_select_book_quiz_questions ON public.book_quiz_questions FOR SELECT TO authenticated
USING (true);

-- Admin pode gerenciar todas as questões
DROP POLICY IF EXISTS admin_all_book_quiz_questions ON public.book_quiz_questions;
CREATE POLICY admin_all_book_quiz_questions ON public.book_quiz_questions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Professor pode gerenciar questões dos livros que cadastrou
DROP POLICY IF EXISTS teacher_all_book_quiz_questions ON public.book_quiz_questions;
CREATE POLICY teacher_all_book_quiz_questions ON public.book_quiz_questions FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    book_id IN (SELECT id FROM public.books WHERE created_by = auth.uid())
);

-- ==========================================
-- 11. GAMIFICAÇÃO, STREAK E CLUBE DO LIVRO
-- ==========================================

-- Tabela: student_gamification (Estado de gamificação de cada aluno)
CREATE TABLE IF NOT EXISTS public.student_gamification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
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

ALTER TABLE public.student_gamification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_student_gamification ON public.student_gamification;
CREATE POLICY admin_all_student_gamification ON public.student_gamification FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS student_select_own_gamification ON public.student_gamification;
CREATE POLICY student_select_own_gamification ON public.student_gamification FOR SELECT TO authenticated
USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS teacher_select_class_gamification ON public.student_gamification;
CREATE POLICY teacher_select_class_gamification ON public.student_gamification FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    student_id IN (
        SELECT s.id FROM public.students s
        INNER JOIN public.teachers t ON s.class_id = t.class_id
        WHERE t.auth_user_id = auth.uid()
    )
);

-- Tabela: xp_log (Histórico de ganho de XP)
CREATE TABLE IF NOT EXISTS public.xp_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    xp_amount INT NOT NULL,
    reason TEXT NOT NULL,
    book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_log_student ON public.xp_log(student_id);

ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_xp_log ON public.xp_log;
CREATE POLICY admin_all_xp_log ON public.xp_log FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS student_select_own_xp_log ON public.xp_log;
CREATE POLICY student_select_own_xp_log ON public.xp_log FOR SELECT TO authenticated
USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));

-- Tabela: badges (Definição de conquistas disponíveis)
CREATE TABLE IF NOT EXISTS public.badges (
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

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_select_badges ON public.badges;
CREATE POLICY authenticated_select_badges ON public.badges FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS admin_all_badges ON public.badges;
CREATE POLICY admin_all_badges ON public.badges FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tabela: student_badges (Badges desbloqueados por cada aluno)
CREATE TABLE IF NOT EXISTS public.student_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, badge_id)
);

ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_student_badges ON public.student_badges;
CREATE POLICY admin_all_student_badges ON public.student_badges FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS student_select_own_badges ON public.student_badges;
CREATE POLICY student_select_own_badges ON public.student_badges FOR SELECT TO authenticated
USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));

-- Tabela: book_clubs (Clubes do Livro)
CREATE TABLE IF NOT EXISTS public.book_clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    max_members INT NOT NULL DEFAULT 6,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_book_clubs ON public.book_clubs;
CREATE POLICY admin_all_book_clubs ON public.book_clubs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS teacher_all_book_clubs ON public.book_clubs;
CREATE POLICY teacher_all_book_clubs ON public.book_clubs FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    created_by = auth.uid()
);

DROP POLICY IF EXISTS student_select_book_clubs ON public.book_clubs;
CREATE POLICY student_select_book_clubs ON public.book_clubs FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student') AND
    (class_id IS NULL OR class_id IN (
        SELECT s.class_id FROM public.students s WHERE s.auth_user_id = auth.uid()
    ))
);

-- Tabela: club_members (Membros de cada clube)
CREATE TABLE IF NOT EXISTS public.club_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (club_id, student_id)
);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_club_members ON public.club_members;
CREATE POLICY admin_all_club_members ON public.club_members FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS teacher_all_club_members ON public.club_members;
CREATE POLICY teacher_all_club_members ON public.club_members FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    club_id IN (SELECT id FROM public.book_clubs WHERE created_by = auth.uid())
);

DROP POLICY IF EXISTS student_select_club_members ON public.club_members;
CREATE POLICY student_select_club_members ON public.club_members FOR SELECT TO authenticated
USING (
    club_id IN (SELECT club_id FROM public.club_members WHERE student_id IN (
        SELECT id FROM public.students WHERE auth_user_id = auth.uid()
    ))
);

DROP POLICY IF EXISTS student_join_club ON public.club_members;
CREATE POLICY student_join_club ON public.club_members FOR INSERT TO authenticated
WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
);

-- Tabela: club_discussions (Mural de discussão do clube)
CREATE TABLE IF NOT EXISTS public.club_discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.club_discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_club_discussions ON public.club_discussions;
CREATE POLICY admin_all_club_discussions ON public.club_discussions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS teacher_all_club_discussions ON public.club_discussions;
CREATE POLICY teacher_all_club_discussions ON public.club_discussions FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') AND
    club_id IN (SELECT id FROM public.book_clubs WHERE created_by = auth.uid())
);

DROP POLICY IF EXISTS student_select_approved_discussions ON public.club_discussions;
CREATE POLICY student_select_approved_discussions ON public.club_discussions FOR SELECT TO authenticated
USING (approved = true);

DROP POLICY IF EXISTS student_insert_discussion ON public.club_discussions;
CREATE POLICY student_insert_discussion ON public.club_discussions FOR INSERT TO authenticated
WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()) AND
    club_id IN (SELECT club_id FROM public.club_members WHERE student_id IN (
        SELECT id FROM public.students WHERE auth_user_id = auth.uid()
    ))
);

-- ==========================================
-- SEED: Badges pré-definidos
-- ==========================================
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

-- ==========================================
-- 12. CONFIGURAÇÃO DE GAMIFICAÇÃO & NÍVEIS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.gamification_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    levels JSONB NOT NULL DEFAULT '[
        {"level": 1, "min_xp": 0, "name": "Iniciante", "icon": "📖"},
        {"level": 2, "min_xp": 200, "name": "Explorador", "icon": "🔍"},
        {"level": 3, "min_xp": 500, "name": "Aventureiro", "icon": "⚔️"},
        {"level": 4, "min_xp": 1000, "name": "Sábio", "icon": "🧠"},
        {"level": 5, "min_xp": 2000, "name": "Mestre", "icon": "🎓"},
        {"level": 6, "min_xp": 5000, "name": "Lenda da Leitura", "icon": "👑"}
    ]'::jsonb,
    xp_per_page INT NOT NULL DEFAULT 1,
    xp_book_complete INT NOT NULL DEFAULT 50,
    xp_quiz_pass INT NOT NULL DEFAULT 100,
    xp_quiz_perfect INT NOT NULL DEFAULT 150,
    xp_streak_7 INT NOT NULL DEFAULT 30,
    xp_streak_30 INT NOT NULL DEFAULT 100,
    xp_club_join INT NOT NULL DEFAULT 20,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gamification_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_gamification_config ON public.gamification_config;
CREATE POLICY admin_all_gamification_config ON public.gamification_config FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS authenticated_select_gamification_config ON public.gamification_config;
CREATE POLICY authenticated_select_gamification_config ON public.gamification_config FOR SELECT TO authenticated
USING (true);

INSERT INTO public.gamification_config (
    xp_per_page, xp_book_complete, xp_quiz_pass, xp_quiz_perfect, xp_streak_7, xp_streak_30, xp_club_join
) VALUES (1, 50, 100, 150, 30, 100, 20)
ON CONFLICT DO NOTHING;

