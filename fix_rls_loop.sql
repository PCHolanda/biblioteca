-- Correção do Loop Infinito no RLS da tabela profiles
DROP POLICY IF EXISTS client_all_profiles ON public.profiles;
