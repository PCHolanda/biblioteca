-- =========================================================================
-- CORREÇÃO DO LOOP INFINITO DE RLS NA TABELA PROFILES (Stack depth limit exceeded)
-- =========================================================================

-- 1. Remover políticas que chamam funções recursivas em profiles
DROP POLICY IF EXISTS superadmin_all_profiles ON public.profiles;
DROP POLICY IF EXISTS client_all_profiles ON public.profiles;
DROP POLICY IF EXISTS admin_all ON public.profiles;
DROP POLICY IF EXISTS user_select ON public.profiles;
DROP POLICY IF EXISTS user_update ON public.profiles;
DROP POLICY IF EXISTS user_read_own_profile ON public.profiles;
DROP POLICY IF EXISTS user_update_own_profile ON public.profiles;
DROP POLICY IF EXISTS admin_manage_profiles ON public.profiles;

-- 2. Permitir que cada usuário leia seu próprio perfil diretamente pelo ID (SEM RECURSÃO)
CREATE POLICY user_read_own_profile ON public.profiles 
FOR SELECT TO authenticated 
USING (auth.uid() = id);

-- 3. Permitir que cada usuário atualize seu próprio perfil
CREATE POLICY user_update_own_profile ON public.profiles 
FOR UPDATE TO authenticated 
USING (auth.uid() = id);

-- 4. Permitir que admin e superadmin acessem os perfis usando o JWT metadata (SEM RECURSÃO)
CREATE POLICY admin_manage_profiles ON public.profiles 
FOR ALL TO authenticated 
USING (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('admin', 'superadmin')
  OR auth.uid() = id
);
