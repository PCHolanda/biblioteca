import RelatoriosView from '@/app/components/RelatoriosView'

export const metadata = {
  title: 'Relatórios de Alunos e Leituras | Painel Administrativo',
  description: 'Relatórios de alunos por livro, notas de quiz, número de livros lidos e médias de aproveitamento.',
}

export default function AdminRelatoriosPage() {
  return <RelatoriosView isTeacher={false} />
}
