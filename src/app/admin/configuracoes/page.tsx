'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Settings, Save, Loader2, Trophy, HelpCircle, Sparkles, BookOpen, Flame, Award, Users } from 'lucide-react'

interface LevelConfig {
  level: number
  min_xp: number
  name: string
  icon: string
}

const DEFAULT_LEVELS: LevelConfig[] = [
  { level: 1, min_xp: 0, name: 'Iniciante', icon: '📖' },
  { level: 2, min_xp: 200, name: 'Explorador', icon: '🔍' },
  { level: 3, min_xp: 500, name: 'Aventureiro', icon: '⚔️' },
  { level: 4, min_xp: 1000, name: 'Sábio', icon: '🧠' },
  { level: 5, min_xp: 2000, name: 'Mestre', icon: '🎓' },
  { level: 6, min_xp: 5000, name: 'Lenda da Leitura', icon: '👑' }
]

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'gamificacao' | 'quiz'>('gamificacao')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Estado do Quiz
  const [quizConfig, setQuizConfig] = useState<{
    id?: string
    num_questions: number
    num_choices: number
    passing_score: number
    max_attempts: number
  }>({
    num_questions: 5,
    num_choices: 4,
    passing_score: 70,
    max_attempts: 0
  })

  // Estado da Gamificação
  const [gamifConfig, setGamifConfig] = useState<{
    id?: string
    levels: LevelConfig[]
    xp_per_page: number
    xp_book_complete: number
    xp_quiz_pass: number
    xp_quiz_perfect: number
    xp_streak_7: number
    xp_streak_30: number
    xp_club_join: number
  }>({
    levels: DEFAULT_LEVELS,
    xp_per_page: 1,
    xp_book_complete: 50,
    xp_quiz_pass: 100,
    xp_quiz_perfect: 150,
    xp_streak_7: 30,
    xp_streak_30: 100,
    xp_club_join: 20
  })

  useEffect(() => {
    async function loadAllConfigs() {
      try {
        setIsLoading(true)

        // 1. Carregar Quiz Config
        const { data: qData } = await supabase
          .from('quiz_config')
          .select('*')
          .limit(1)
          .maybeSingle()

        if (qData) {
          setQuizConfig(qData)
        }

        // 2. Carregar Gamification Config
        const { data: gData } = await supabase
          .from('gamification_config')
          .select('*')
          .limit(1)
          .maybeSingle()

        if (gData) {
          setGamifConfig({
            id: gData.id,
            levels: Array.isArray(gData.levels) ? gData.levels : DEFAULT_LEVELS,
            xp_per_page: gData.xp_per_page ?? 1,
            xp_book_complete: gData.xp_book_complete ?? 50,
            xp_quiz_pass: gData.xp_quiz_pass ?? 100,
            xp_quiz_perfect: gData.xp_quiz_perfect ?? 150,
            xp_streak_7: gData.xp_streak_7 ?? 30,
            xp_streak_30: gData.xp_streak_30 ?? 100,
            xp_club_join: gData.xp_club_join ?? 20
          })
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadAllConfigs()
  }, [supabase])

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      const payload: any = {
        num_questions: quizConfig.num_questions,
        num_choices: quizConfig.num_choices,
        passing_score: quizConfig.passing_score,
        max_attempts: quizConfig.max_attempts,
        updated_at: new Date().toISOString()
      }

      if (quizConfig.id) {
        payload.id = quizConfig.id
      }

      const { data, error } = await supabase
        .from('quiz_config')
        .upsert(payload)
        .select()
        .single()

      if (error) throw error
      if (data) setQuizConfig(data)

      setMessage({ type: 'success', text: 'Configurações de Quiz salvas com sucesso!' })
    } catch (err: any) {
      console.error('Erro ao salvar quiz:', err)
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar quiz.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveGamification = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      const payload: any = {
        levels: gamifConfig.levels,
        xp_per_page: gamifConfig.xp_per_page,
        xp_book_complete: gamifConfig.xp_book_complete,
        xp_quiz_pass: gamifConfig.xp_quiz_pass,
        xp_quiz_perfect: gamifConfig.xp_quiz_perfect,
        xp_streak_7: gamifConfig.xp_streak_7,
        xp_streak_30: gamifConfig.xp_streak_30,
        xp_club_join: gamifConfig.xp_club_join,
        updated_at: new Date().toISOString()
      }

      if (gamifConfig.id) {
        payload.id = gamifConfig.id
      }

      const { data, error } = await supabase
        .from('gamification_config')
        .upsert(payload)
        .select()
        .single()

      if (error) throw error
      if (data) setGamifConfig(prev => ({ ...prev, id: data.id }))

      setMessage({ type: 'success', text: 'Parâmetros de Gamificação e Níveis salvos com sucesso!' })
    } catch (err: any) {
      console.error('Erro ao salvar gamificação:', err)
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar gamificação.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleLevelChange = (index: number, field: keyof LevelConfig, value: any) => {
    setGamifConfig(prev => {
      const newLevels = [...prev.levels]
      newLevels[index] = {
        ...newLevels[index],
        [field]: field === 'min_xp' ? (parseInt(value, 10) || 0) : value
      }
      return { ...prev, levels: newLevels }
    })
  }

  const handleXpChange = (field: keyof typeof gamifConfig, value: string) => {
    setGamifConfig(prev => ({
      ...prev,
      [field]: parseInt(value, 10) || 0
    }))
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Settings className="text-indigo-600" size={24} />
          <span>Configurações & Parametrização</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Defina as regras de pontuação de XP, os 6 Níveis de Leitor e a validação de leitura.
        </p>
      </div>

      {/* Feedback Alert */}
      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
            : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Abas */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          onClick={() => { setActiveTab('gamificacao'); setMessage(null); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'gamificacao'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Trophy size={16} />
          <span>🎮 6 Níveis de Leitor & Ganho de XP</span>
        </button>

        <button
          onClick={() => { setActiveTab('quiz'); setMessage(null); }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'quiz'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <HelpCircle size={16} />
          <span>📝 Questionário de Validação</span>
        </button>
      </div>

      {/* ABA 1: GAMIFICAÇÃO & NÍVEIS */}
      {activeTab === 'gamificacao' && (
        <form onSubmit={handleSaveGamification} className="space-y-6">
          {/* Card: 6 Níveis de Leitor */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <Award className="text-amber-500" size={20} />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Os 6 Níveis de Leitor</h2>
              </div>
              <span className="text-xs text-slate-400">Progressão de 1 a 6</span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Defina o nome, ícone (emoji) e o total de XP necessário para o aluno alcançar cada nível.
            </p>

            <div className="space-y-3">
              {gamifConfig.levels.map((lvl, index) => (
                <div 
                  key={lvl.level}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 bg-slate-50 dark:bg-slate-750/50 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  {/* Badge de Nível */}
                  <div className="sm:col-span-2 flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                      #{lvl.level}
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Nível {lvl.level}</span>
                  </div>

                  {/* Emoji/Ícone */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Ícone</label>
                    <input 
                      type="text" 
                      value={lvl.icon}
                      onChange={(e) => handleLevelChange(index, 'icon', e.target.value)}
                      className="w-full text-center text-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg py-1 px-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      maxLength={4}
                    />
                  </div>

                  {/* Nome do Nível */}
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Título do Nível</label>
                    <input 
                      type="text" 
                      value={lvl.name}
                      onChange={(e) => handleLevelChange(index, 'name', e.target.value)}
                      required
                      placeholder="Nome do Nível"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* XP Mínimo */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">XP Mínimo</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={lvl.min_xp}
                        onChange={(e) => handleLevelChange(index, 'min_xp', e.target.value)}
                        min={0}
                        required
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 px-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">XP</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Regras de Ganho de XP */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-700">
              <Sparkles className="text-indigo-600" size={20} />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Regras de Ganho de XP</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* XP por Página */}
              <div className="p-4 bg-slate-50 dark:bg-slate-750/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center space-x-2">
                  <BookOpen size={16} className="text-indigo-500" />
                  <label className="text-xs font-bold text-slate-800 dark:text-white">XP por Página Lida</label>
                </div>
                <input 
                  type="number" 
                  value={gamifConfig.xp_per_page}
                  onChange={(e) => handleXpChange('xp_per_page', e.target.value)}
                  min={1}
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400">Pontuação concedida a cada nova página lida no PDF.</p>
              </div>

              {/* XP por Livro Concluído */}
              <div className="p-4 bg-slate-50 dark:bg-slate-750/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center space-x-2">
                  <Trophy size={16} className="text-amber-500" />
                  <label className="text-xs font-bold text-slate-800 dark:text-white">XP por Livro Concluído</label>
                </div>
                <input 
                  type="number" 
                  value={gamifConfig.xp_book_complete}
                  onChange={(e) => handleXpChange('xp_book_complete', e.target.value)}
                  min={1}
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400">Bônus ao alcançar a última página do livro.</p>
              </div>

              {/* XP por Quiz Aprovado */}
              <div className="p-4 bg-slate-50 dark:bg-slate-750/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center space-x-2">
                  <Award size={16} className="text-emerald-500" />
                  <label className="text-xs font-bold text-slate-800 dark:text-white">XP por Quiz Aprovado</label>
                </div>
                <input 
                  type="number" 
                  value={gamifConfig.xp_quiz_pass}
                  onChange={(e) => handleXpChange('xp_quiz_pass', e.target.value)}
                  min={1}
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400">Pontos concedidos ao atingir a nota de aprovação no quiz.</p>
              </div>

              {/* XP por Quiz Perfeito (100%) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-750/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center space-x-2">
                  <Sparkles size={16} className="text-purple-500" />
                  <label className="text-xs font-bold text-slate-800 dark:text-white">XP por Quiz Gabaritado (100%)</label>
                </div>
                <input 
                  type="number" 
                  value={gamifConfig.xp_quiz_perfect}
                  onChange={(e) => handleXpChange('xp_quiz_perfect', e.target.value)}
                  min={1}
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400">Pontuação máxima com bônus quando o aluno acerta 100%.</p>
              </div>

              {/* Bônus Streak 7 Dias */}
              <div className="p-4 bg-slate-50 dark:bg-slate-750/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center space-x-2">
                  <Flame size={16} className="text-orange-500" />
                  <label className="text-xs font-bold text-slate-800 dark:text-white">Bônus Streak 7 Dias</label>
                </div>
                <input 
                  type="number" 
                  value={gamifConfig.xp_streak_7}
                  onChange={(e) => handleXpChange('xp_streak_7', e.target.value)}
                  min={1}
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400">Bônus concedido ao completar 7 dias seguidos de leitura.</p>
              </div>

              {/* Bônus Streak 30 Dias */}
              <div className="p-4 bg-slate-50 dark:bg-slate-750/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center space-x-2">
                  <Flame size={16} className="text-red-500" />
                  <label className="text-xs font-bold text-slate-800 dark:text-white">Bônus Streak 30 Dias</label>
                </div>
                <input 
                  type="number" 
                  value={gamifConfig.xp_streak_30}
                  onChange={(e) => handleXpChange('xp_streak_30', e.target.value)}
                  min={1}
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400">Grande marco ao completar 30 dias seguidos de leitura.</p>
              </div>

              {/* Bônus Clube do Livro */}
              <div className="p-4 bg-slate-50 dark:bg-slate-750/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center space-x-2">
                  <Users size={16} className="text-blue-500" />
                  <label className="text-xs font-bold text-slate-800 dark:text-white">Bônus ao Entrar em Clube</label>
                </div>
                <input 
                  type="number" 
                  value={gamifConfig.xp_club_join}
                  onChange={(e) => handleXpChange('xp_club_join', e.target.value)}
                  min={1}
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400">Recompensa social ao ingressar em um Clube do Livro.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-95"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{isSaving ? 'Salvando...' : 'Salvar Gamificação e Níveis'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ABA 2: QUIZ & VALIDAÇÃO */}
      {activeTab === 'quiz' && (
        <form onSubmit={handleSaveQuiz} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 transition-colors">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Quantidade de Questões por Quiz
            </label>
            <input 
              type="number" 
              value={quizConfig.num_questions}
              onChange={(e) => setQuizConfig(prev => ({ ...prev, num_questions: parseInt(e.target.value, 10) || 0 }))}
              min={3} 
              max={15} 
              required
              className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors" 
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Número de questões sorteadas do banco de 50 que o aluno responderá (Mín: 3, Máx: 15).</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Quantidade de Alternativas por Questão
            </label>
            <input 
              type="number" 
              value={quizConfig.num_choices}
              onChange={(e) => setQuizConfig(prev => ({ ...prev, num_choices: parseInt(e.target.value, 10) || 0 }))}
              min={2} 
              max={6} 
              required
              className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors" 
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Número de alternativas (A, B, C...) exibidas por questão (Mín: 2, Máx: 6).</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Nota Mínima para Aprovação (%)
            </label>
            <input 
              type="number" 
              value={quizConfig.passing_score}
              onChange={(e) => setQuizConfig(prev => ({ ...prev, passing_score: parseInt(e.target.value, 10) || 0 }))}
              min={0} 
              max={100} 
              required
              className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors" 
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Porcentagem mínima de acertos necessária para validar a leitura como 100%.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Máximo de Tentativas
            </label>
            <input 
              type="number" 
              value={quizConfig.max_attempts}
              onChange={(e) => setQuizConfig(prev => ({ ...prev, max_attempts: parseInt(e.target.value, 10) || 0 }))}
              min={0} 
              required
              className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none sm:text-sm transition-colors" 
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Número máximo de tentativas permitidas por aluno (0 = ilimitado).</p>
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-95"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{isSaving ? 'Salvando...' : 'Salvar Configurações de Quiz'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
