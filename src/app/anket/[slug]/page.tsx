"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle, CheckCircle2, Loader2, User, Building2 } from "lucide-react"

interface SurveyOption {
  id: string
  optionText: string
  sortOrder: number
  isOther: boolean
}

interface SurveyQuestion {
  id: string
  questionText: string
  questionType: string
  isRequired: boolean
  sortOrder: number
  minValue?: number
  maxValue?: number
  options: SurveyOption[]
}

interface Survey {
  id: string
  title: string
  description: string | null
  isAnonymous: boolean
  requireAllQuestions: boolean
  questions: SurveyQuestion[]
  startsAt: string | null
  endsAt: string | null
}

export default function PublicSurveyPage() {
  const params = useParams()
  const slug = params.slug as string

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Kullanıcı bilgileri
  const [respondentName, setRespondentName] = useState("")
  const [respondentDepartment, setRespondentDepartment] = useState("")

  // Yanıtlar
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})

  useEffect(() => {
    fetchSurvey()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const fetchSurvey = async () => {
    try {
      const res = await fetch(`/api/public/surveys/${slug}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError("Anket bulunamadı veya artık aktif değil.")
        } else {
          setError("Anket yüklenirken bir hata oluştu.")
        }
        return
      }
      const data = await res.json()
      setSurvey(data)

      // Başlangıç yanıtlarını ayarla
      const initialAnswers: Record<string, string | string[]> = {}
      data.questions.forEach((q: SurveyQuestion) => {
        if (q.questionType === "MULTIPLE_CHOICE") {
          initialAnswers[q.id] = []
        } else {
          initialAnswers[q.id] = ""
        }
      })
      setAnswers(initialAnswers)
    } catch {
      setError("Bağlantı hatası oluştu.")
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleCheckboxChange = (questionId: string, optionId: string, checked: boolean) => {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) || []
      if (checked) {
        return { ...prev, [questionId]: [...current, optionId] }
      } else {
        return { ...prev, [questionId]: current.filter(id => id !== optionId) }
      }
    })
  }

  const validateForm = (): { error: string; questionId: string } | null => {
    // İsim ve departman artık opsiyonel

    if (survey?.requireAllQuestions) {
      for (const question of survey.questions) {
        if (question.isRequired) {
          const answer = answers[question.id]
          if (!answer || (Array.isArray(answer) && answer.length === 0)) {
            return {
              error: `Lütfen "${question.questionText}" sorusunu cevaplayın.`,
              questionId: question.id
            }
          }
        }
      }
    }

    return null
  }

  const handleSubmit = async () => {
    const validationResult = validateForm()
    if (validationResult) {
      setError(validationResult.error)
      // Cevaplanmamış soruya scroll yap
      setTimeout(() => {
        const questionElement = document.getElementById(`question-${validationResult.questionId}`)
        if (questionElement) {
          questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Highlight efekti
          questionElement.classList.add('ring-2', 'ring-destructive', 'ring-offset-2')
          setTimeout(() => {
            questionElement.classList.remove('ring-2', 'ring-destructive', 'ring-offset-2')
          }, 3000)
        }
      }, 100)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/public/surveys/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respondentName: respondentName.trim(),
          respondentDepartment: respondentDepartment.trim(),
          answers
        })
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Yanıt gönderilirken bir hata oluştu.")
        return
      }

      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError("Bağlantı hatası oluştu.")
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuestion = (question: SurveyQuestion) => {
    const sortedOptions = [...question.options].sort((a, b) => a.sortOrder - b.sortOrder)

    switch (question.questionType) {
      case "SINGLE_CHOICE":
        return (
          <RadioGroup
            value={answers[question.id] as string || ""}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            <div className="space-y-3">
              {sortedOptions.map((option) => (
                <div key={option.id} className="flex items-center space-x-3">
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id} className="cursor-pointer font-normal">{option.optionText}</Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )

      case "MULTIPLE_CHOICE":
        return (
          <div className="space-y-3">
            {sortedOptions.map((option) => (
              <div key={option.id} className="flex items-center space-x-3">
                <Checkbox
                  id={option.id}
                  checked={(answers[question.id] as string[] || []).includes(option.id)}
                  onCheckedChange={(checked) => handleCheckboxChange(question.id, option.id, !!checked)}
                />
                <Label htmlFor={option.id} className="cursor-pointer font-normal">{option.optionText}</Label>
              </div>
            ))}
          </div>
        )

      case "TEXT_SHORT":
        return (
          <Input
            value={answers[question.id] as string || ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Yanıtınızı yazın..."
            className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto"
          />
        )

      case "TEXT_LONG":
        return (
          <Textarea
            value={answers[question.id] as string || ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Yanıtınızı yazın..."
            rows={4}
          />
        )

      case "YES_NO":
        return (
          <RadioGroup
            value={answers[question.id] as string || ""}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            <div className="flex space-x-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                <Label htmlFor={`${question.id}-yes`} className="cursor-pointer font-normal">Evet</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`${question.id}-no`} />
                <Label htmlFor={`${question.id}-no`} className="cursor-pointer font-normal">Hayır</Label>
              </div>
            </div>
          </RadioGroup>
        )

      case "RATING":
        return (
          <RadioGroup
            value={answers[question.id] as string || ""}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            <div className="flex space-x-4">
              {[1, 2, 3, 4, 5].map((rating) => (
                <div key={rating} className="flex flex-col items-center space-y-1">
                  <RadioGroupItem value={rating.toString()} id={`${question.id}-${rating}`} />
                  <Label htmlFor={`${question.id}-${rating}`} className="cursor-pointer text-sm font-normal">{rating}</Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )

      case "SCALE":
        const min = question.minValue || 1
        const max = question.maxValue || 10
        const scale = Array.from({ length: max - min + 1 }, (_, i) => min + i)
        return (
          <RadioGroup
            value={answers[question.id] as string || ""}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            <div className="flex flex-wrap gap-3">
              {scale.map((num) => (
                <div key={num} className="flex flex-col items-center space-y-1">
                  <RadioGroupItem value={num.toString()} id={`${question.id}-${num}`} />
                  <Label htmlFor={`${question.id}-${num}`} className="cursor-pointer text-sm font-normal">{num}</Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )

      default:
        return (
          <Input
            value={answers[question.id] as string || ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Yanıtınızı yazın..."
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Anket yükleniyor...</span>
        </div>
      </div>
    )
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold">Anket Bulunamadı</h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <h2 className="text-2xl font-semibold">Teşekkürler!</h2>
              <p className="text-muted-foreground">
                Yanıtlarınız başarıyla kaydedildi. Katılımınız için teşekkür ederiz.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!survey) return null

  const sortedQuestions = [...survey.questions].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <Image
                src="/ilerigrouplogo.png"
                alt="İLERİ Group"
                width={135}
                height={45}
                priority
              />
            </div>
            <CardTitle className="text-2xl">{survey.title}</CardTitle>
          </CardHeader>
        </Card>

        {/* Gizlilik Bildirimi */}
        <Card className="shadow-sm border-l-4 border-l-primary bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">VERMİŞ OLDUĞUNUZ CEVAPLAR GİZLİ KALACAKTIR!</strong> Anket uygulaması şirketimizde online yöntem ile gerçekleştirilecektir. Anketlerin üzerine hiç bir şekilde isim yazmanız istenmemektedir. Verdiğiniz cevapları kesinlikle gizli tutarak analiz edecek ve elde edilen sonuçları İnsan Varlıkları toplu halde raporlayacaktır. Planlanacak iyileştirme faaliyetleriyle ilgili bilgilendirme yapılacak ve bu faaliyetlere katkı sağlama imkanınız olacaktır. Anketteki bilgileri eksiksiz, tarafsız ve doğru doldurarak gerçek düşüncelerinizi ifade edebilirsiniz. Daha iyi bir çalışma hayatı sağlayabilmek amacıyla yaptığımız bu çalışmaya, zamanınızı ayırarak destek olduğunuz ve katkıda bulunduğunuz için teşekkür ederiz.
            </p>
          </CardContent>
        </Card>

        {/* Hata Mesajı (Üstte) */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Kişisel Bilgiler */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Kişisel Bilgiler</CardTitle>
            <CardDescription>İsterseniz bilgilerinizi ekleyebilirsiniz (opsiyonel)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Ad Soyad <span className="text-muted-foreground text-xs">(opsiyonel)</span>
              </Label>
              <Input
                id="name"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="Örnek: Ahmet Yılmaz"
                className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Departman <span className="text-muted-foreground text-xs">(opsiyonel)</span>
              </Label>
              <Input
                id="department"
                value={respondentDepartment}
                onChange={(e) => setRespondentDepartment(e.target.value)}
                placeholder="Örnek: Üretim, Montaj, Kalite"
                className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto"
              />
            </div>
          </CardContent>
        </Card>

        {/* Sorular */}
        {sortedQuestions.map((question, index) => (
          <Card key={question.id} id={`question-${question.id}`} className="shadow-sm transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium leading-relaxed">
                {index + 1}. {question.questionText}
                {question.isRequired && <span className="text-destructive ml-1">*</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {renderQuestion(question)}
            </CardContent>
          </Card>
        ))}

        {/* Gönder Butonu */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                "Anketi Gönder"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground pb-4">
          İLERİ Group - İnsan Kaynakları Departmanı
        </p>
      </div>
    </div>
  )
}
