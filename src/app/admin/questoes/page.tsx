'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  HelpCircle, BookOpen, Search, Plus, Edit2, Trash2, 
  Copy, CheckCircle2, Circle, Sparkles, Loader2, ArrowLeft, 
  AlertCircle, Check, X, AlertTriangle, Layers
} from 'lucide-react'
import Image from 'next/image'
import QuestionManagerModal from '@/app/components/QuestionManagerModal'

export default function AdminQuestoesPage() {
  const searchParams = useSearchParams()
  const initialBookId = searchParams.get('bookId')

  const supabase = createClient()
  const [loadingBooks, setLoadingBooks] = useState(true)
  const [books, setBooks] = useState<any[]>([])
  const [selectedBookId, setSelectedBookId] = useState<string>(initialBookId || '')
  const [bookSearch, setBookSearch] = useState('')
  const [questionCounts, setQuestionCounts] = useState<{ [bookId: string]: number }>({})

  // Modal de Questões
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalBook, setModalBook] = useState<any | null>(null)

  useEffect(() => {
    fetchBooksAndCounts()
  }, [])

  useEffect(() => {
    if (initialBookId && books.length > 0) {
      const found = books.find((b) => b.id === initialBookId)
      if (found) {
        setSelectedBookId(found.id)
        setModalBook(found)
        setIsModalOpen(true)
      }
    }
  }, [initialBookId, books])

  const fetchBooksAndCounts = async () => {
    setLoadingBooks(true)
    try {
      // 1. Buscar livros
      const { data: booksData } = await supabase
        .from('books')
        .select('id, title, author, cover_url, genre, synopsis')
        .order('title')

      if (booksData) {
        setBooks(booksData)
        if (!selectedBookId && booksData.length > 0) {
          setSelectedBookId(booksData[0].id)
        }
      }

      // 2. Buscar contagem de questões de cada livro
      const { data: qData } = await supabase
        .from('book_quiz_questions')
        .select('book_id')

      if (qData) {
        const counts: { [bookId: string]: number } = {}
        qData.forEach((item: any) => {
          counts[item.book_id] = (counts[item.book_id] || 0) + 1
        })
        setQuestionCounts(counts)
      }
    } catch (err) {
      console.error('Erro ao buscar livros e questões:', err)
    } finally {
      setLoadingBooks(false)
    }
  }

  const handleOpenManager = (book: any) => {
    setModalBook(book)
    setIsModalOpen(true)
  }

  const handleCountChange = (bookId: string, newCount: number) => {
    setQuestionCounts((prev) => ({
      ...prev,
      [bookId]: newCount
    }))
  }

  const filteredBooks = books.filter((b) => {
    if (!bookSearch) return true
    const q = bookSearch.toLowerCase()
    return b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q))
  })

  // Estatísticas Globais
  const totalBooks = books.length
  const totalQuestionsAll = Object.values(questionCounts).reduce((acc, curr) => acc + curr, 0)
  const booksWithQuestions = Object.values(questionCounts).filter((c) => c > 0).length

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center space-x-3">
          <HelpCircle className="text-indigo-400" size={32} />
          <span>Gerenciador do Banco de Questões</span>
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Gerencie, corrija, elimine e crie novas perguntas avaliativas para cada livro da biblioteca.
        </p>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl">
            <HelpCircle size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{totalQuestionsAll}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total de Questões no Sistema</div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{booksWithQuestions} de {totalBooks}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Livros com Banco Criado</div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-amber-600/20 text-amber-400 rounded-xl">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {totalBooks > 0 ? `${Math.round((booksWithQuestions / totalBooks) * 100)}%` : '0%'}
            </div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Cobertura de Avaliação</div>
          </div>
        </div>
      </div>

      {/* Busca e Lista de Livros para Gerenciamento */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar livro para gerenciar questões..."
              value={bookSearch}
              onChange={(e) => setBookSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <span className="text-xs text-slate-400 font-medium">
            Mostrando {filteredBooks.length} de {books.length} livros
          </span>
        </div>

        {loadingBooks ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
            <Loader2 className="animate-spin text-indigo-500" size={36} />
            <p className="text-sm">Carregando catálogo de livros e contagem de questões...</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <BookOpen size={32} className="mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">Nenhum livro encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredBooks.map((book) => {
              const count = questionCounts[book.id] || 0
              return (
                <div
                  key={book.id}
                  className="bg-slate-850 border border-slate-750 hover:border-indigo-500/60 rounded-2xl p-4 shadow-sm transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-slate-750 shrink-0 border border-slate-700 shadow-sm">
                      {book.cover_url ? (
                        <Image src={book.cover_url} alt={book.title} fill className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-slate-500">
                          <BookOpen size={18} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-indigo-400">
                        {book.genre || 'Literatura'}
                      </span>
                      <h3 className="font-bold text-sm text-white truncate mt-1 group-hover:text-indigo-300 transition-colors">
                        {book.title}
                      </h3>
                      <p className="text-xs text-slate-400 truncate">
                        {book.author || 'Autor desconhecido'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-750 text-xs">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full font-bold text-xs ${
                      count >= 20
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                        : count > 0
                        ? 'bg-blue-950/60 text-blue-400 border border-blue-800'
                        : 'bg-amber-950/60 text-amber-400 border border-amber-800'
                    }`}>
                      <HelpCircle size={12} />
                      <span>{count} {count === 1 ? 'questão' : 'questões'}</span>
                    </span>

                    <button
                      onClick={() => handleOpenManager(book)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95 flex items-center space-x-1"
                    >
                      <Edit2 size={12} />
                      <span>Gerenciar</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Reutilizável de Gerenciamento de Questões */}
      <QuestionManagerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setModalBook(null)
        }}
        book={modalBook}
        onQuestionCountChange={handleCountChange}
      />
    </div>
  )
}
