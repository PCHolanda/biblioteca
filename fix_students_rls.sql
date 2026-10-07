-- ============================================================================
-- ATUALIZAÇÃO DAS POLÍTICAS DE RLS PARA A TABELA STUDENTS (ALUNOS)
-- Execute este script no SQL Editor do seu painel Supabase
-- ============================================================================

-- 1. Garante que as funções auxiliares estão atualizadas e com SECURITY DEFINER
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

-- 2. Habilita Row Level Security na tabela students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 3. Remove todas as políticas antigas para evitar qualquer conflito
DROP POLICY IF EXISTS "admin_all" ON public.students;
DROP POLICY IF EXISTS "superadmin_all_students" ON public.students;
DROP POLICY IF EXISTS "client_admin_students" ON public.students;
DROP POLICY IF EXISTS "client_all_students" ON public.students;
DROP POLICY IF EXISTS "teacher_manage_own_students" ON public.students;
DROP POLICY IF EXISTS "student_read_own" ON public.students;
DROP POLICY IF EXISTS "student_select" ON public.students;
DROP POLICY IF EXISTS "anon_read_student_enrollment" ON public.students;

-- 4. POLÍTICA: Superadmin tem controle total sobre todos os estudantes
CREATE POLICY "superadmin_all_students" ON public.students
FOR ALL TO authenticated
USING (public.user_role() = 'superadmin')
WITH CHECK (public.user_role() = 'superadmin');

-- 5. POLÍTICA: Clientes e Administradores da rede podem gerenciar (inserir, ver, editar, excluir) os alunos das suas escolas
CREATE POLICY "client_admin_students" ON public.students
FOR ALL TO authenticated
USING (
  public.user_role() IN ('client', 'admin')
  AND class_id IN (
    SELECT c.id FROM public.classes c
    JOIN public.schools s ON c.school_id = s.id
    WHERE s.client_id = public.user_client_id()
  )
)
WITH CHECK (
  public.user_role() IN ('client', 'admin')
  AND class_id IN (
    SELECT c.id FROM public.classes c
    JOIN public.schools s ON c.school_id = s.id
    WHERE s.client_id = public.user_client_id()
  )
);

-- 6. POLÍTICA: Professores podem gerenciar alunos da sua própria turma
CREATE POLICY "teacher_manage_own_students" ON public.students
FOR ALL TO authenticated
USING (
  public.user_role() = 'teacher'
  AND class_id = (SELECT class_id FROM public.teachers WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  public.user_role() = 'teacher'
  AND class_id = (SELECT class_id FROM public.teachers WHERE auth_user_id = auth.uid())
);

-- 7. POLÍTICA: Estudantes autenticados podem ver seus próprios dados
CREATE POLICY "student_read_own" ON public.students
FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

-- 8. POLÍTICA: Acesso anônimo apenas para leitura e conferência de matrícula no login do aluno
CREATE POLICY "anon_read_student_enrollment" ON public.students
FOR SELECT TO anon
USING (true);
