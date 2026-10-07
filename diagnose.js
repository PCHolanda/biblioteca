const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Ler .env.local manualmente
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('ERRO: Arquivo .env.local não encontrado na raiz!');
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
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n=== DIAGNÓSTICO DE CONEXÃO SUPABASE ===');
console.log('URL:', supabaseUrl);
console.log('Anon Key configurada:', supabaseAnonKey ? 'SIM (tamanho ' + supabaseAnonKey.length + ')' : 'NÃO');
console.log('Service Key configurada:', supabaseServiceKey ? 'SIM (tamanho ' + supabaseServiceKey.length + ')' : 'NÃO');

if (!supabaseUrl || supabaseUrl.includes('seu-projeto-supabase')) {
  console.error('\n❌ ERRO: Você ainda está usando a URL de placeholder "seu-projeto-supabase.supabase.co".\n👉 Substitua com suas chaves reais no arquivo .env.local!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    // 1. Testar ler tabelas públicas
    console.log('\n[1/2] Testando conexão com o banco de dados (leitura)...');
    const { data, error } = await supabase.from('grade_levels').select('name').limit(3);
    if (error) {
      console.error('❌ Falha ao ler tabelas públicas:', error.message);
      console.log('Dica: Verifique se você executou o script "supabase_schema.sql" no editor SQL do seu Supabase.');
    } else {
      console.log('✅ Conexão bem-sucedida! Séries encontradas no banco:', data.map(d => d.name));
    }

    // 2. Testar autenticação
    console.log('\n[2/2] Testando login para admin@escola.com com a senha "admin"...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@escola.com',
      password: 'admin'
    });

    if (authError) {
      console.error('❌ Erro de login:', authError.message);
      console.log('\nDica: Se a leitura do banco funcionou mas o login falhou, significa que a tabela "auth.users" do seu Supabase ainda não contém o usuário admin.');
      console.log('Certifique-se de que a parte de "SEED DA CONTA ADMINISTRATIVA" ao final do script "supabase_schema.sql" rodou com sucesso.');
    } else {
      console.log('✅ Login bem-sucedido! Usuário autenticado:', authData.user.email);
    }
  } catch (err) {
    console.error('❌ Erro inesperado durante o diagnóstico:', err.message);
  }
}

run();
