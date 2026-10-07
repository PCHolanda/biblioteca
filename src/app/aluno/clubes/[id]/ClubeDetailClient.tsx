'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

export default function ClubeDetailClient({ clubId, studentId, initialDiscussions }: { clubId: string, studentId: string, initialDiscussions: any[] }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setSending(true)
    try {
      const res = await fetch('/api/clubs/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, studentId, message })
      })

      if (res.ok) {
        setMessage('')
        alert('Mensagem enviada para aprovação do professor')
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao enviar mensagem')
      }
    } catch (err) {
      alert('Erro de rede')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Discussão</h3>
      
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6 mb-6">
        <div className="space-y-4 max-h-[400px] overflow-y-auto mb-6 pr-2 custom-scrollbar">
          {initialDiscussions.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Nenhuma mensagem aprovada ainda. Seja o primeiro a participar!</p>
          ) : (
            initialDiscussions.map((disc) => (
              <div key={disc.id} className="bg-slate-50 dark:bg-slate-750 p-3 rounded-xl">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{disc.student?.full_name || 'Colega'}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(disc.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-sm">{disc.message}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSend} className="flex flex-col gap-2">
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
            Sua mensagem será revisada pelo professor antes de aparecer aqui.
          </p>
          <div className="flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva sua mensagem..."
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              rows={2}
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white p-3 rounded-xl flex items-center justify-center transition-colors shrink-0"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
