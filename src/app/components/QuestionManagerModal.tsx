'use client'

import React, { useState, useEffect } from 'react'
import { 
  X, Plus, Edit2, Trash2, Copy, CheckCircle2, Circle, 
  HelpCircle, Search, Loader2, Sparkles, AlertCircle, 
  Check, BookOpen, ArrowLeft, RefreshCw, AlertTriangle
} from 'lucide-react'
import Image from 'next/image'

interface QuestionManagerModalProps {
  isOpen: boolean
  onClose: () => void
  book: {
    id: string
    title: string
    author?: string
    cover_url?: string
    genre?: string
  } | null
  onQuestionCountChange?: (bookId: string, newCount: number) => void
}

export default function QuestionManagerModal({
  isOpen,
  onClose,
  book,
  onQuestionCountChange
}: QuestionManagerModalProps) {
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Estados do Formulário (Criar / Editar)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null)
  const [formQuestion, setFormQuestion] = useState('')
  const [formChoices, setFormChoices] = useState<string[]>(['', '', '', ''])
  const [formCorrectIndex, setFormCorrectIndex] = useState<number>(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Estados de Operação
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (isOpen && book?.id) {
      fetchQuestions(book.id)
      setIsFormOpen(false)
      setEditingQuestion(null)
      setSearchTerm('')
    } else {
      setQuestions([])
      setIsFormOpen(false)
    }
  }, [isOpen, book?.id])

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  const fetchQuestions = async (bookId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/quiz/questions?bookId=${bookId}`)
      const data = await res.json()
      if (res.ok && data.questions) {
        setQuestions(data.questions)
        if (onQuestionCountChange) {
          onQuestionCountChange(bookId, data.questions.length)
        }
      } else {
        console.error('Erro ao carregar questões:', data.error)
        showToast(data.error || 'Erro ao carregar questões', 'error')
      }
    } catch (err: any) {
      console.error('Falha de rede ao buscar questões:', err)
      showToast('Falha ao conectar com o servidor', 'error')
    } finally {
      setLoading(false)
    }
  }

  const openNewQuestionForm = () => {
    setEditingQuestion(null)
    setFormQuestion('')
    setFormChoices(['', '', '', ''])
    setFormCorrectIndex(0)
    setFormError(null)
    setIsFormOpen(true)
  }

  const openEditQuestionForm = (q: any) => {
    setEditingQuestion(q)
    setFormQuestion(q.question)
    const choices = Array.isArray(q.choices) && q.choices.length >= 2 
      ? [...q.choices] 
      : ['', '', '', '']
    setFormChoices(choices)
    setFormCorrectIndex(typeof q.correct_index === 'number' ? q.correct_index : 0)
    setFormError(null)
    setIsFormOpen(true)
  }

  const handleDuplicateQuestion = (q: any) => {
    setEditingQuestion(null) // Modo criação
    setFormQuestion(`${q.question} (Cópia)`)
    setFormChoices([...q.choices])
    setFormCorrectIndex(q.correct_index)
    setFormError(null)
    setIsFormOpen(true)
    showToast('Questão duplicada no formulário. Faça os ajustes e salve.')
  }

  const handleAddChoice = () => {
    if (formChoices.length < 5) {
      setFormChoices([...formChoices, ''])
    }
  }

  const handleRemoveChoice = (indexToRemove: number) => {
    if (formChoices.length <= 2) {
      setFormError('A questão precisa ter no mínimo 2 alternativas.')
      return
    }

    const updated = formChoices.filter((_, idx) => idx !== indexToRemove)
    setFormChoices(updated)

    // Ajustar o índice da resposta correta se necessário
    if (formCorrectIndex === indexToRemove) {
      setFormCorrectIndex(0)
    } else if (formCorrectIndex > indexToRemove) {
      setFormCorrectIndex(formCorrectIndex - 1)
    }
  }

  const handleChoiceTextChange = (index: number, text: string) => {
    const updated = [...formChoices]
    updated[index] = text
    setFormChoices(updated)
  }

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Validações
    if (!formQuestion.trim()) {
      setFormError('Por favor, informe o enunciado da pergunta.')
      return
    }

    const trimmedChoices = formChoices.map((c) => c.trim())
    if (trimmedChoices.some((c) => !c)) {
      setFormError('Todas as alternativas devem ter um texto preenchido.')
      return
    }

    if (formCorrectIndex < 0 || formCorrectIndex >= trimmedChoices.length) {
      setFormError('Por favor, selecione qual alternativa é a correta.')
      return
    }

    if (!book?.id) return

    setSaving(true)
    try {
      if (editingQuestion) {
        // Atualizar / Corrigir questão
        const res = await fetch('/api/quiz/questions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingQuestion.id,
            question: formQuestion.trim(),
            choices: trimmedChoices,
            correctIndex: formCorrectIndex
          })
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar questão')

        setQuestions(questions.map((q) => q.id === editingQuestion.id ? data.question : q))
        showToast('Questão corrigida com sucesso!')
      } else {
        // Criar nova questão
        const res = await fetch('/api/quiz/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: book.id,
            question: formQuestion.trim(),
            choices: trimmedChoices,
            correctIndex: formCorrectIndex
          })
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao criar questão')

        const updatedList = [...questions, data.question]
        setQuestions(updatedList)
        if (onQuestionCountChange) {
          onQuestionCountChange(book.id, updatedList.length)
        }
        showToast('Nova questão adicionada com sucesso!')
      }

      setIsFormOpen(false)
      setEditingQuestion(null)
    } catch (err: any) {
      setFormError(err.message || 'Erro ao processar questão.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente esta questão do quiz?')) {
      return
    }

    setDeletingId(questionId)
    try {
      const res = await fetch(`/api/quiz/questions?id=${questionId}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir questão')

      const updatedList = questions.filter((q) => q.id !== questionId)
      setQuestions(updatedList)
      if (onQuestionCountChange && book?.id) {
        onQuestionCountChange(book.id, updatedList.length)
      }
      showToast('Questão excluída com sucesso!')
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir questão', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleGenerateAiBank = async () => {
    if (!book) return

    if (questions.length > 0) {
      const confirmRegenerate = confirm(
        `Este livro já possui ${questions.length} questões cadastradas.\n\nDeseja regerar um novo banco de 50 questões com Inteligência Artificial? As questões atuais serão substituídas.`
      )
      if (!confirmRegenerate) return
    }

    setGeneratingAi(true)
    try {
      const res = await fetch('/api/quiz/generate-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar questões com IA')

      showToast(`🎉 ${data.totalQuestions || 50} questões geradas com sucesso pela IA!`)
      await fetchQuestions(book.id)
    } catch (err: any) {
      showToast(err.message || 'Erro ao gerar questões com IA', 'error')
    } finally {
      setGeneratingAi(false)
    }
  }

  if (!isOpen || !book) return null

  // Filtragem local
  const filteredQuestions = questions.filter((q) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const inQuestion = q.question?.toLowerCase().includes(term)
    const inChoices = Array.isArray(q.choices) && q.choices.some((c: string) => c.toLowerCase().includes(term))
    return inQuestion || inChoices
  })

  const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Notificação */}
        {toastMessage && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 text-xs font-bold transition-all animate-in slide-in-from-top-4 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-red-600 text-white shadow-red-600/30'
          }`}>
            {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Cabeçalho do Gerenciador de Questões */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900/10 via-indigo-600/5 to-transparent dark:from-indigo-950/40 dark:via-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3.5 min-w-0 flex-1 mr-4">
            <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 shadow border border-slate-200 dark:border-slate-700">
              {book.cover_url ? (
                <Image src={book.cover_url} alt={book.title} fill className="object-cover" />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-slate-400">
                  <BookOpen size={20} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                  Gerenciador de Questões
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  questions.length >= 20
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                    : questions.length > 0
                    ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                    : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                }`}>
                  {questions.length} {questions.length === 1 ? 'questão cadastrada' : 'questões cadastradas'}
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate mt-1">
                {book.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {book.author ? `Por ${book.author}` : 'Autor desconhecido'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Fechar gerenciador"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra de Ações: Nova Questão, Busca e Gerador IA */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar em enunciados ou alternativas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleGenerateAiBank}
              disabled={generatingAi}
              className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 disabled:opacity-50"
              title="Gerar banco de 50 questões automaticamente usando IA"
            >
              {generatingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{generatingAi ? 'Gerando com IA...' : 'Gerar 50Q com IA'}</span>
            </button>

            {!isFormOpen && (
              <button
                onClick={openNewQuestionForm}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center space-x-1.5 active:scale-95"
              >
                <Plus size={15} />
                <span>Nova Questão</span>
              </button>
            )}
          </div>
        </div>

        {/* Corpo: Formulário (se aberto) ou Lista de Questões */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* FORMULÁRIO DE CRIAÇÃO / EDIÇÃO */}
          {isFormOpen && (
            <div className="bg-slate-50 dark:bg-slate-800/80 border-2 border-indigo-500/40 rounded-2xl p-5 shadow-lg space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {editingQuestion ? <Edit2 size={13} /> : <Plus size={15} />}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {editingQuestion ? 'Corrigir / Editar Questão' : 'Criar Nova Questão para o Quiz'}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white font-medium"
                >
                  Cancelar
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveQuestion} className="space-y-4">
                {/* Enunciado */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Enunciado da Pergunta:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formQuestion}
                    onChange={(e) => setFormQuestion(e.target.value)}
                    placeholder="Ex: De acordo com o livro, qual foi a atitude do personagem principal ao encontrar a chave mágica?"
                    className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 placeholder-slate-400 transition-all shadow-inner"
                  />
                </div>

                {/* Alternativas de Resposta */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Alternativas de Resposta:
                    </label>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Clique no botão redondo ao lado da alternativa para marcá-la como a <strong className="text-emerald-500">CORRETA</strong>
                    </span>
                  </div>

                  {formChoices.map((choice, idx) => {
                    const isCorrect = formCorrectIndex === idx
                    return (
                      <div 
                        key={idx}
                        className={`flex items-center space-x-2 p-2.5 rounded-xl border transition-all ${
                          isCorrect
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600/80 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {/* Seletor de Correta */}
                        <button
                          type="button"
                          onClick={() => setFormCorrectIndex(idx)}
                          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white'
                          }`}
                          title="Clique para definir esta alternativa como a resposta correta"
                        >
                          {isCorrect ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                          <span>Opção {CHOICE_LETTERS[idx]}</span>
                          {isCorrect && <span className="ml-1 text-[10px] uppercase font-extrabold">(Correta)</span>}
                        </button>

                        {/* Input do texto da alternativa */}
                        <input
                          type="text"
                          required
                          value={choice}
                          onChange={(e) => handleChoiceTextChange(idx, e.target.value)}
                          placeholder={`Texto da alternativa ${CHOICE_LETTERS[idx]}...`}
                          className={`flex-1 px-3 py-1.5 bg-transparent border-0 text-xs sm:text-sm text-slate-900 dark:text-white outline-none placeholder-slate-400 ${
                            isCorrect ? 'font-semibold' : ''
                          }`}
                        />

                        {/* Botão de remover alternativa (se mais de 2) */}
                        {formChoices.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveChoice(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                            title="Remover alternativa"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })}

                  {/* Adicionar 5ª Alternativa */}
                  {formChoices.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddChoice}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center space-x-1 pt-1"
                    >
                      <Plus size={13} />
                      <span>Adicionar mais uma alternativa (Opção {CHOICE_LETTERS[formChoices.length]})</span>
                    </button>
                  )}
                </div>

                {/* Botões do Formulário */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false)
                      setEditingQuestion(null)
                    }}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-650 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center space-x-1.5"
                  >
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    <span>{editingQuestion ? 'Salvar Correção' : 'Criar Questão'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LISTA DE QUESTÕES */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <Loader2 className="animate-spin text-indigo-500" size={36} />
              <p className="text-sm font-semibold">Carregando banco de questões do livro...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3 bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <HelpCircle size={32} />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-white">
                {searchTerm ? 'Nenhuma questão corresponde à busca.' : 'Nenhuma questão cadastrada para este livro.'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchTerm
                  ? 'Tente buscar por outras palavras ou limpe o campo de busca.'
                  : 'Crie questões manualmente clicando no botão "Nova Questão" ou gere um banco completo de 50 questões com IA.'}
              </p>
              {!searchTerm && (
                <div className="flex items-center justify-center space-x-3 pt-2">
                  <button
                    onClick={openNewQuestionForm}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition-all"
                  >
                    + Criar Primeira Questão
                  </button>
                  <button
                    onClick={handleGenerateAiBank}
                    disabled={generatingAi}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
                  >
                    <Sparkles size={14} />
                    <span>Gerar com IA</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map((q, qIndex) => {
                const choices = Array.isArray(q.choices) ? q.choices : []
                const correctIdx = typeof q.correct_index === 'number' ? q.correct_index : 0
                const isDeleting = deletingId === q.id

                return (
                  <div
                    key={q.id}
                    className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-xs transition-all space-y-3"
                  >
                    {/* Linha do Enunciado e Ações */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                          #{qIndex + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                            {q.question}
                          </h4>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            ID: {q.id}
                          </span>
                        </div>
                      </div>

                      {/* Botões de Ação na Questão */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => openEditQuestionForm(q)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-750 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors flex items-center space-x-1 text-xs font-semibold"
                          title="Corrigir / Editar Questão"
                        >
                          <Edit2 size={14} />
                          <span className="hidden sm:inline">Corrigir</span>
                        </button>

                        <button
                          onClick={() => handleDuplicateQuestion(q)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl transition-colors"
                          title="Duplicar como modelo para nova questão"
                        >
                          <Copy size={14} />
                        </button>

                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          disabled={isDeleting}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 hover:text-red-700 rounded-xl transition-colors disabled:opacity-50"
                          title="Eliminar questão"
                        >
                          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Alternativas de Resposta */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {choices.map((choiceText: string, cIdx: number) => {
                        const isCorrect = cIdx === correctIdx
                        return (
                          <div
                            key={cIdx}
                            className={`flex items-start space-x-2.5 p-3 rounded-xl border text-xs sm:text-sm transition-all ${
                              isCorrect
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-slate-900 dark:text-white font-semibold shadow-xs'
                                : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {CHOICE_LETTERS[cIdx]}
                            </span>

                            <div className="flex-1 min-w-0">
                              <p className="leading-snug">{choiceText}</p>
                              {isCorrect && (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                                  <Check size={11} />
                                  <span>Alternativa Correta</span>
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrando {filteredQuestions.length} de {questions.length} questões
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
