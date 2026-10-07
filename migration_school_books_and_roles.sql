-- =========================================================================
-- MIGRAÇÃO COMPLETA: LIVROS DA ESCOLA & REGRAS DE ACESSO DO PROFESSOR/ALUNO
-- =========================================================================

-- 1. Adicionar school_id na tabela books
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_books_school_id ON public.books(school_id);

-- 2. Remover permissões antigas de INSERT / UPDATE / DELETE de livros para Professores
DROP POLICY IF EXISTS teacher_insert_books ON public.books;
DROP POLICY IF EXISTS teacher_update_books ON public.books;
DROP POLICY IF EXISTS teacher_delete_books ON public.books;
DROP POLICY IF EXISTS teacher_modify_own_book_grades ON public.book_grade_levels;
DROP POLICY IF EXISTS teacher_storage_covers ON storage.objects;

-- 3. Dropar funções antigas (com CASCADE para recriar com a nova coluna school_id)
DROP FUNCTION IF EXISTS public.get_eligible_books(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_eligible_books_for_user(UUID) CASCADE;

-- 4. Criar a RPC get_eligible_books para filtrar pela escola do aluno
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
    -- Obter informações do aluno, sua série e sua escola
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
        -- Regra da Escola: o livro deve pertencer à escola do aluno (ou ser legado sem escola vinculada)
        (b.school_id IS NULL OR b.school_id = v_school_id)
        AND
        (
            -- Regra A: A série do aluno está explicitamente vinculada ao livro
            (bgl.grade_level_id = v_grade_level_id)
            OR
            -- Regra B: A idade do aluno cai na faixa etária recomendada
            (
                v_age >= COALESCE(b.age_min, bd.def_min, 0) AND
                v_age <= COALESCE(b.age_max, bd.def_max, 99)
            )
        );
END;
$$;

-- 5. Criar a função auxiliar get_eligible_books_for_user
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

-- 6. Recriar as políticas RLS para consulta de livros (Alunos e Professores)
DROP POLICY IF EXISTS student_select_eligible ON public.books;
CREATE POLICY student_select_eligible ON public.books 
FOR SELECT TO authenticated
USING (
    id IN (SELECT book_id FROM public.get_eligible_books_for_user(auth.uid()))
);

DROP POLICY IF EXISTS teacher_select_books ON public.books;
CREATE POLICY teacher_select_books ON public.books 
FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
);
