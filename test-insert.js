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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  console.log('=== TESTE DE INSERÇÃO DE LIVRO ===');
  
  const teacherId = '0c27707a-9afc-4aa1-9663-1f12238fd65b'; // ID do professor Paulo
  
  const bookPayload = {
    title: 'Livro Teste Diagnóstico',
    author: 'Autor Teste',
    synopsis: 'Sinopse teste',
    genre: 'Gênero teste',
    tags: ['teste'],
    age_min: 6,
    age_max: 10,
    cover_url: 'https://example.com/cover.jpg',
    pdf_url: 'https://example.com/book.pdf',
    created_by: teacherId
  };

  // Tentar inserir usando o Service Role (que ignora RLS) para validar integridade
  console.log('Inserindo como Service Role (Ignora RLS)...');
  const { data: svcData, error: svcErr } = await supabase
    .from('books')
    .insert([bookPayload])
    .select('id')
    .single();

  if (svcErr) {
    console.error('❌ Erro na integridade física (Service Role):', svcErr.message);
  } else {
    console.log('✅ Sucesso na integridade física! ID do livro:', svcData.id);
    
    // Remover o livro de teste para não poluir
    await supabase.from('books').delete().eq('id', svcData.id);
    console.log('Livro de teste removido.');
  }
}

test();
