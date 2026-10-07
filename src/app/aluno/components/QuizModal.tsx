'use client'

import React, { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle, XCircle, Trophy, RotateCcw, BookOpen } from 'lucide-react'

interface QuizModalProps {
  bookId: string
  bookTitle: string
  studentId: string
  onClose: () => void
  onComplete: (score: number, passed: boolean) => void
}

interface Question {
  question: string
  choices: string[]
  correctIndex: number
}

interface QuestionWithAnswer extends Question {
  studentAnswer?: number
}

export default function QuizModal({ bookId, bookTitle, studentId, onClose, onComplete }: QuizModalProps) {
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number, passed: boolean, totalQuestions: number, correctAnswers: number } | null>(null)

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`/api/quiz/generate?bookId=${bookId}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gerar questões do quiz')
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Não foi possível gerar questões para este livro no momento.')
      }

      setQuestions(data)
    } catch (err: any) {
      console.error('Quiz fetch error:', err)
      setError(err.message || 'Erro desconhecido ao carregar questionário')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuestions()
  }, [bookId])

  const handleSelectChoice = (choiceIndex: number) => {
    const updated = [...questions]
    updated[currentIndex].studentAnswer = choiceIndex
    setQuestions(updated)
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(curr => curr + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(curr => curr - 1)
    }
  }

  const handleSubmit = async () => {
    // Check se todos foram respondidos
    if (questions.some(q => q.studentAnswer === undefined)) {
      alert("Por favor, responda todas as questões antes de finalizar.")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          studentId,
          questions
        })
      })

      if (!res.ok) {
        throw new Error('Falha ao salvar as respostas')
      }

      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      alert(err.message || "Erro ao enviar respostas")
    } finally {
      setSubmitting(false)
    }
  }
  
  const handleComplete = () => {
    if (result) {
      onComplete(result.score, result.passed)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-lg font-medium text-slate-700 dark:text-slate-300">Gerando questões sobre o livro...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl max-w-md w-full text-center border border-slate-200 dark:border-slate-700 shadow-lg">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Ops! Ocorreu um erro.</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600">Cancelar</button>
            <button onClick={fetchQuestions} className="px-4 py-2 rounded-lg bg-indigo-600 text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Tentar novamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-900 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg text-center">
            <div className="text-6xl mb-6">{result.passed ? '🎉' : '😢'}</div>
            
            <div className="mb-4">
              <span className="text-5xl font-extrabold text-indigo-600 dark:text-indigo-400">{Math.round(result.score)}%</span>
            </div>
            
            <h2 className="text-2xl font-bold mb-2">
              {result.passed 
                ? `Parabéns! Você acertou ${result.correctAnswers} de ${result.totalQuestions} questões!` 
                : `Quase lá! Você acertou ${result.correctAnswers} de ${result.totalQuestions} questões.`}
            </h2>
            
            <div className="my-6">
              {result.passed ? (
                <span className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full font-bold">
                  <CheckCircle className="w-5 h-5" /> Aprovado!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-4 py-2 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full font-bold">
                  <XCircle className="w-5 h-5" /> Tente novamente
                </span>
              )}
            </div>
            
            <div className="flex justify-center gap-4 mt-8">
              {!result.passed && (
                <button 
                  onClick={() => {
                    setResult(null);
                    setCurrentIndex(0);
                    const reset = questions.map(q => ({...q, studentAnswer: undefined}));
                    setQuestions(reset);
                  }}
                  className="px-6 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-medium transition-colors"
                >
                  Tentar Novamente
                </button>
              )}
              <button 
                onClick={handleComplete}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
              >
                Voltar
              </button>
            </div>
            
            <div className="mt-12 text-left">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> Revisão
              </h3>
              <div className="space-y-4">
                {questions.map((q, i) => {
                  const isCorrect = q.studentAnswer === q.correctIndex;
                  return (
                    <div key={i} className={`p-4 rounded-xl border ${isCorrect ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/30' : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800/30'}`}>
                      <p className="font-medium mb-2">{i + 1}. {q.question}</p>
                      <div className="space-y-1 text-sm">
                        <p className={isCorrect ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-600 dark:text-slate-400 line-through'}>
                          Sua resposta: {q.choices[q.studentAnswer!]}
                        </p>
                        {!isCorrect && (
                          <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                            Resposta correta: {q.choices[q.correctIndex]}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentQ = questions[currentIndex]
  const letters = ['A', 'B', 'C', 'D', 'E', 'F']

  return (
    <div className="fixed inset-0 z-[60] bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8">
        
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex-1">
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{bookTitle}</h3>
            <p className="font-extrabold text-lg text-slate-900 dark:text-white">Questão {currentIndex + 1} de {questions.length}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Fechar / Responder depois"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Question card */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl mb-6 space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-relaxed">
            {currentQ.question}
          </h2>
          
          <div className="space-y-3">
            {currentQ.choices.map((choice, i) => {
              const isSelected = currentQ.studentAnswer === i
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectChoice(i)}
                  className={`w-full flex items-center p-4 sm:p-5 rounded-2xl text-left transition-all border-2 ${
                    isSelected 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-[1.01]' 
                      : 'bg-slate-50 dark:bg-slate-750/70 border-slate-200 dark:border-slate-650 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-slate-700 text-slate-900 dark:text-white'
                  }`}
                >
                  <span className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl mr-4 font-black text-sm transition-colors ${
                    isSelected 
                      ? 'bg-indigo-800 text-white' 
                      : 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-600 shadow-sm'
                  }`}>
                    {letters[i]}
                  </span>
                  <span className={`text-base sm:text-lg font-semibold ${
                    isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    {choice}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button 
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" /> Anterior
          </button>
          
          {currentIndex === questions.length - 1 ? (
            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-70 shadow-lg shadow-emerald-500/30 active:scale-95 text-base"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
              Finalizar e Enviar
            </button>
          ) : (
            <button 
              onClick={handleNext}
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md active:scale-95"
            >
              Próxima <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
