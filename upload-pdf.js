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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Caminhos dos arquivos enviados
const pdfSource = 'C:\\Users\\silvapa\\.gemini\\antigravity\\brain\\c6e1af99-3830-4f22-b10b-9b6659c499b4\\.user_uploaded\\media_1787253170642.pdf';
const coverSource = 'C:\\Users\\silvapa\\.gemini\\antigravity\\brain\\c6e1af99-3830-4f22-b10b-9b6659c499b4\\.user_uploaded\\media_1787026339139.png';

async function upload() {
  console.log('\n=== INTEGRANDO LIVRO: O MENINO MALUQUINHO ===');
  
  try {
    // 1. Upload do PDF (Privado)
    console.log('[1/4] Carregando arquivo PDF para o Storage privado (book-pdfs)...');
    if (!fs.existsSync(pdfSource)) {
      throw new Error('Arquivo PDF de origem não encontrado.');
    }
    const pdfBuffer = fs.readFileSync(pdfSource);
    const pdfName = 'books/menino-maluquinho.pdf';

    const { error: pdfUploadErr } = await supabase.storage
      .from('book-pdfs')
      .upload(pdfName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (pdfUploadErr) throw pdfUploadErr;
    console.log('✅ PDF carregado com sucesso!');

    // 2. Upload da Capa (Pública)
    console.log('[2/4] Carregando imagem de capa para o Storage público (covers)...');
    let publicCoverUrl = '';
    if (fs.existsSync(coverSource)) {
      const coverBuffer = fs.readFileSync(coverSource);
      const coverName = 'covers/menino-maluquinho.png';

      const { error: coverUploadErr } = await supabase.storage
        .from('covers')
        .upload(coverName, coverBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (coverUploadErr) throw coverUploadErr;

      const { data } = supabase.storage.from('covers').getPublicUrl(coverName);
      publicCoverUrl = data.publicUrl;
      console.log('✅ Capa carregada! URL pública:', publicCoverUrl);
    } else {
      console.log('⚠️ Aviso: Imagem de capa não encontrada, prosseguindo sem capa.');
    }

    // 3. Atualizar/Inserir metadados do livro no Postgres
    console.log('[3/4] Gravando metadados do livro no banco de dados...');
    const bookId = 'b001b001-b001-b001-b001-b001b001b001'; // ID do "O Pequeno Urso"
    
    const bookPayload = {
      id: bookId,
      title: 'O Menino Maluquinho',
      author: 'Ziraldo',
      synopsis: 'As aventuras de um menino muito alegre e com ideias mirabolantes que vive aventuras incríveis e usa uma panela na cabeça.',
      genre: 'Literatura Infantil',
      tags: ['clássico', 'diversão', 'infância'],
      cover_url: publicCoverUrl || null,
      pdf_url: `book-pdfs/${pdfName}`
    };

    const { error: dbErr } = await supabase
      .from('books')
      .upsert([bookPayload]);

    if (dbErr) throw dbErr;
    console.log('✅ Metadados do livro atualizados!');

    // 4. Vincular recomendação a múltiplas séries (1º ano e 3º ano)
    console.log('[4/4] Vinculando recomendações de série para Mariana Lima e Gabriel Souza...');
    const relations = [
      { book_id: bookId, grade_level_id: '11111111-1111-1111-1111-111111111111' }, // 1º ano (Gabriel)
      { book_id: bookId, grade_level_id: '33333333-3333-3333-3333-333333333333' }  // 3º ano (Mariana)
    ];

    // Deletar relações anteriores deste livro
    await supabase.from('book_grade_levels').delete().eq('book_id', bookId);
    
    // Inserir novas relações
    const { error: relErr } = await supabase.from('book_grade_levels').insert(relations);
    if (relErr) throw relErr;
    
    console.log('✅ Recomendações vinculadas com sucesso!');
    console.log('\n🎉 O LIVRO "O MENINO MALUQUINHO" ESTÁ PRONTO PARA LEITURA!');

  } catch (err) {
    console.error('\n❌ Erro na integração do livro:', err.message);
  }
}

upload();
