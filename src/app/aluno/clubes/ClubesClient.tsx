'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Users, ArrowRight } from 'lucide-react'

export default function ClubesClient({ initialClubs, studentId }: { initialClubs: any[], studentId: string }) {
  const [clubs, setClubs] = useState(initialClubs)
  const [joining, setJoining] = useState<string | null>(null)
  const router = useRouter()

  const meusClubes = clubs.filter(c => c.is_member)
  const clubesDisponiveis = clubs.filter(c => !c.is_member)

  const handleJoin = async (clubId: string) => {
    setJoining(clubId)
    try {
      const res = await fetch('/api/clubs/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, studentId })
      })

      if (res.ok) {
        setClubs(prev => prev.map(c => 
          c.id === clubId 
            ? { ...c, is_member: true, member_count: c.member_count + 1 } 
            : c
        ))
        router.refresh()
      } else {
        const errorData = await res.json()
        alert(errorData.error || 'Erro ao entrar no clube')
      }
    } catch (err) {
      alert('Erro de rede')
    } finally {
      setJoining(null)
    }
  }

  const renderClubCard = (club: any, isMember: boolean) => {
    const bookData = Array.isArray(club.book) ? club.book[0] : club.book

    return (
      <div key={club.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-24 h-32 relative rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700">
          {bookData?.cover_url ? (
            <Image src={bookData.cover_url} alt={bookData.title || 'Capa'} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">Sem Capa</div>
          )}
        </div>
        
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{club.name}</h3>
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium line-clamp-1">{bookData?.title}</p>
            {club.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{club.description}</p>
            )}
            
            <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Users size={14} className="text-indigo-500" />
              <span>{club.member_count || 0}/{club.max_members} membros</span>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            {isMember ? (
              <Link 
                href={`/aluno/clubes/${club.id}`}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow active:scale-95"
              >
                <span>Ver Clube</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <button 
                onClick={() => handleJoin(club.id)}
                disabled={joining === club.id || club.member_count >= club.max_members}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow active:scale-95"
              >
                <span>{joining === club.id ? 'Entrando...' : club.member_count >= club.max_members ? 'Lotado' : 'Entrar no Clube (+20 XP)'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
          Meus Clubes
        </h2>
        {meusClubes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meusClubes.map(c => renderClubCard(c, true))}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-sm">Você ainda não participa de nenhum clube.</p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
          Clubes Disponíveis
        </h2>
        {clubesDisponiveis.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubesDisponiveis.map(c => renderClubCard(c, false))}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-sm">Não há clubes disponíveis no momento.</p>
        )}
      </section>
    </div>
  )
}
