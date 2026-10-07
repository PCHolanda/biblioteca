import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Biblioteca Digital',
    short_name: 'Biblioteca',
    description: 'Plataforma de Leitura e Gamificação Escolar',
    start_url: '/aluno',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
