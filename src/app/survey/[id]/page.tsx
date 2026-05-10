'use client'

// PR-SURVEY-UI-REFACTOR: Public survey sayfası — thin wrapper.
//
// Sorumluluk:
//   1. Daha önce doldurulmuş mu kontrolü (cookie + fingerprint)
//   2. Survey + departman fetch
//   3. Loading / error / already-completed / submitted state'leri
//   4. SurveyRenderer'a delegate
//
// Form mantığı (multi-step, soru render, submit) SurveyRenderer'da.

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { SurveyRenderer } from '@/components/survey/SurveyRenderer'
import type { SurveyQuestionLite } from '@/components/survey/sections'

interface Survey {
  id: string
  surveyNumber: string
  title: string
  description: string | null
  isAnonymous: boolean
  questions: SurveyQuestionLite[]
}

const FINGERPRINT_HASH_BASE = 36

function generateFingerprint(): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('fingerprint', 2, 2)
  }
  const fp = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
    navigator.hardwareConcurrency || '',
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory || '',
  ].join('|')
  let hash = 0
  for (let i = 0; i < fp.length; i++) {
    hash = ((hash << 5) - hash) + fp.charCodeAt(i)
    hash &= hash
  }
  return Math.abs(hash).toString(FINGERPRINT_HASH_BASE)
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

export default function PublicSurveyPage() {
  const params = useParams()
  const surveyId = params.id as string

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!surveyId) return

    const cookieKey = `survey_completed_${surveyId}`
    const fingerprint = generateFingerprint()
    const storageKey = `survey_${surveyId}_${fingerprint}`

    if (getCookie(cookieKey) || localStorage.getItem(storageKey)) {
      setAlreadyCompleted(true)
      setLoading(false)
      return
    }

    Promise.all([
      fetch(`/api/public/survey/${surveyId}`).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data.error || 'Anket bulunamadı')
        }
        return r.json()
      }),
      fetch('/api/public/departments').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([s, d]) => {
        setSurvey(s)
        setDepartments(d)
      })
      .catch((err) => setError(err.message || 'Anket yüklenirken hata oluştu'))
      .finally(() => setLoading(false))
  }, [surveyId])

  const markAsCompleted = () => {
    setCookie(`survey_completed_${surveyId}`, '1', 90)
    const storageKey = `survey_${surveyId}_${generateFingerprint()}`
    localStorage.setItem(storageKey, new Date().toISOString())
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1B4F72] mx-auto mb-3" />
          <p className="text-sm text-slate-500">Anket yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-xl font-medium text-slate-900 mb-2">Hata</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  if (alreadyCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-medium text-slate-900 mb-2">Anket Zaten Tamamlandı</h1>
          <p className="text-sm text-slate-500">
            Bu anketi daha önce doldurmuşsunuz. Her kullanıcı anketi yalnızca bir kez
            doldurabilir. Katkılarınız için teşekkür ederiz.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-medium text-slate-900 mb-2">Teşekkür Ederiz</h1>
          <p className="text-sm text-slate-500">
            Cevaplarınız başarıyla kaydedildi. Geri bildirimleriniz şirketimiz için çok değerli.
          </p>
        </div>
      </div>
    )
  }

  if (!survey) return null

  return (
    <SurveyRenderer
      survey={survey}
      departments={departments}
      onSubmitted={() => {
        markAsCompleted()
        setSubmitted(true)
      }}
    />
  )
}
