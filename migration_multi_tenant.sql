-- =====================================================================================
-- MIGRAÇÃO MULTI-TENANT (CLIENTES E SUPER ADMIN)
-- =====================================================================================

-- 1. Criar Tabela de Clientes (Tenants)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    contact_name TEXT,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Atualizar tabela profiles (Adicionar novos papéis)
-- Removendo constraint antiga
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- Adicionando constraint nova (superadmin e client)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('superadmin', 'client', 'admin', 'teacher', 'student'));

-- Adicionar client_id no profile para associar um admin de cliente ao seu cliente
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 3. Adicionar client_id na tabela schools
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- 4. Adicionar client_id nas configurações
ALTER TABLE public.quiz_config ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.gamification_config ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- =====================================================================================
-- 5. MIGRAÇÃO DE DADOS EXISTENTES (LEGADO)
-- Vamos transformar o admin atual em 'superadmin' e associar todas as escolas
-- existentes a um cliente padrão para não perdermos o vínculo.
-- =====================================================================================
DO $$
DECLARE
    v_admin_id UUID;
    v_default_client_id UUID;
BEGIN
    -- Busca o admin atual
    SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
    
    IF v_admin_id IS NOT NULL THEN
        -- Promove o admin atual para superadmin
        UPDATE public.profiles SET role = 'superadmin' WHERE id = v_admin_id;
        
        -- Verifica se já existe um cliente
        SELECT id INTO v_default_client_id FROM public.clients LIMIT 1;
        
        IF v_default_client_id IS NULL THEN
            -- Cria o cliente legado
            INSERT INTO public.clients (name, contact_name, contact_email)
            VALUES ('Cliente Padrão (Legado)', 'Admin', 'admin@escola.com')
            RETURNING id INTO v_default_client_id;
        END IF;

        -- Vincula escolas órfãs ao cliente legado
        UPDATE public.schools SET client_id = v_default_client_id WHERE client_id IS NULL;
        
        -- Vincula configs órfãs
        UPDATE public.quiz_config SET client_id = v_default_client_id WHERE client_id IS NULL;
        UPDATE public.gamification_config SET client_id = v_default_client_id WHERE client_id IS NULL;
    END IF;
END $$;

-- =====================================================================================
-- 6. ATUALIZAÇÃO DAS POLÍTICAS RLS
-- Atualizamos as políticas para que superadmin veja tudo, e client veja apenas o seu.
-- =====================================================================================

-- Função auxiliar para simplificar as políticas (criada no schema public)
CREATE OR REPLACE FUNCTION public.user_role() RETURNS TEXT AS $$
  SELECT coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.user_client_id() RETURNS UUID AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$ LANGUAGE SQL STABLE;

-- Escolas (Schools)
DROP POLICY IF EXISTS admin_all ON public.schools;
CREATE POLICY superadmin_all_schools ON public.schools FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');
CREATE POLICY client_all_schools ON public.schools FOR ALL TO authenticated 
USING (public.user_role() = 'client' AND client_id = public.user_client_id());

-- Profiles
DROP POLICY IF EXISTS admin_all ON public.profiles;
CREATE POLICY superadmin_all_profiles ON public.profiles FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');
CREATE POLICY client_all_profiles ON public.profiles FOR ALL TO authenticated 
USING (public.user_role() = 'client' AND client_id = public.user_client_id());

-- Grade Levels (Globais - Todos podem ler, superadmin edita)
DROP POLICY IF EXISTS admin_all ON public.grade_levels;
CREATE POLICY superadmin_all_grade_levels ON public.grade_levels FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');
CREATE POLICY client_read_grade_levels ON public.grade_levels FOR SELECT TO authenticated 
USING (public.user_role() = 'client' OR public.user_role() = 'admin');

-- Classes
DROP POLICY IF EXISTS admin_all ON public.classes;
CREATE POLICY superadmin_all_classes ON public.classes FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');
CREATE POLICY client_all_classes ON public.classes FOR ALL TO authenticated 
USING (public.user_role() = 'client' AND school_id IN (SELECT id FROM public.schools WHERE client_id = public.user_client_id()));

-- Students
DROP POLICY IF EXISTS admin_all ON public.students;
CREATE POLICY superadmin_all_students ON public.students FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');
CREATE POLICY client_all_students ON public.students FOR ALL TO authenticated 
USING (public.user_role() = 'client' AND class_id IN (
    SELECT c.id FROM public.classes c JOIN public.schools s ON c.school_id = s.id WHERE s.client_id = public.user_client_id()
));

-- Teachers
DROP POLICY IF EXISTS admin_all_teachers ON public.teachers;
CREATE POLICY superadmin_all_teachers ON public.teachers FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');
CREATE POLICY client_all_teachers ON public.teachers FOR ALL TO authenticated 
USING (public.user_role() = 'client' AND school_id IN (SELECT id FROM public.schools WHERE client_id = public.user_client_id()));

-- Books (Todos leem, superadmin gerencia tudo, client edita apenas os que criou)
DROP POLICY IF EXISTS admin_all ON public.books;
CREATE POLICY superadmin_all_books ON public.books FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');
CREATE POLICY client_read_all_books ON public.books FOR SELECT TO authenticated 
USING (public.user_role() = 'client' OR public.user_role() = 'admin');
CREATE POLICY client_insert_books ON public.books FOR INSERT TO authenticated 
WITH CHECK (public.user_role() = 'client' OR public.user_role() = 'admin');
CREATE POLICY client_update_books ON public.books FOR UPDATE TO authenticated 
USING ((public.user_role() = 'client' OR public.user_role() = 'admin') AND created_by = auth.uid());
CREATE POLICY client_delete_books ON public.books FOR DELETE TO authenticated 
USING ((public.user_role() = 'client' OR public.user_role() = 'admin') AND created_by = auth.uid());

-- Quiz Config
DROP POLICY IF EXISTS admin_all_quiz_config ON public.quiz_config;
CREATE POLICY superadmin_all_quiz_config ON public.quiz_config FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');
CREATE POLICY client_all_quiz_config ON public.quiz_config FOR ALL TO authenticated 
USING (public.user_role() = 'client' AND client_id = public.user_client_id());

-- Gamification Config
DROP POLICY IF EXISTS admin_all_gamification_config ON public.gamification_config;
CREATE POLICY superadmin_all_gamification_config ON public.gamification_config FOR ALL TO authenticated 
USING (public.user_role() = 'superadmin');
CREATE POLICY client_all_gamification_config ON public.gamification_config FOR ALL TO authenticated 
USING (public.user_role() = 'client' AND client_id = public.user_client_id());
