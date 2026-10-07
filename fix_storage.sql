-- =========================================================================
-- CORREÇÃO DEFINITIVA DE PERMISSÕES DO STORAGE (storage.objects)
-- =========================================================================

-- 1. Garantir que os buckets existam e estejam públicos onde necessário
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('school-logos', 'school-logos', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('client-logos', 'client-logos', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('book-pdfs', 'book-pdfs', false) ON CONFLICT (id) DO NOTHING;

-- 2. Limpar políticas antigas do storage.objects para evitar conflito
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

-- 3. Leitura pública de capas e logotipos
CREATE POLICY "public_read_storage" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id IN ('covers', 'school-logos', 'client-logos'));

-- 4. Inserção (Upload) de capas e logos para usuários da gestão (superadmin, admin, client, teacher)
CREATE POLICY "authenticated_upload_storage" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id IN ('covers', 'school-logos', 'client-logos')
  AND (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('superadmin', 'admin', 'client', 'teacher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin', 'client', 'teacher'))
  )
);

-- 5. Atualização e Exclusão de capas e logos
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
