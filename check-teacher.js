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

async function check() {
  console.log('=== CONTA DE PROFESSOR E PROFILES ===');
  
  // 1. Listar professores
  const { data: teachers, error: tErr } = await supabase.from('teachers').select('*');
  if (tErr) {
    console.error('Erro ao ler tabela teachers:', tErr.message);
    return;
  }
  console.log('Professores cadastrados:', teachers);

  // 2. Listar profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  if (pErr) {
    console.error('Erro ao ler tabela profiles:', pErr.message);
    return;
  }
  console.log('Perfis no banco:', profiles);
}

check();
