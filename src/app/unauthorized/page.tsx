import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <h1 className="text-4xl font-bold text-red-600">Acesso Negado</h1>
      <p className="mt-4 text-lg text-gray-600">Você não tem permissão para acessar esta área.</p>
      <Link href="/login" className="mt-6 rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition">
        Voltar para o Login
      </Link>
    </div>
  )
}
