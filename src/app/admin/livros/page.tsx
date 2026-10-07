'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { BookOpen, Plus, Edit2, Trash2, X, Upload, Loader2, Sparkles, FileQuestion, Users, HelpCircle, ListChecks } from 'lucide-react'
import Image from 'next/image'
import BookReadersModal from '@/app/components/BookReadersModal'
import QuestionManagerModal from '@/app/components/QuestionManagerModal'

export default function LivrosPage() {
  const [livros, setLivros] = useState<any[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [quizCounts, setQuizCounts] = useState<{ [bookId: string]: number }>({})
  const [generatingQuizId, setGeneratingQuizId] = useState<string | null>(null)
  const [series, setSeries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLivro, setEditingLivro] = useState<any>(null)
  const [selectedBookForReaders, setSelectedBookForReaders] = useState<any | null>(null)
  const [isBookReadersModalOpen, setIsBookReadersModalOpen] = useState(false)
  const [selectedBookForQuestions, setSelectedBookForQuestions] = useState<any | null>(null)
  const [isQuestionManagerOpen, setIsQuestionManagerOpen] = useState(false)

  // Campos do formulário
  const [schoolId, setSchoolId] = useState('')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [genre, setGenre] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [selectedSeries, setSelectedSeries] = useState<string[]>([])
  
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverUrl, setCoverUrl] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfUrl, setPdfUrl] = useState('')

  const [formLoading, setFormLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    // Buscar escolas
    const { data: schoolsData } = await supabase
      .from('schools')
      .select('id, name')
      .order('name')
    if (schoolsData) setSchools(schoolsData)

    // Buscar séries para exibir como checkbox recomendável
    const { data: gradeData } = await supabase
      .from('grade_levels')
      .select('id, name')
      .order('order_index')
    if (gradeData) setSeries(gradeData)

    await fetchLivros()
    setLoading(false)
  }

  const fetchLivros = async () => {
    const { data } = await supabase
      .from('books')
      .select(`
        *,
        schools (id, name),
        book_grade_levels (grade_level_id)
      `)
      .order('title')
    
    if (data) setLivros(data)

    // Buscar quantidade de questões cadastradas por livro
    // Buscar quantidade de questões cadastradas por livro
    const { data: qData, error: qErr } = await supabase
      .from('book_quiz_questions')
      .select('book_id', { count: 'exact' })

    if (qErr) {
      console.error("Erro ao buscar contagem de questões:", qErr)
    }

    if (qData) {
      const counts: { [bookId: string]: number } = {}
      qData.forEach((q: any) => {
        counts[q.book_id] = (counts[q.book_id] || 0) + 1
      })
      console.log("Quiz counts carregados:", counts)
      setQuizCounts(counts)
    }
  }

  const handleQuestionCountChange = (bookId: string, newCount: number) => {
    setQuizCounts((prev) => ({
      ...prev,
      [bookId]: newCount
    }))
  }

  const handleGenerateQuizBank = async (bookId: string, bookTitle: string) => {
    setGeneratingQuizId(bookId)
    try {
      const res = await fetch('/api/quiz/generate-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gerar banco de questões')
      }

      alert(`✅ Banco de ${data.totalQuestions || 50} questões gerado com sucesso para "${bookTitle}"!`)
      
      // Atualizar o estado visual imediatamente para evitar delay de cache do navegador
      setQuizCounts(prev => ({
        ...prev,
        [bookId]: data.totalQuestions || 50
      }))

      fetchLivros()
    } catch (err: any) {
      alert('Erro ao gerar banco de questões: ' + err.message)
    } finally {
      setGeneratingQuizId(null)
    }
  }

  const openNewModal = () => {
    setEditingLivro(null)
    setSchoolId('')
    setTitle('')
    setAuthor('')
    setSynopsis('')
    setGenre('')
    setTagsInput('')
    setAgeMin('')
    setAgeMax('')
    setSelectedSeries([])
    setCoverFile(null)
    setCoverUrl('')
    setPdfFile(null)
    setPdfUrl('')
    setUploadProgress('')
    setIsModalOpen(true)
  }

  const openEditModal = (livro: any) => {
    setEditingLivro(livro)
    setSchoolId(livro.school_id || '')
    setTitle(livro.title)
    setAuthor(livro.author)
    setSynopsis(livro.synopsis || '')
    setGenre(livro.genre || '')
    setTagsInput(livro.tags ? livro.tags.join(', ') : '')
    setAgeMin(livro.age_min ? String(livro.age_min) : '')
    setAgeMax(livro.age_max ? String(livro.age_max) : '')
    setSelectedSeries(livro.book_grade_levels ? livro.book_grade_levels.map((gl: any) => gl.grade_level_id) : [])
    setCoverFile(null)
    setCoverUrl(livro.cover_url || '')
    setPdfFile(null)
    setPdfUrl(livro.pdf_url || '')
    setUploadProgress('')
    setIsModalOpen(true)
  }

  const handleUploadCover = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/admin/upload-cover', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao enviar capa')
    }

    return data.publicUrl
  }

  // Upload direto do Cliente usando URL assinada (Signed Upload URL) para evitar limites da Vercel
  const handleUploadPdfDirectly = async (file: File): Promise<string> => {
    setUploadProgress('Solicitando permissão de upload...')
    
    const res = await fetch('/api/admin/get-upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename: file.name }),
    })

    const responseData = await res.json()

    if (!res.ok) {
      throw new Error(responseData.error || 'Erro ao gerar URL assinada de upload')
    }

    const { signedUrl, path } = responseData
    
    setUploadProgress('Enviando PDF diretamente para o Storage...')

    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': 'application/pdf',
      },
    })

    if (!uploadRes.ok) {
      throw new Error('Falha no upload direto do arquivo PDF para o Storage.')
    }

    setUploadProgress('PDF enviado!')
    return `book-pdfs/${path}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      let finalCoverUrl = coverUrl
      let finalPdfUrl = pdfUrl

      if (coverFile) {
        setUploadProgress('Enviando capa...')
        finalCoverUrl = await handleUploadCover(coverFile)
      }

      if (pdfFile) {
        finalPdfUrl = await handleUploadPdfDirectly(pdfFile)
      }

      const tags = tagsInput
        ? tagsInput.split(',').map((t) => t.trim()).filter((t) => t !== '')
        : []

      const { data: { user } } = await supabase.auth.getUser()

      // Obter o client_id do usuário logado se houver (perfil de cliente)
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user?.id)
        .maybeSingle()

      const livroPayload: any = {
        school_id: schoolId || null,
        client_id: userProfile?.client_id || null,
        title,
        author,
        synopsis,
        genre,
        tags,
        age_min: ageMin ? parseInt(ageMin, 10) : null,
        age_max: ageMax ? parseInt(ageMax, 10) : null,
        cover_url: finalCoverUrl,
        pdf_url: finalPdfUrl,
        created_by: user?.id,
      }

      let bookId = editingLivro?.id

      if (editingLivro) {
        const { error } = await supabase
          .from('books')
          .update(livroPayload)
          .eq('id', bookId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('books')
          .insert([livroPayload])
          .select('id')
          .single()
        if (error) throw error
        bookId = data.id
      }

      // Sincronizar recomendações de séries (book_grade_levels N:N)
      // 1. Remover vínculos anteriores
      await supabase
        .from('book_grade_levels')
        .delete()
        .eq('book_id', bookId)

      // 2. Inserir novos vínculos selecionados
      if (selectedSeries.length > 0) {
        const relationPayload = selectedSeries.map((gradeId) => ({
          book_id: bookId,
          grade_level_id: gradeId,
        }))
        const { error: relError } = await supabase
          .from('book_grade_levels')
          .insert(relationPayload)
        if (relError) throw relError
      }

      // 3. Disparar geração automática do banco de 50 questões do Quiz
      setUploadProgress('Gerando banco de 50 questões com IA...')
      try {
        await fetch('/api/quiz/generate-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId })
        })
      } catch (quizErr) {
        console.warn('Geração do quiz em segundo plano:', quizErr)
      }

      setIsModalOpen(false)
      fetchLivros()
    } catch (error: any) {
      alert('Erro ao salvar livro: ' + error.message)
    } finally {
      setFormLoading(false)
      setUploadProgress('')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este livro? Todos os históricos de leitura e favoritos vinculados serão removidos.')) return

    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao deletar livro: ' + error.message)
    } else {
      fetchLivros()
    }
  }

  const toggleSerieSelection = (serieId: string) => {
    if (selectedSeries.includes(serieId)) {
      setSelectedSeries(selectedSeries.filter((id) => id !== serieId))
    } else {
      setSelectedSeries([...selectedSeries, serieId])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Livros</h1>
          <p className="text-slate-400 mt-1">Gerencie o acervo digital e as faixas recomendadas.</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Cadastrar Livro</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : livros.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-slate-400">Nenhum livro cadastrado no acervo.</p>
        </div>
      ) : (
        <>
          {/* Tabela para Desktop */}
          <div className="hidden md:block overflow-x-auto bg-slate-800 border border-slate-700 rounded-xl shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Capa</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Título / Autor</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Escola</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Gênero</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Banco de Quiz</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Classificação</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {livros.map((livro) => {
                  const count = quizCounts[livro.id] || 0
                  const isGenerating = generatingQuizId === livro.id
                  return (
                    <tr key={livro.id} className="hover:bg-slate-750/30 transition-colors">
                      <td className="p-4">
                        {livro.cover_url ? (
                          <div className="relative w-10 h-14 rounded overflow-hidden border border-slate-650">
                            <Image src={livro.cover_url} alt={livro.title} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-14 rounded bg-slate-700 flex items-center justify-center text-slate-400">
                            <BookOpen size={16} />
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-white">{livro.title}</div>
                        <div className="text-xs text-slate-450">{livro.author}</div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900 border border-slate-700 text-indigo-300">
                          {livro.schools?.name || 'Todas as Escolas'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-305">{livro.genre || '-'}</td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedBookForQuestions(livro)
                              setIsQuestionManagerOpen(true)
                            }}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold hover:scale-105 transition-all cursor-pointer ${
                              count >= 20 
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800' 
                                : count > 0
                                ? 'bg-blue-950/60 text-blue-400 border border-blue-800'
                                : 'bg-amber-950/60 text-amber-400 border border-amber-800'
                            }`}
                            title="Gerenciar e Corrigir Questões"
                          >
                            <ListChecks size={12} />
                            <span>{count > 0 ? `${count} Questões` : 'Sem Questões'}</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedBookForQuestions(livro)
                              setIsQuestionManagerOpen(true)
                            }}
                            className="p-1.5 bg-slate-700 hover:bg-slate-650 text-indigo-400 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
                            title="Gerenciar e Corrigir Questões"
                          >
                            <Edit2 size={12} />
                            <span className="text-[11px]">Questões</span>
                          </button>

                          <button
                            onClick={() => handleGenerateQuizBank(livro.id, livro.title)}
                            disabled={isGenerating}
                            className="p-1.5 bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center space-x-1"
                            title="Gerar / Regerar Banco de 50 Questões com IA"
                          >
                            {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            <span className="text-[11px]">{isGenerating ? 'Gerando...' : 'IA'}</span>
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-slate-350 text-xs">
                        {livro.age_min || livro.age_max ? (
                          <span className="inline-flex px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900">
                            Manual: {livro.age_min || 0} - {livro.age_max || '99'} anos
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-750">
                            Pelos Anos Escolares
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedBookForReaders(livro)
                            setIsBookReadersModalOpen(true)
                          }}
                          className="inline-flex p-2 text-amber-400 hover:text-white hover:bg-amber-950/40 rounded-lg transition-colors"
                          title="Ver alunos e páginas deste livro"
                        >
                          <Users size={16} />
                        </button>
                        <button
                          onClick={() => openEditModal(livro)}
                          className="inline-flex p-2 text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Editar livro"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(livro.id)}
                          className="inline-flex p-2 text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
                          title="Excluir livro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards para Mobile */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {livros.map((livro) => {
              const count = quizCounts[livro.id] || 0
              const isGenerating = generatingQuizId === livro.id
              return (
                <div key={livro.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4 shadow-md flex space-x-4">
                  {livro.cover_url ? (
                    <div className="relative w-16 h-24 rounded overflow-hidden border border-slate-650 flex-shrink-0">
                      <Image src={livro.cover_url} alt={livro.title} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-24 rounded bg-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
                      <BookOpen size={24} />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <h3 className="font-bold text-white leading-tight">{livro.title}</h3>
                      <p className="text-xs text-slate-400">{livro.author}</p>
                      <p className="text-[11px] font-semibold text-indigo-400 mt-0.5">
                        🏫 {livro.schools?.name || 'Todas as Escolas'}
                      </p>
                      <div className="mt-2 flex items-center space-x-2 flex-wrap gap-y-1">
                        <button
                          onClick={() => {
                            setSelectedBookForQuestions(livro)
                            setIsQuestionManagerOpen(true)
                          }}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            count >= 20 
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800' 
                              : count > 0
                              ? 'bg-blue-950/60 text-blue-400 border border-blue-800'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-800'
                          }`}
                        >
                          <ListChecks size={10} />
                          <span>{count > 0 ? `${count} Q` : 'Sem Quiz'}</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedBookForQuestions(livro)
                            setIsQuestionManagerOpen(true)
                          }}
                          className="px-2 py-0.5 bg-slate-700 hover:bg-slate-650 text-indigo-300 rounded text-[10px] font-bold flex items-center space-x-1"
                          title="Gerenciar Questões"
                        >
                          <Edit2 size={10} />
                          <span>Questões</span>
                        </button>

                        <button
                          onClick={() => handleGenerateQuizBank(livro.id, livro.title)}
                          disabled={isGenerating}
                          className="px-2 py-0.5 bg-indigo-600/40 text-indigo-300 rounded text-[10px] font-bold flex items-center space-x-1"
                        >
                          {isGenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                          <span>{isGenerating ? '...' : 'IA'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-750/30">
                      <button
                        onClick={() => {
                          setSelectedBookForReaders(livro)
                          setIsBookReadersModalOpen(true)
                        }}
                        className="px-2.5 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800 rounded-lg text-amber-400 transition-colors flex items-center space-x-1 text-xs font-semibold"
                        title="Ver leitores e páginas"
                      >
                        <Users size={12} />
                        <span>Leitores</span>
                      </button>
                      <button
                        onClick={() => openEditModal(livro)}
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-indigo-400 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(livro.id)}
                        className="p-1.5 bg-red-950/20 hover:bg-red-950/40 rounded text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal de Cadastro / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative my-8 transition-colors duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-450 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingLivro ? 'Editar Livro' : 'Novo Livro'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-455 mt-1">Carregue o arquivo PDF e configure a recomendação.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Escola do Livro
                </label>
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                >
                  <option value="">Todas as Escolas (Global / Padrão)</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Selecione a escola à qual este livro pertence. Apenas alunos desta escola verão este livro na estante.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Título do Livro</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                    placeholder="Título"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Autor</label>
                  <input
                    type="text"
                    required
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                    placeholder="Autor"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Sinopse</label>
                <textarea
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  rows={3}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm resize-none transition-colors"
                  placeholder="Resumo do livro..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Gênero</label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                    placeholder="Ex: Contos, Aventura"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Tags (Separadas por vírgula)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                    placeholder="Ex: animais, fantasia, natureza"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Classificação de Idade (Manual / Override)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Deixe em branco para usar as faixas de idade das séries selecionadas.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Idade Mínima</label>
                    <input
                      type="number"
                      value={ageMin}
                      onChange={(e) => setAgeMin(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                      placeholder="Ex: 8"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Idade Máxima</label>
                    <input
                      type="number"
                      value={ageMax}
                      onChange={(e) => setAgeMax(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors"
                      placeholder="Ex: 12"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Recomendação por Série (Grade Levels)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {series.map((grade) => {
                    const isChecked = selectedSeries.includes(grade.id)
                    return (
                      <label
                        key={grade.id}
                        className={`flex items-center space-x-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 dark:border-indigo-650 text-indigo-750 dark:text-indigo-400 font-semibold shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750/30 bg-white dark:bg-slate-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSerieSelection(grade.id)}
                          className="hidden"
                        />
                        <span className="text-xs">{grade.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Capa do Livro (Imagem)</label>
                  <div className="mt-1 flex items-center space-x-3">
                    {coverUrl && !coverFile && (
                      <div className="relative w-10 h-14 rounded overflow-hidden border border-slate-300 dark:border-slate-650 bg-slate-100 dark:bg-slate-700 flex-shrink-0">
                        <Image src={coverUrl} alt="Capa preview" fill className="object-cover" />
                      </div>
                    )}
                    <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg p-3.5 cursor-pointer bg-slate-50 dark:bg-slate-750/30 hover:bg-slate-100 dark:hover:bg-slate-750/40 transition-colors">
                      <Upload size={18} className="text-slate-550 dark:text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-450 mt-1">Carregar Imagem</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) setCoverFile(e.target.files[0])
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Arquivo PDF</label>
                  <div className="mt-1 flex items-center space-x-3">
                    {pdfUrl && (
                      <div className="text-xs text-indigo-650 dark:text-indigo-405 truncate max-w-[120px] font-medium">
                        {pdfUrl.split('/').pop()}
                      </div>
                    )}
                    <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg p-3.5 cursor-pointer bg-slate-50 dark:bg-slate-750/30 hover:bg-slate-100 dark:hover:bg-slate-750/40 transition-colors">
                      <Upload size={18} className="text-slate-550 dark:text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-450 mt-1">Carregar PDF</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) setPdfFile(e.target.files[0])
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {uploadProgress && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-lg text-xs text-indigo-700 dark:text-indigo-400 flex items-center space-x-2">
                  <Loader2 className="animate-spin" size={14} />
                  <span>{uploadProgress}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {formLoading && <Loader2 className="animate-spin" size={14} />}
                  <span>{editingLivro ? 'Atualizar' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Acompanhamento de Leitores do Livro */}
      <BookReadersModal
        isOpen={isBookReadersModalOpen}
        onClose={() => {
          setIsBookReadersModalOpen(false)
          setSelectedBookForReaders(null)
        }}
        book={selectedBookForReaders}
      />

      {/* Modal de Gerenciamento de Questões do Livro */}
      <QuestionManagerModal
        isOpen={isQuestionManagerOpen}
        onClose={() => {
          setIsQuestionManagerOpen(false)
          setSelectedBookForQuestions(null)
        }}
        book={selectedBookForQuestions}
        onQuestionCountChange={handleQuestionCountChange}
      />
    </div>
  )
}
