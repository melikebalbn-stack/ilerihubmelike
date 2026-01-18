"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { CheckCircle, Loader2, AlertCircle, ChevronRight, ChevronLeft, Send, Plus, X, Check } from "lucide-react"

interface SurveyOption {
  id: string
  optionText: string
  sortOrder: number
}

interface SurveyQuestion {
  id: string
  questionText: string
  questionType: string
  sortOrder: number
  isRequired: boolean
  options: SurveyOption[]
}

interface Survey {
  id: string
  surveyNumber: string
  title: string
  description: string | null
  isAnonymous: boolean
  questions: SurveyQuestion[]
}

// Basit tarayıcı parmak izi oluştur
const generateFingerprint = (): string => {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.textBaseline = "top"
    ctx.font = "14px Arial"
    ctx.fillText("fingerprint", 2, 2)
  }

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
    navigator.hardwareConcurrency || "",
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory || "",
  ].join("|")

  // Basit hash fonksiyonu
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// Cookie işlemleri
const setCookie = (name: string, value: string, days: number) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

export default function PublicSurveyPage() {
  const params = useParams()
  const surveyId = params.id as string

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)

  // Answers state: questionId -> optionId or textAnswer (for single choice) or array of optionIds (for multiple choice)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})

  // "Diğer" custom inputs for multiple choice questions
  const [otherInputs, setOtherInputs] = useState<Record<string, string[]>>({})

  // Respondent info
  const [respondentName, setRespondentName] = useState("")
  const [respondentDepartment, setRespondentDepartment] = useState("")

  // Departments from database
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchDepartments()
  }, [])

  // Anketin daha önce doldurulup doldurulmadığını kontrol et
  useEffect(() => {
    if (surveyId) {
      checkIfAlreadyCompleted()
    }
  }, [surveyId])

  const checkIfAlreadyCompleted = () => {
    // Cookie kontrolü
    const cookieKey = `survey_completed_${surveyId}`
    const hasCookie = getCookie(cookieKey)

    // LocalStorage kontrolü (fingerprint ile)
    const fingerprint = generateFingerprint()
    const storageKey = `survey_${surveyId}_${fingerprint}`
    const hasStorage = localStorage.getItem(storageKey)

    if (hasCookie || hasStorage) {
      setAlreadyCompleted(true)
      setLoading(false)
    }
  }

  const markAsCompleted = () => {
    // Cookie kaydet (90 gün)
    const cookieKey = `survey_completed_${surveyId}`
    setCookie(cookieKey, "1", 90)

    // LocalStorage kaydet (fingerprint ile)
    const fingerprint = generateFingerprint()
    const storageKey = `survey_${surveyId}_${fingerprint}`
    localStorage.setItem(storageKey, new Date().toISOString())
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/public/departments")
      if (res.ok) {
        const data = await res.json()
        setDepartments(data)
      }
    } catch {
      console.error("Departmanlar yüklenemedi")
    }
  }

  // Pagination - sorular sayfa sayfa gösterilecek
  const [currentPage, setCurrentPage] = useState(0)
  const questionsPerPage = 5

  useEffect(() => {
    if (!alreadyCompleted) {
      fetchSurvey()
    }
  }, [surveyId, alreadyCompleted])

  // Sayfa değiştiğinde en üste scroll yap
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [currentPage])

  const fetchSurvey = async () => {
    try {
      const res = await fetch(`/api/public/survey/${surveyId}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Anket bulunamadı")
        return
      }
      const data = await res.json()
      setSurvey(data)
    } catch {
      setError("Anket yüklenirken bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const handleOptionSelect = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }))
  }

  // Multiple choice checkbox toggle
  const handleMultipleChoiceToggle = (questionId: string, optionId: string) => {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) || []
      if (current.includes(optionId)) {
        return { ...prev, [questionId]: current.filter(id => id !== optionId) }
      } else {
        return { ...prev, [questionId]: [...current, optionId] }
      }
    })
  }

  // Add new "Diğer" input field
  const addOtherInput = (questionId: string) => {
    setOtherInputs(prev => ({
      ...prev,
      [questionId]: [...(prev[questionId] || []), ""]
    }))
  }

  // Update "Diğer" input value
  const updateOtherInput = (questionId: string, index: number, value: string) => {
    setOtherInputs(prev => ({
      ...prev,
      [questionId]: prev[questionId].map((v, i) => i === index ? value : v)
    }))
  }

  // Remove "Diğer" input field
  const removeOtherInput = (questionId: string, index: number) => {
    setOtherInputs(prev => ({
      ...prev,
      [questionId]: prev[questionId].filter((_, i) => i !== index)
    }))
  }

  const handleTextAnswer = (questionId: string, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: text }))
  }

  const handleSubmit = async () => {
    if (!survey) return

    setSubmitting(true)
    setError(null)

    // Prepare final answers - include "Diğer" inputs for multiple choice
    const finalAnswers: Record<string, string | string[]> = { ...answers }

    // Add non-empty "Diğer" inputs to multiple choice answers
    Object.entries(otherInputs).forEach(([questionId, inputs]) => {
      const nonEmptyInputs = inputs.filter(v => v.trim())
      if (nonEmptyInputs.length > 0) {
        const currentAnswer = (finalAnswers[questionId] as string[]) || []
        // Add "other:" prefix to custom inputs
        finalAnswers[questionId] = [
          ...currentAnswer,
          ...nonEmptyInputs.map(v => `other:${v.trim()}`)
        ]
      }
    })

    try {
      const res = await fetch(`/api/public/survey/${surveyId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: finalAnswers,
          respondentName: respondentName.trim() || null,
          respondentDepartment: respondentDepartment || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Anket gönderilemedi")
        return
      }

      // Başarılı gönderimde tekrar doldurmayı engelle
      markAsCompleted()
      setSubmitted(true)
    } catch {
      setError("Anket gönderilirken bir hata oluştu")
    } finally {
      setSubmitting(false)
    }
  }

  // Pagination helpers
  const totalPages = survey ? Math.ceil(survey.questions.length / questionsPerPage) : 0
  const currentQuestions = survey
    ? survey.questions.slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage)
    : []

  const canGoNext = currentPage < totalPages - 1
  const canGoPrev = currentPage > 0
  const isLastPage = currentPage === totalPages - 1

  // Progress - count answered questions
  const answeredCount = Object.entries(answers).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0
    return !!value
  }).length
  const totalQuestions = survey?.questions.length || 0
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Anket yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Hata</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (alreadyCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-20 w-20 text-amber-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Anket Zaten Tamamlandı</h1>
          <p className="text-gray-600 mb-2">Bu anketi daha önce doldurmuşsunuz.</p>
          <p className="text-sm text-gray-500">
            Her kullanıcı anketi yalnızca bir kez doldurabilir. Katkılarınız için teşekkür ederiz.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Teşekkür Ederiz!</h1>
          <p className="text-gray-600 mb-2">Anket yanıtlarınız başarıyla kaydedildi.</p>
          <p className="text-sm text-gray-500">
            Katkılarınız için teşekkür ederiz. Geri bildirimleriniz şirketimiz için çok değerli.
          </p>
        </div>
      </div>
    )
  }

  if (!survey) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col items-center mb-4">
            <img
              src="/ilerigrouplogo.png"
              alt="İLERİ Group"
              className="h-8 w-auto mb-3"
            />
            <h1 className="text-xl font-bold text-gray-900 text-center">{survey.title}</h1>
            <p className="text-sm text-gray-500">{survey.surveyNumber}</p>
          </div>

          {survey.description && (
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
              {survey.description}
            </div>
          )}

          {/* Respondent Info - Sadece AI anketi için göster */}
          {(survey.id === "cm5psurvey003" || survey.title?.toLowerCase().includes("yapay zeka")) && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  İsim Soyisim
                </label>
                <input
                  type="text"
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                  placeholder="İsim soyisim giriniz..."
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departman
                </label>
                <select
                  value={respondentDepartment}
                  onChange={(e) => setRespondentDepartment(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 outline-none text-sm bg-white"
                >
                  <option value="">Departman seçiniz...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">İlerleme</span>
              <span className="font-medium text-blue-600">{answeredCount} / {totalQuestions} soru</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Questions */}
        <div className="space-y-4">
          {currentQuestions.map((question) => (
            <div key={question.id} className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <span className="bg-blue-100 text-blue-700 font-bold text-sm px-3 py-1 rounded-full">
                  {question.sortOrder}
                </span>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium leading-relaxed">
                    {question.questionText.replace(/^[A-Z]\.\s*[^-]+-\s*\d+\.\s*/, "")}
                  </p>
                </div>
              </div>

              {/* Single Choice Options (Radio) */}
              {question.questionType === "SINGLE_CHOICE" && (
                <div className="space-y-2">
                  {question.options
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleOptionSelect(question.id, option.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          answers[question.id] === option.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              answers[question.id] === option.id
                                ? "border-blue-500 bg-blue-500"
                                : "border-gray-300"
                            }`}
                          >
                            {answers[question.id] === option.id && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                          <span className={answers[question.id] === option.id ? "text-blue-700 font-medium" : "text-gray-700"}>
                            {option.optionText}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              )}

              {/* Multiple Choice Options (Checkbox) */}
              {question.questionType === "MULTIPLE_CHOICE" && (
                <div className="space-y-2">
                  {question.options
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((option) => {
                      const selectedOptions = (answers[question.id] as string[]) || []
                      const isSelected = selectedOptions.includes(option.id)

                      return (
                        <button
                          key={option.id}
                          onClick={() => handleMultipleChoiceToggle(question.id, option.id)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                                isSelected
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-gray-300"
                              }`}
                            >
                              {isSelected && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className={isSelected ? "text-blue-700 font-medium" : "text-gray-700"}>
                              {option.optionText}
                            </span>
                          </div>
                        </button>
                      )
                    })}

                  {/* "Diğer" section with dynamic inputs */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-600">Diğer (belirtiniz)</span>
                      <button
                        type="button"
                        onClick={() => addOtherInput(question.id)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Ekle
                      </button>
                    </div>

                    {/* Dynamic other inputs */}
                    {(otherInputs[question.id] || []).map((value, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateOtherInput(question.id, index, e.target.value)}
                          placeholder="Diğer aracı yazın..."
                          className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 outline-none text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeOtherInput(question.id, index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Input */}
              {(question.questionType === "TEXT_SHORT" || question.questionType === "TEXT_LONG") && (
                <textarea
                  value={answers[question.id] || ""}
                  onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                  placeholder="Yanıtınızı buraya yazın..."
                  rows={question.questionType === "TEXT_LONG" ? 4 : 2}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 outline-none resize-none"
                />
              )}
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mt-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={!canGoPrev}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                canGoPrev
                  ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  : "bg-gray-50 text-gray-300 cursor-not-allowed"
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Önceki</span>
            </button>

            {/* Page indicators */}
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    idx === currentPage ? "bg-blue-600 scale-125" : "bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>

            {isLastPage ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Gönder</span>
                    <Send className="h-5 w-5" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!canGoNext}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  canGoNext
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-50 text-gray-300 cursor-not-allowed"
                }`}
              >
                <span className="hidden sm:inline">Sonraki</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Page info */}
          <p className="text-center text-sm text-gray-500 mt-3">
            Sayfa {currentPage + 1} / {totalPages}
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          ILERI Group - İnsan Varlıkları Departmanı
        </p>
      </div>
    </div>
  )
}
