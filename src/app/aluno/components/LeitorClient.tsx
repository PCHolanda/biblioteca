'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Importa dinamicamente o componente do leitor desativando SSR (Server-Side Rendering)
const PdfReader = dynamic(() => import('./PdfReader'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-slate-400 space-y-4">
      <Loader2 className="animate-spin text-indigo-500" size={48} />
      <p className="text-sm font-semibold">Carregando leitor de PDF...</p>
    </div>
  ),
})

interface LeitorClientProps {
  book: any
  pdfUrl: string
  startPage: number
  isFavorite: boolean
  studentId: string
}

export default function LeitorClient(props: LeitorClientProps) {
  return <PdfReader {...props} />
}
