# Biblioteca Digital Escolar - Next.js + Supabase

Plataforma de biblioteca digital para escolas com leitor de PDF animado (page-flip), classificação automática de livros por idade/série e controle de segurança ponta a ponta (RLS + Buckets).

---

## 🚀 Tecnologias Utilizadas

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend / DB**: Supabase (Postgres, Auth, Storage, Row Level Security)
- **PDF**: `react-pdf` para renderização + `react-pageflip` para paginação animada.
- **Parser**: `papaparse` para importação de CSV em lote no cliente.

---

## 🛠️ Configuração do Supabase (Banco de Dados e Storage)

### 1. Migração de Banco de Dados
Abra o **SQL Editor** no painel do Supabase e execute todo o conteúdo do arquivo [`supabase_schema.sql`](file:///c:/BIBLIOTECA/supabase_schema.sql). Ele criará:
- **Tabelas**: `schools`, `grade_levels`, `classes`, `students`, `profiles`, `books`, `book_grade_levels`, `reading_progress` e `favorites`.
- **Triggers**: Sincronização automática entre o Auth do Supabase e a tabela pública `profiles`, além do atualizador de `updated_at`.
- **Funções**:
  - `get_eligible_books(student_id)`: Calcula a idade do aluno a partir da data de nascimento e compara com a faixa efetiva do livro (classificação manual override ou faixas padrões das séries recomendadas).
  - `get_eligible_books_for_user(user_id)`: Resolve a elegibilidade baseada no ID do usuário autenticado.
- **Seed de Dados**: Insere automaticamente 1 escola, 3 séries, 2 turmas (1º ano A e 3º ano B), 2 alunos modelo e 4 livros configurados com regras de idade distintas.

### 2. Buckets do Storage e Políticas
O script SQL já cria os seguintes buckets automaticamente:
1. `school-logos` (Público) - Logotipos das escolas.
2. `covers` (Público) - Capas de livros.
3. `book-pdfs` (Privado) - Arquivos PDF de leitura dos livros.

As políticas configuradas no RLS de Storage garantem que:
- **Admin**: Acesso total de leitura e escrita a todos os buckets.
- **Público/Alunos**: Acesso de leitura direta apenas a `school-logos` e `covers`.
- **Arquivos PDF**: O bucket `book-pdfs` é privado. Os alunos não podem baixá-los diretamente. Em vez disso, o leitor solicita uma **Signed URL** gerada pelo servidor por meio de uma rota protegida de API que valida se o aluno é elegível para ler aquele livro.

---

## 🔑 Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes credenciais do Supabase (ou configure na Vercel):

```env
# Configurações Públicas (Client-side)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto-supabase.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_public_key_aqui

# Configurações Privadas (Server-side)
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
```

> [!WARNING]
> Nunca prefixe a chave `SUPABASE_SERVICE_ROLE_KEY` com `NEXT_PUBLIC_`. Ela ignora completamente o RLS e é usada no servidor para criar usuários estudantis e assinar URLs de upload.

---

## 🏃 Execução Local

Instale as dependências e inicie o servidor de desenvolvimento:

```bash
npm install
npm run dev
```

Abra o endereço [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 📊 Fluxos da Aplicação

### Painel do Administrador (`/admin`)
1. **CRUD Escolas, Séries e Turmas**: Cadastro em cascata para organizar a estrutura escolar.
2. **Cadastro de Alunos**: Cadastro individual ou importação em lote via arquivo CSV.
3. **Gerador de Login**: Cria as credenciais e e-mail fictício do aluno (ex: `mat001@biblioteca.escolar`), gerando uma senha provisória.
4. **Cadastro de Livros**: O admin preenche os metadados, seleciona as séries recomendadas, adiciona a imagem de capa e carrega o PDF. O arquivo PDF é enviado diretamente do navegador do administrador para o Supabase Storage via signed upload URL, permitindo uploads de qualquer tamanho sem sofrer o limite de payload de 4.5 MB da Vercel Serverless.

### Área do Aluno (`/aluno`)
1. **Login de Matrícula**: O aluno digita apenas o código de matrícula (ex: `MAT001`) e a senha provisória. O sistema resolve internamente o login correspondente.
2. **Estante Elegível**: O aluno vê apenas livros recomendados para a sua idade ou série vinculada.
3. **Leitor de PDF Animado**:
   - **Desktop**: Modo de spread (duas páginas lado a lado), com botões e cliques nas laterais para paginação animada (efeito page-flip).
   - **Mobile**: Modo de página única vertical com gestos de deslizar (swipe) / toque nas bordas.
   - **Controles**: Barra na parte inferior acessível pelo polegar com ajuste de zoom, brilho (filtro overlay escuro) e botão de favoritos.
   - **Progresso de Leitura**: Salva de forma automática e silenciosa a última página lida, permitindo continuar a leitura exatamente de onde parou.

---

## ☁️ Deploy na Vercel

O projeto foi otimizado para deploy imediato na Vercel.
1. Crie um novo projeto no Dashboard da Vercel apontando para este repositório.
2. Adicione as variáveis de ambiente descritas acima.
3. Execute o Deploy. O Next.js construirá a aplicação de produção.
