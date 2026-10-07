-- =========================================================================
-- CORREÇÃO DO ERRO 500 NO SUPABASE AUTH (Database error querying schema)
-- =========================================================================
-- Esse erro ocorre porque o usuário criado manualmente via SQL ficou com
-- campos de token como NULL e sem registro na tabela interna auth.identities.

-- 1. Preencher os campos obrigatórios que não podem ser NULL
UPDATE auth.users
SET 
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, '')
WHERE email = 'admin@escola.com';

-- 2. Inserir a identidade correspondente exigida pelo Supabase Auth (GoTrue)
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    id,
    id,
    json_build_object('sub', id::text, 'email', email)::jsonb,
    'email',
    id::text,
    now(),
    now(),
    now()
FROM auth.users
WHERE email = 'admin@escola.com'
ON CONFLICT DO NOTHING;

-- 3. Garantir que o perfil de superadmin está alinhado
INSERT INTO public.profiles (id, role, display_name)
VALUES ('d8cbe7b1-2e6f-47cf-8c8d-6a56cd532e8d', 'superadmin', 'Diretor Admin')
ON CONFLICT (id) DO UPDATE SET role = 'superadmin', display_name = 'Diretor Admin';
