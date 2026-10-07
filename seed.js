const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Ler .env.local
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('ERRO: Arquivo .env.local não encontrado!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seed() {
  console.log('\n=== INICIANDO SEED AUTOMÁTICO VIA API ===');
  
  try {
    // 1. Criar Usuário Admin no Auth
    console.log('[1/7] Criando usuário Admin (admin@escola.com / admin)...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@escola.com',
      password: 'admin',
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        display_name: 'Diretor Admin'
      }
    });

    let adminId = '';

    if (authError) {
      if (authError.message.includes('already exists') || authError.message.includes('already registered')) {
        console.log('-> Admin já cadastrado no Auth. Buscando ID existente...');
        
        // Buscar o ID dele
        const { data: usersList } = await supabase.auth.admin.listUsers();
        const existingAdmin = usersList?.users?.find(u => u.email === 'admin@escola.com');
        if (existingAdmin) {
          adminId = existingAdmin.id;
          console.log('-> ID do Admin encontrado:', adminId);
        }
      } else {
        console.error('❌ Erro ao criar admin auth:', authError.message);
      }
    } else if (authUser?.user) {
      adminId = authUser.user.id;
      console.log('✅ Admin criado com sucesso no Auth! ID:', adminId);
    }

    if (adminId) {
      // Garantir a role 'admin' e display_name na tabela profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: adminId, role: 'admin', display_name: 'Diretor Admin' });
      if (profileError) {
        console.error('❌ Erro ao atualizar profile do admin:', profileError.message);
      } else {
        console.log('✅ Perfil de Admin atualizado na tabela profiles!');
      }
    }

    // 2. Inserir Escola de Exemplo
    console.log('[2/7] Inserindo Escola de Exemplo...');
    const school = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Escola Mundial',
      address: 'Rua das Flores, 123 - Centro',
      contact_name: 'Diretora Helena',
      contact_email: 'contato@escolamundial.edu.br'
    };
    const { error: schoolErr } = await supabase.from('schools').upsert([school]);
    if (schoolErr) console.error('Erro na escola:', schoolErr.message);

    // 3. Inserir Séries
    console.log('[3/7] Inserindo Séries (Grade Levels)...');
    const grades = [
      { id: '11111111-1111-1111-1111-111111111111', name: '1º ano', order_index: 1, default_age_min: 6, default_age_max: 7 },
      { id: '22222222-2222-2222-2222-222222222222', name: '2º ano', order_index: 2, default_age_min: 7, default_age_max: 8 },
      { id: '33333333-3333-3333-3333-333333333333', name: '3º ano', order_index: 3, default_age_min: 8, default_age_max: 9 }
    ];
    const { error: gradesErr } = await supabase.from('grade_levels').upsert(grades);
    if (gradesErr) console.error('Erro nas séries:', gradesErr.message);

    // 4. Inserir Turmas
    console.log('[4/7] Inserindo Turmas (Classes)...');
    const classes = [
      {
        id: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
        school_id: '550e8400-e29b-41d4-a716-446655440000',
        grade_level_id: '11111111-1111-1111-1111-111111111111',
        name: '1º ano A',
        year: 2026
      },
      {
        id: 'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        school_id: '550e8400-e29b-41d4-a716-446655440000',
        grade_level_id: '33333333-3333-3333-3333-333333333333',
        name: '3º ano B',
        year: 2026
      }
    ];
    const { error: classErr } = await supabase.from('classes').upsert(classes);
    if (classErr) console.error('Erro nas turmas:', classErr.message);

    // 5. Inserir Alunos
    console.log('[5/7] Inserindo Alunos (Students)...');
    const students = [
      {
        id: 'aa11aa11-11aa-11aa-11aa-11aa11aa11aa',
        class_id: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
        full_name: 'Gabriel Souza',
        birth_date: '2019-10-15',
        enrollment_code: 'MAT001'
      },
      {
        id: 'bb22bb22-22bb-22bb-22bb-22bb22bb22bb',
        class_id: 'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        full_name: 'Mariana Lima',
        birth_date: '2017-05-20',
        enrollment_code: 'MAT002'
      }
    ];
    const { error: studErr } = await supabase.from('students').upsert(students);
    if (studErr) console.error('Erro nos alunos:', studErr.message);

    // 6. Inserir Livros
    console.log('[6/7] Inserindo Livros (Books)...');
    const books = [
      {
        id: 'b001b001-b001-b001-b001-b001b001b001',
        title: 'O Pequeno Urso',
        author: 'Ana Maria',
        synopsis: 'As aventuras de um urso brincalhão na floresta selvagem.',
        genre: 'Fantasia Infantil',
        tags: ['urso', 'floresta', 'natureza']
      },
      {
        id: 'b002b002-b002-b002-b002-b002b002b002',
        title: 'Mistérios Matemáticos',
        author: 'Professor Júlio',
        synopsis: 'Desvende enigmas e treine seu raciocínio com problemas curiosos.',
        genre: 'Didático',
        tags: ['matematica', 'raciocinio', 'enigmas']
      },
      {
        id: 'b003b003-b003-b003-b003-b003b003b003',
        title: 'Enciclopédia dos Animais',
        author: 'Marta Rocha',
        synopsis: 'Tudo sobre mamíferos, aves, répteis e anfíbios de todo o mundo.',
        genre: 'Ciências',
        tags: ['animais', 'natureza', 'ciencia'],
        age_min: 6,
        age_max: 12
      },
      {
        id: 'b004b004-b004-b004-b004-b004b004b004',
        title: 'Aventuras no Espaço',
        author: 'Carlos Sagan',
        synopsis: 'Uma viagem fantástica pelo sistema solar e além.',
        genre: 'Ficção Científica',
        tags: ['espaco', 'planetas', 'viagem'],
        age_min: 9,
        age_max: 14
      }
    ];
    const { error: bookErr } = await supabase.from('books').upsert(books);
    if (bookErr) console.error('Erro nos livros:', bookErr.message);

    // 7. Relacionamento Livros / Séries
    console.log('[7/7] Inserindo recomendações de livros/séries...');
    const bookGrades = [
      { book_id: 'b001b001-b001-b001-b001-b001b001b001', grade_level_id: '11111111-1111-1111-1111-111111111111' },
      { book_id: 'b002b002-b002-b002-b002-b002b002b002', grade_level_id: '33333333-3333-3333-3333-333333333333' },
      { book_id: 'b004b004-b004-b004-b004-b004b004b004', grade_level_id: '33333333-3333-3333-3333-333333333333' }
    ];
    const { error: relErr } = await supabase.from('book_grade_levels').upsert(bookGrades);
    if (relErr) console.error('Erro nas relações de livros/séries:', relErr.message);

    console.log('\n✅ SEED EXECUTADO COM SUCESSO!');
  } catch (err) {
    console.error('❌ Erro inesperado durante o seed:', err.message);
  }
}

seed();
