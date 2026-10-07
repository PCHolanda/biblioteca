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

async function listPolicies() {
  console.log('=== RLS POLICIES ===');
  
  // Como o Supabase JS Client não acessa pg_catalog diretamente pela API padrão,
  // podemos rodar uma query usando a API REST ou um RPC.
  // Mas peraí! Nós não temos o RPC.
  // Podemos tentar fazer uma requisição HTTP ou se houver outra forma.
  // Espera! Tem o PostgREST?
  // O PostgREST não deixa ler as tabelas do sistema pg_catalog por padrão a menos que esteja exposto.
  // Vamos ver se conseguimos fazer um select de pg_policies usando o supabase client:
  const { data, error } = await supabase.from('pg_policies').select('*').eq('tablename', 'books');
  if (error) {
    console.log('Não foi possível ler pg_policies através do PostgREST (esperado por questões de segurança):', error.message);
  } else {
    console.log('Políticas de RLS na tabela books:', data);
  }
}

listPolicies();
