-- ==========================================
-- SCRIPT DE GERAÇÃO DE DADOS DE TESTE
-- Rode este script no SQL Editor do Supabase
-- ==========================================

-- 1. Variáveis (UUIDs fixos para facilitar as relações)
DO $$
DECLARE
    v_client_id UUID := '11111111-1111-1111-1111-111111111111';
    v_school_id UUID := '22222222-2222-2222-2222-222222222222';
    
    v_grade_1_id UUID := '33333333-3333-3333-3333-333333333333';
    v_grade_2_id UUID := '44444444-4444-4444-4444-444444444444';
    
    v_class_1_id UUID := '55555555-5555-5555-5555-555555555555';
    
    v_client_user_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    v_teacher_user_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    v_student_user_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    
    v_book_1_id UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    v_book_2_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
BEGIN

    -- 2. Limpar dados anteriores (opcional, para evitar duplicação se rodar 2 vezes)
    DELETE FROM auth.users WHERE email IN ('cliente@escola.com', 'prof1@biblioteca.professor', 'aluno1@biblioteca.escolar');
    DELETE FROM public.clients WHERE id = v_client_id;
    
    -- 3. Criar Cliente (SaaS)
    INSERT INTO public.clients (id, name, contact_name, contact_email, status)
    VALUES (v_client_id, 'Prefeitura de Teste', 'João Prefeito', 'cliente@escola.com', 'active');
    
    -- Criar Usuário Auth para o Cliente
    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
        v_client_user_id, 'authenticated', 'authenticated', 'cliente@escola.com',
        extensions.crypt('senha123', extensions.gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}', '{"role":"client","display_name":"Cliente Teste"}', now(), now()
    );
    -- Atualizar Profile do Cliente
    INSERT INTO public.profiles (id, role, display_name, client_id)
    VALUES (v_client_user_id, 'client', 'Cliente Teste', v_client_id)
    ON CONFLICT (id) DO UPDATE SET role = 'client', client_id = v_client_id;

    -- 4. Criar Escola
    INSERT INTO public.schools (id, name, address, contact_name, contact_email, client_id)
    VALUES (v_school_id, 'Escola Municipal de Teste', 'Rua das Flores, 123', 'Diretora Maria', 'escola@teste.com', v_client_id);
    
    -- 5. Criar Níveis (Séries)
    INSERT INTO public.grade_levels (id, name, order_index, default_age_min, default_age_max)
    VALUES 
        (v_grade_1_id, '1º Ano do Ensino Fundamental', 1, 6, 7),
        (v_grade_2_id, '2º Ano do Ensino Fundamental', 2, 7, 8)
    ON CONFLICT DO NOTHING;
    
    -- 6. Criar Turma
    INSERT INTO public.classes (id, school_id, grade_level_id, name, year)
    VALUES (v_class_1_id, v_school_id, v_grade_1_id, 'Turma A', 2024);
    
    -- 7. Criar Professor
    -- Usuário Auth Professor
    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
        v_teacher_user_id, 'authenticated', 'authenticated', 'prof1@biblioteca.professor',
        extensions.crypt('senha123', extensions.gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}', '{"role":"teacher","display_name":"Professor Carlos"}', now(), now()
    );
    -- Profile Professor
    INSERT INTO public.profiles (id, role, display_name, client_id)
    VALUES (v_teacher_user_id, 'teacher', 'Professor Carlos', v_client_id)
    ON CONFLICT (id) DO UPDATE SET role = 'teacher', client_id = v_client_id;
    -- Tabela Teachers
    INSERT INTO public.teachers (auth_user_id, school_id, grade_level_id, class_id, full_name, email)
    VALUES (v_teacher_user_id, v_school_id, v_grade_1_id, v_class_1_id, 'Professor Carlos', 'prof1@biblioteca.professor');
    
    -- 8. Criar Aluno
    -- Usuário Auth Aluno
    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
        v_student_user_id, 'authenticated', 'authenticated', 'aluno1@biblioteca.escolar',
        extensions.crypt('senha123', extensions.gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}', '{"role":"student","display_name":"Pedrinho"}', now(), now()
    );
    -- Profile Aluno
    INSERT INTO public.profiles (id, role, display_name, client_id)
    VALUES (v_student_user_id, 'student', 'Pedrinho', v_client_id)
    ON CONFLICT (id) DO UPDATE SET role = 'student', client_id = v_client_id;
    -- Tabela Students
    INSERT INTO public.students (auth_user_id, class_id, full_name, birth_date, enrollment_code)
    VALUES (v_student_user_id, v_class_1_id, 'Pedro Henrique', '2016-05-10', '1001');
    -- Gamificação do Aluno
    INSERT INTO public.student_gamification (student_id, total_xp, level)
    VALUES ((SELECT id FROM public.students WHERE auth_user_id = v_student_user_id LIMIT 1), 0, 1);
    
    -- 9. Criar Livros de Teste
    INSERT INTO public.books (id, title, author, synopsis, genre, age_min, age_max, client_id, school_id)
    VALUES 
        (v_book_1_id, 'O Pequeno Príncipe Mágico', 'Autor Fictício', 'Uma linda história para testes.', 'Aventura', 6, 8, v_client_id, v_school_id),
        (v_book_2_id, 'Aventuras Espaciais', 'Maria Estrela', 'Eles viajaram pelo espaço!', 'Ficção', 7, 10, v_client_id, v_school_id);
        
    -- Vincular livros às séries
    INSERT INTO public.book_grade_levels (book_id, grade_level_id)
    VALUES 
        (v_book_1_id, v_grade_1_id),
        (v_book_2_id, v_grade_2_id);

END $$;
