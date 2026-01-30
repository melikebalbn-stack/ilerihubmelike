"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Download,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  PieChart,
  FileText,
  Building2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Target,
  Percent,
  Bot,
  Clock,
  Zap,
  Lightbulb,
  BookOpen,
  Wrench,
  Eye,
  User,
} from "lucide-react"

interface SurveyOption {
  id: string
  optionText: string
  sortOrder: number
}

interface QuestionAnswer {
  optionId: string | null
  textAnswer: string | null
  responseId: string
  response: {
    id: string
    respondentName: string | null
    respondentDepartment: string | null
  }
}

interface SurveyQuestion {
  id: string
  questionText: string
  questionType: string
  sortOrder: number
  options: SurveyOption[]
  answers: QuestionAnswer[]
}

interface SurveyResponse {
  id: string
  respondentName: string | null
  respondentDepartment: string | null
  completedAt: string | null
  createdAt: string
}

interface SurveyDetail {
  id: string
  surveyNumber: string
  title: string
  description: string | null
  status: string
  createdAt: string
  questions: SurveyQuestion[]
  responses: SurveyResponse[]
  _count: {
    responses: number
    questions: number
  }
}

interface CategoryStats {
  name: string
  questionCount: number
  positivePercent: number
  neutralPercent: number
  negativePercent: number
  questions: Array<{
    id: string
    text: string
    positive: number
    neutral: number
    negative: number
    total: number
  }>
}

// Soru kategorileri (İLERİ Group Çalışan Memnuniyet Anketi 2026)
const questionCategories: Record<string, string> = {
  // A. GENEL MEMNUNİYET (1-4) -> Genel Memnuniyet Endeksi
  "q001": "Genel Memnuniyet Endeksi",
  "q002": "Genel Memnuniyet Endeksi",
  "q003": "Genel Memnuniyet Endeksi",
  "q004": "Genel Memnuniyet Endeksi",
  // B. YAPILAN İŞ & YETKİLENDİRME (5-7) -> Çalışma Koşulları
  "q005": "Çalışma Koşulları",
  "q006": "Çalışma Koşulları",
  "q007": "Çalışma Koşulları",
  // C. ÇALIŞMA KOŞULLARI (8-11) -> Çalışma Koşulları
  "q008": "Çalışma Koşulları",
  "q009": "Çalışma Koşulları",
  "q010": "Çalışma Koşulları",
  "q011": "Çalışma Koşulları",
  // D. İLK YÖNETİCİ / AMİR (12-19) -> Yönetici & Liderlik Algısı
  "q012": "Yönetici & Liderlik Algısı",
  "q013": "Yönetici & Liderlik Algısı",
  "q014": "Yönetici & Liderlik Algısı",
  "q015": "Yönetici & Liderlik Algısı",
  "q016": "Yönetici & Liderlik Algısı",
  "q017": "Yönetici & Liderlik Algısı",
  "q018": "Yönetici & Liderlik Algısı",
  "q019": "Yönetici & Liderlik Algısı",
  // E. SOSYAL OLANAKLAR (20-23) -> Sosyal Olanaklar
  "q020": "Sosyal Olanaklar",
  "q021": "Sosyal Olanaklar",
  "q022": "Sosyal Olanaklar",
  "q023": "Sosyal Olanaklar",
  // F. İLETİŞİM & ŞİRKET YÖNETİMİ & TAKDİR TANIMA (24-31) -> İletişim & Yönetim
  "q024": "İletişim & Yönetim",
  "q025": "İletişim & Yönetim",
  "q026": "İletişim & Yönetim",
  "q027": "İletişim & Yönetim",
  "q028": "İletişim & Yönetim",
  "q029": "İletişim & Yönetim",
  "q030": "İletişim & Yönetim",
  "q031": "İletişim & Yönetim",
  // G. GENEL DEĞERLENDİRME (32-36) -> Genel Memnuniyet Endeksi
  "q032": "Genel Memnuniyet Endeksi",
  "q033": "Genel Memnuniyet Endeksi",
  "q034": "Genel Memnuniyet Endeksi",
  "q035": "Genel Memnuniyet Endeksi",
  "q036": "Genel Memnuniyet Endeksi",
  // H. ETİK / İNSAN HAKLARI / AYRIMCILIK (37-49) -> Etik & İnsan Hakları Risk Alanları
  "q037": "Etik & İnsan Hakları Risk Alanları",
  "q038": "Etik & İnsan Hakları Risk Alanları",
  "q039": "Etik & İnsan Hakları Risk Alanları",
  "q040": "Etik & İnsan Hakları Risk Alanları",
  "q041": "Etik & İnsan Hakları Risk Alanları",
  "q042": "Etik & İnsan Hakları Risk Alanları",
  "q043": "Etik & İnsan Hakları Risk Alanları",
  "q044": "Etik & İnsan Hakları Risk Alanları",
  "q045": "Etik & İnsan Hakları Risk Alanları",
  "q046": "Etik & İnsan Hakları Risk Alanları",
  "q047": "Etik & İnsan Hakları Risk Alanları",
  "q048": "Etik & İnsan Hakları Risk Alanları",
  "q049": "Etik & İnsan Hakları Risk Alanları",
  // I. OPSİYONEL (50-52) -> Genel Memnuniyet Endeksi
  "q050": "Genel Memnuniyet Endeksi",
  "q051": "Genel Memnuniyet Endeksi",
  "q052": "Genel Memnuniyet Endeksi",
  // Demografik sorular (54-57) - analiz dışı
  "q054": "Demografik",
  "q055": "Demografik",
  "q056": "Demografik",
  "q057": "Demografik",
}

// Kategori sıralaması (raporda görünecek sıra)
const categoryOrder = [
  "Genel Memnuniyet Endeksi",
  "Yönetici & Liderlik Algısı",
  "Çalışma Koşulları",
  "Sosyal Olanaklar",
  "İletişim & Yönetim",
  "Etik & İnsan Hakları Risk Alanları",
]

export default function SurveyResultsPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [survey, setSurvey] = useState<SurveyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null)
  const [responseDetailOpen, setResponseDetailOpen] = useState(false)

  const surveyId = params.id as string

  useEffect(() => {
    if (surveyId) {
      fetchSurveyResults()
    }
  }, [surveyId])

  const fetchSurveyResults = async () => {
    try {
      setError(null)
      const res = await fetch(`/api/surveys/${surveyId}/results`)
      const data = await res.json()

      if (res.ok) {
        setSurvey(data)
      } else {
        // API'den gelen hata mesajını göster
        setError(data.error || "Anket sonuçları yüklenemedi")
      }
    } catch (err) {
      console.error("Anket sonuçları yüklenemedi:", err)
      setError("Anket sonuçları yüklenirken bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  // Katılımcı detayını aç
  const openResponseDetail = (response: SurveyResponse) => {
    setSelectedResponse(response)
    setResponseDetailOpen(true)
  }

  // Seçili katılımcının yanıtlarını getir
  const getResponseAnswers = (responseId: string) => {
    if (!survey) return []

    const answers: Array<{
      question: SurveyQuestion
      selectedOptions: SurveyOption[]
      textAnswer: string | null
    }> = []

    survey.questions.forEach(question => {
      const questionAnswers = question.answers.filter(a => a.response.id === responseId)

      if (questionAnswers.length > 0) {
        const selectedOptions: SurveyOption[] = []
        let textAnswer: string | null = null

        questionAnswers.forEach(ans => {
          if (ans.optionId) {
            const option = question.options.find(o => o.id === ans.optionId)
            if (option) selectedOptions.push(option)
          }
          if (ans.textAnswer) {
            textAnswer = textAnswer ? `${textAnswer}, ${ans.textAnswer}` : ans.textAnswer
          }
        })

        answers.push({
          question,
          selectedOptions,
          textAnswer
        })
      }
    })

    return answers.sort((a, b) => a.question.sortOrder - b.question.sortOrder)
  }

  // Departmanları çıkar
  const departments = survey?.responses
    ? [...new Set(survey.responses.map(r => r.respondentDepartment).filter(Boolean))]
    : []

  // Seçili departmana göre yanıtları filtrele
  const filteredResponses = selectedDepartment === "all"
    ? survey?.responses || []
    : survey?.responses.filter(r => r.respondentDepartment === selectedDepartment) || []

  const filteredResponseIds = new Set(filteredResponses.map(r => r.id))

  // İstatistikleri hesapla
  const calculateStats = () => {
    if (!survey) return null

    let totalPositive = 0
    let totalNeutral = 0
    let totalNegative = 0
    let totalAnswers = 0

    const categoryMap = new Map<string, CategoryStats>()

    survey.questions.forEach(question => {
      const category = questionCategories[question.id] || "Diğer"

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          name: category,
          questionCount: 0,
          positivePercent: 0,
          neutralPercent: 0,
          negativePercent: 0,
          questions: []
        })
      }

      const catStats = categoryMap.get(category)!
      catStats.questionCount++

      // Filtrelenmiş yanıtları say
      const relevantAnswers = question.answers.filter(a => {
        const responseId = survey.responses.find(r =>
          r.respondentName === a.response.respondentName &&
          r.respondentDepartment === a.response.respondentDepartment
        )?.id
        return responseId ? filteredResponseIds.has(responseId) : selectedDepartment === "all"
      })

      let positive = 0
      let neutral = 0
      let negative = 0

      relevantAnswers.forEach(answer => {
        if (!answer.optionId) return

        const option = question.options.find(o => o.id === answer.optionId)
        if (!option) return

        const optionText = option.optionText.toLowerCase()

        if (optionText.includes("katılıyorum") && !optionText.includes("katılmıyorum")) {
          positive++
          totalPositive++
        } else if (optionText.includes("katılmıyorum") || optionText.includes("memnun değilim")) {
          negative++
          totalNegative++
        } else if (optionText.includes("kararsızım") || optionText.includes("kısmen")) {
          neutral++
          totalNeutral++
        } else if (optionText.includes("memnunum") && !optionText.includes("değilim")) {
          positive++
          totalPositive++
        }

        totalAnswers++
      })

      const total = positive + neutral + negative
      if (total > 0) {
        catStats.questions.push({
          id: question.id,
          text: question.questionText,
          positive,
          neutral,
          negative,
          total
        })
      }
    })

    // Kategori yüzdelerini hesapla
    categoryMap.forEach(cat => {
      const totals = cat.questions.reduce((acc, q) => ({
        positive: acc.positive + q.positive,
        neutral: acc.neutral + q.neutral,
        negative: acc.negative + q.negative,
        total: acc.total + q.total
      }), { positive: 0, neutral: 0, negative: 0, total: 0 })

      if (totals.total > 0) {
        cat.positivePercent = Math.round((totals.positive / totals.total) * 100)
        cat.neutralPercent = Math.round((totals.neutral / totals.total) * 100)
        cat.negativePercent = Math.round((totals.negative / totals.total) * 100)
      }
    })

    const overallPositive = totalAnswers > 0 ? Math.round((totalPositive / totalAnswers) * 100) : 0
    const overallNeutral = totalAnswers > 0 ? Math.round((totalNeutral / totalAnswers) * 100) : 0
    const overallNegative = totalAnswers > 0 ? Math.round((totalNegative / totalAnswers) * 100) : 0

    // Kategorileri sırala (categoryOrder'a göre)
    const sortedCategories = Array.from(categoryMap.values())
      .filter(c => c.questions.length > 0 && c.name !== "Demografik")
      .sort((a, b) => {
        const orderA = categoryOrder.indexOf(a.name)
        const orderB = categoryOrder.indexOf(b.name)
        if (orderA === -1 && orderB === -1) return 0
        if (orderA === -1) return 1
        if (orderB === -1) return -1
        return orderA - orderB
      })

    // Öncelikli aksiyon alanları (en düşük olumlu orana sahip 3 kategori)
    const priorityAreas = [...sortedCategories]
      .sort((a, b) => a.positivePercent - b.positivePercent)
      .slice(0, 3)

    return {
      totalResponses: filteredResponses.length,
      overallPositive,
      overallNeutral,
      overallNegative,
      categories: sortedCategories,
      priorityAreas,
      engagementScore: overallPositive // Basit engagement score
    }
  }

  const stats = calculateStats()

  // Departman bazlı karşılaştırma
  const getDepartmentComparison = () => {
    if (!survey || departments.length === 0) return []

    return departments.map(dept => {
      const deptResponses = survey.responses.filter(r => r.respondentDepartment === dept)
      const deptResponseIds = new Set(deptResponses.map(r => r.id))

      let positive = 0
      let total = 0

      survey.questions.forEach(question => {
        question.answers.forEach(answer => {
          const responseId = survey.responses.find(r =>
            r.respondentName === answer.response.respondentName &&
            r.respondentDepartment === answer.response.respondentDepartment
          )?.id

          if (!responseId || !deptResponseIds.has(responseId)) return
          if (!answer.optionId) return

          const option = question.options.find(o => o.id === answer.optionId)
          if (!option) return

          const optionText = option.optionText.toLowerCase()
          total++

          if ((optionText.includes("katılıyorum") && !optionText.includes("katılmıyorum")) ||
              (optionText.includes("memnunum") && !optionText.includes("değilim"))) {
            positive++
          }
        })
      })

      return {
        department: dept,
        responseCount: deptResponses.length,
        positivePercent: total > 0 ? Math.round((positive / total) * 100) : 0
      }
    }).sort((a, b) => b.positivePercent - a.positivePercent)
  }

  const departmentComparison = getDepartmentComparison()

  // AI Anketi kontrolü
  const isAISurvey = survey?.id === "cm5psurvey003" || survey?.title?.toLowerCase().includes("yapay zeka")

  // AI Anketi için özel analiz
  const calculateAIStats = () => {
    if (!survey) return null

    const questions = survey.questions
    const responses = filteredResponses

    // 1. Kullanılan AI Araçları (ai001)
    const aiToolsQuestion = questions.find(q => q.id === "ai001")
    const aiToolsUsage: Record<string, number> = {}
    let noToolUsers = 0

    if (aiToolsQuestion) {
      aiToolsQuestion.answers.forEach(answer => {
        if (answer.optionId) {
          const option = aiToolsQuestion.options.find(o => o.id === answer.optionId)
          if (option) {
            if (option.optionText === "Hiçbirini kullanmıyorum") {
              noToolUsers++
            } else {
              aiToolsUsage[option.optionText] = (aiToolsUsage[option.optionText] || 0) + 1
            }
          }
        }
        // Diğer (custom) cevaplar
        if (answer.textAnswer) {
          aiToolsUsage[answer.textAnswer] = (aiToolsUsage[answer.textAnswer] || 0) + 1
        }
      })
    }

    // 2. Kullanım Sıklığı (ai002)
    const frequencyQuestion = questions.find(q => q.id === "ai002")
    const frequencyDist: Record<string, number> = {}

    if (frequencyQuestion) {
      frequencyQuestion.answers.forEach(answer => {
        if (answer.optionId) {
          const option = frequencyQuestion.options.find(o => o.id === answer.optionId)
          if (option) {
            frequencyDist[option.optionText] = (frequencyDist[option.optionText] || 0) + 1
          }
        }
      })
    }

    // 3. Kullanım Amaçları (ai003)
    const purposeQuestion = questions.find(q => q.id === "ai003")
    const purposeDist: Record<string, number> = {}

    if (purposeQuestion) {
      purposeQuestion.answers.forEach(answer => {
        if (answer.optionId) {
          const option = purposeQuestion.options.find(o => o.id === answer.optionId)
          if (option) {
            purposeDist[option.optionText] = (purposeDist[option.optionText] || 0) + 1
          }
        }
      })
    }

    // 4. Verimlilik Verileri (ai004-ai007)
    const taskDescriptions: string[] = []
    const beforeTimes: number[] = []
    const afterTimes: number[] = []
    const frequencies: number[] = []

    const taskQ = questions.find(q => q.id === "ai004")
    const beforeQ = questions.find(q => q.id === "ai005")
    const afterQ = questions.find(q => q.id === "ai006")
    const freqQ = questions.find(q => q.id === "ai007")

    if (taskQ) {
      taskQ.answers.forEach(a => {
        if (a.textAnswer) taskDescriptions.push(a.textAnswer)
      })
    }

    if (beforeQ) {
      beforeQ.answers.forEach(a => {
        if (a.textAnswer) {
          const num = parseFloat(a.textAnswer.replace(/[^0-9.,]/g, "").replace(",", "."))
          if (!isNaN(num)) beforeTimes.push(num)
        }
      })
    }

    if (afterQ) {
      afterQ.answers.forEach(a => {
        if (a.textAnswer) {
          const num = parseFloat(a.textAnswer.replace(/[^0-9.,]/g, "").replace(",", "."))
          if (!isNaN(num)) afterTimes.push(num)
        }
      })
    }

    if (freqQ) {
      freqQ.answers.forEach(a => {
        if (a.textAnswer) {
          const num = parseFloat(a.textAnswer.replace(/[^0-9.,]/g, "").replace(",", "."))
          if (!isNaN(num)) frequencies.push(num)
        }
      })
    }

    // Verimlilik hesapla
    let totalTimeSavedPerTask = 0
    let avgTimeSavedPercent = 0
    const validPairs = Math.min(beforeTimes.length, afterTimes.length)

    if (validPairs > 0) {
      for (let i = 0; i < validPairs; i++) {
        if (beforeTimes[i] > 0) {
          totalTimeSavedPerTask += beforeTimes[i] - afterTimes[i]
          avgTimeSavedPercent += ((beforeTimes[i] - afterTimes[i]) / beforeTimes[i]) * 100
        }
      }
      avgTimeSavedPercent = avgTimeSavedPercent / validPairs
    }

    const avgBefore = beforeTimes.length > 0 ? beforeTimes.reduce((a, b) => a + b, 0) / beforeTimes.length : 0
    const avgAfter = afterTimes.length > 0 ? afterTimes.reduce((a, b) => a + b, 0) / afterTimes.length : 0
    const avgFrequency = frequencies.length > 0 ? frequencies.reduce((a, b) => a + b, 0) / frequencies.length : 0

    // Aylık tahmini tasarruf (dakika)
    const monthlyTimeSaved = (avgBefore - avgAfter) * avgFrequency

    // 5. Değer Dağıtımı (ai008)
    const valueQuestion = questions.find(q => q.id === "ai008")
    const valueDist: Record<string, number> = {}

    if (valueQuestion) {
      valueQuestion.answers.forEach(answer => {
        if (answer.optionId) {
          const option = valueQuestion.options.find(o => o.id === answer.optionId)
          if (option) {
            valueDist[option.optionText] = (valueDist[option.optionText] || 0) + 1
          }
        }
      })
    }

    // 6. Stratejik Proje Örnekleri (ai009)
    const strategicExamples: string[] = []
    const stratQ = questions.find(q => q.id === "ai009")
    if (stratQ) {
      stratQ.answers.forEach(a => {
        if (a.textAnswer && a.textAnswer.trim()) strategicExamples.push(a.textAnswer)
      })
    }

    // 7. Potansiyel AI Kullanım Alanları (ai010)
    const potentialAreas: string[] = []
    const potentialQ = questions.find(q => q.id === "ai010")
    if (potentialQ) {
      potentialQ.answers.forEach(a => {
        if (a.textAnswer && a.textAnswer.trim()) potentialAreas.push(a.textAnswer)
      })
    }

    // 8. İhtiyaçlar (ai011)
    const needsQuestion = questions.find(q => q.id === "ai011")
    const needsDist: Record<string, number> = {}

    if (needsQuestion) {
      needsQuestion.answers.forEach(answer => {
        if (answer.optionId) {
          const option = needsQuestion.options.find(o => o.id === answer.optionId)
          if (option) {
            needsDist[option.optionText] = (needsDist[option.optionText] || 0) + 1
          }
        }
      })
    }

    // AI kullanım oranı
    const totalRespondents = responses.length
    const aiUsers = totalRespondents - noToolUsers
    const aiAdoptionRate = totalRespondents > 0 ? Math.round((aiUsers / totalRespondents) * 100) : 0

    // Aktif kullanıcı oranı (Günlük + Haftalık)
    const dailyUsers = frequencyDist["Günlük"] || 0
    const weeklyUsers = frequencyDist["Haftalık"] || 0
    const activeUserRate = totalRespondents > 0 ? Math.round(((dailyUsers + weeklyUsers) / totalRespondents) * 100) : 0

    return {
      totalResponses: responses.length,
      aiAdoptionRate,
      activeUserRate,
      aiToolsUsage,
      frequencyDist,
      purposeDist,
      valueDist,
      needsDist,
      taskDescriptions,
      strategicExamples,
      potentialAreas,
      avgBefore: Math.round(avgBefore * 10) / 10,
      avgAfter: Math.round(avgAfter * 10) / 10,
      avgTimeSavedPercent: Math.round(avgTimeSavedPercent),
      monthlyTimeSaved: Math.round(monthlyTimeSaved),
      avgFrequency: Math.round(avgFrequency * 10) / 10,
    }
  }

  const aiStats = isAISurvey ? calculateAIStats() : null

  // CSV Export
  const exportToCSV = () => {
    if (!survey) return

    let csv = "Soru,Katılıyorum,Kararsızım,Katılmıyorum,Toplam\n"

    survey.questions.forEach(q => {
      const answers = q.answers
      let positive = 0, neutral = 0, negative = 0

      answers.forEach(a => {
        if (!a.optionId) return
        const opt = q.options.find(o => o.id === a.optionId)
        if (!opt) return
        const text = opt.optionText.toLowerCase()
        if (text.includes("katılıyorum") && !text.includes("katılmıyorum")) positive++
        else if (text.includes("katılmıyorum")) negative++
        else if (text.includes("kararsızım")) neutral++
      })

      csv += `"${q.questionText}",${positive},${neutral},${negative},${positive + neutral + negative}\n`
    })

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `anket-sonuclari-${survey.surveyNumber}.csv`
    link.click()
  }

  // Yetki kontrolü
  const userRole = session?.user?.role || "USER"
  const userDepartment = session?.user?.department || ""
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr", "ik"]
  const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept.toLowerCase()))
  const canView = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"].includes(userRole) || isHrDepartment

  if (!canView) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <span>Bu sayfaya erişim yetkiniz bulunmamaktadır.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {error || "Anket bulunamadı"}
                </p>
                {error && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Lütfen yetkinizi kontrol edin veya sistem yöneticisi ile iletişime geçin.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <Button variant="outline" onClick={() => router.push("/surveys")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anketlere Dön
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // AI Anketi için özel UI
  if (isAISurvey && aiStats) {
    const sortedTools = Object.entries(aiStats.aiToolsUsage).sort((a, b) => b[1] - a[1])
    const sortedPurpose = Object.entries(aiStats.purposeDist).sort((a, b) => b[1] - a[1])
    const sortedValue = Object.entries(aiStats.valueDist).sort((a, b) => b[1] - a[1])
    const sortedNeeds = Object.entries(aiStats.needsDist).sort((a, b) => b[1] - a[1])
    const sortedFreq = Object.entries(aiStats.frequencyDist).sort((a, b) => b[1] - a[1])

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/surveys")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-purple-600" />
                <h1 className="text-2xl font-bold">{survey.title}</h1>
              </div>
              <p className="text-muted-foreground">{survey.surveyNumber} • Yapay Zeka Kullanım Analizi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[200px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Departman Seç" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Departmanlar</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept || ""}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV İndir
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Katılım</p>
                  <p className="text-3xl font-bold">{aiStats.totalResponses}</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Kullanım Oranı</p>
                  <p className="text-3xl font-bold text-green-600">{aiStats.aiAdoptionRate}%</p>
                </div>
                <Bot className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aktif Kullanıcı</p>
                  <p className="text-3xl font-bold text-blue-600">{aiStats.activeUserRate}%</p>
                  <p className="text-xs text-muted-foreground">Günlük/Haftalık</p>
                </div>
                <Zap className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Zaman Tasarrufu</p>
                  <p className="text-3xl font-bold text-orange-600">{aiStats.avgTimeSavedPercent}%</p>
                  <p className="text-xs text-muted-foreground">Ortalama</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verimlilik Özeti */}
        {aiStats.avgBefore > 0 && (
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Verimlilik Analizi
              </CardTitle>
              <CardDescription>
                AI kullanımı ile elde edilen zaman tasarrufu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">AI Öncesi</p>
                  <p className="text-2xl font-bold text-red-600">{aiStats.avgBefore} dk</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">AI Sonrası</p>
                  <p className="text-2xl font-bold text-green-600">{aiStats.avgAfter} dk</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">Görev Sıklığı</p>
                  <p className="text-2xl font-bold text-blue-600">{aiStats.avgFrequency}x/ay</p>
                </div>
                <div className="text-center p-4 bg-purple-100 rounded-lg shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">Aylık Tasarruf</p>
                  <p className="text-2xl font-bold text-purple-600">{aiStats.monthlyTimeSaved} dk</p>
                  <p className="text-xs text-muted-foreground">≈ {Math.round(aiStats.monthlyTimeSaved / 60 * 10) / 10} saat</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Araç Kullanımı
            </TabsTrigger>
            <TabsTrigger value="efficiency" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Verimlilik
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              İçgörüler
            </TabsTrigger>
            <TabsTrigger value="needs" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              İhtiyaçlar
            </TabsTrigger>
            <TabsTrigger value="responses" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Katılımcılar
            </TabsTrigger>
          </TabsList>

          {/* Araç Kullanımı Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kullanılan AI Araçları */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Kullanılan AI Araçları</CardTitle>
                  <CardDescription>En çok tercih edilen yapay zeka araçları</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sortedTools.map(([tool, count]) => (
                      <div key={tool} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{tool}</span>
                          <span className="font-medium">{count} kişi</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${(count / aiStats.totalResponses) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {sortedTools.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">Henüz veri yok</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Kullanım Sıklığı */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Kullanım Sıklığı</CardTitle>
                  <CardDescription>AI araçlarının kullanım frekansı</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sortedFreq.map(([freq, count]) => {
                      const colors: Record<string, string> = {
                        "Günlük": "bg-green-500",
                        "Haftalık": "bg-blue-500",
                        "Proje bazlı": "bg-yellow-500",
                        "Çok nadir": "bg-orange-500",
                        "Hiç kullanmıyorum": "bg-red-500",
                      }
                      return (
                        <div key={freq} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{freq}</span>
                            <span className="font-medium">{count} kişi ({Math.round((count / aiStats.totalResponses) * 100)}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${colors[freq] || "bg-gray-500"}`}
                              style={{ width: `${(count / aiStats.totalResponses) * 100}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Kullanım Amaçları */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Kullanım Amaçları</CardTitle>
                  <CardDescription>AI hangi işler için kullanılıyor?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {sortedPurpose.map(([purpose, count]) => (
                      <div key={purpose} className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-600">{count}</p>
                        <p className="text-xs text-muted-foreground">{purpose}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Verimlilik Tab */}
          <TabsContent value="efficiency" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Değer Dağıtımı */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Kazanılan Zaman Nasıl Değerlendiriliyor?</CardTitle>
                  <CardDescription>AI ile kazanılan zamanın kullanım alanları</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sortedValue.map(([value, count]) => {
                      const labels: Record<string, { short: string; color: string }> = {
                        "Aynı sürede daha fazla iş üretiyorum (Hacim artışı)": { short: "Hacim Artışı", color: "bg-blue-500" },
                        "İşin kalitesi/detayı arttı, hata oranı azaldı (Kalite artışı)": { short: "Kalite Artışı", color: "bg-green-500" },
                        "Daha stratejik/yaratıcı projelere vakit ayırabiliyorum (İnovasyon)": { short: "İnovasyon", color: "bg-purple-500" },
                        "İş yüküm azaldı, iş-yaşam dengem iyileşti": { short: "İş-Yaşam Dengesi", color: "bg-teal-500" },
                        "Diğer ekip üyelerine destek oluyorum": { short: "Ekip Desteği", color: "bg-orange-500" },
                        "Henüz belirgin bir değişiklik olmadı": { short: "Değişiklik Yok", color: "bg-gray-500" },
                      }
                      const label = labels[value] || { short: value.substring(0, 20), color: "bg-gray-500" }

                      return (
                        <div key={value} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{label.short}</span>
                            <span className="font-medium">{count} kişi</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${label.color}`}
                              style={{ width: `${(count / aiStats.totalResponses) * 100}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Görev Tanımları */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">AI ile Yapılan Görevler</CardTitle>
                  <CardDescription>Çalışanların belirttiği görev örnekleri</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {aiStats.taskDescriptions.map((task, idx) => (
                      <div key={idx} className="p-2 bg-muted/50 rounded-lg text-sm">
                        {task}
                      </div>
                    ))}
                    {aiStats.taskDescriptions.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">Henüz görev tanımı girilmemiş</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* İçgörüler Tab */}
          <TabsContent value="insights" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stratejik Proje Örnekleri */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Stratejik/Yaratıcı Proje Örnekleri
                  </CardTitle>
                  <CardDescription>AI ile kazanılan zamanla yapılan yaratıcı projeler</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {aiStats.strategicExamples.map((example, idx) => (
                      <div key={idx} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                        {example}
                      </div>
                    ))}
                    {aiStats.strategicExamples.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">Henüz örnek girilmemiş</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Potansiyel AI Kullanım Alanları */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    Potansiyel AI Kullanım Alanları
                  </CardTitle>
                  <CardDescription>Henüz AI kullanılmayan ama fayda sağlayabilecek süreçler</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {aiStats.potentialAreas.map((area, idx) => (
                      <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        {area}
                      </div>
                    ))}
                    {aiStats.potentialAreas.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">Henüz öneri girilmemiş</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* İhtiyaçlar Tab */}
          <TabsContent value="needs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daha Verimli Kullanım İçin İhtiyaçlar</CardTitle>
                <CardDescription>Çalışanların belirttiği destek ihtiyaçları</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {sortedNeeds.map(([need, count]) => {
                    const icons: Record<string, React.ReactNode> = {
                      "Eğitim": <BookOpen className="h-6 w-6" />,
                      "Lisanslı araçlar": <Wrench className="h-6 w-6" />,
                      "Entegrasyon desteği": <Zap className="h-6 w-6" />,
                      "Yasal rehberlik": <FileText className="h-6 w-6" />,
                      "Yönetim desteği / Onay": <CheckCircle2 className="h-6 w-6" />,
                      "Daha fazla zamana ihtiyacım var": <Clock className="h-6 w-6" />,
                    }

                    return (
                      <div key={need} className="p-4 bg-muted/50 rounded-lg text-center">
                        <div className="flex justify-center mb-2 text-purple-600">
                          {icons[need] || <HelpCircle className="h-6 w-6" />}
                        </div>
                        <p className="text-2xl font-bold text-purple-600">{count}</p>
                        <p className="text-sm text-muted-foreground">{need}</p>
                        <p className="text-xs text-muted-foreground">({Math.round((count / aiStats.totalResponses) * 100)}%)</p>
                      </div>
                    )
                  })}
                </div>
                {sortedNeeds.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">Henüz ihtiyaç belirtilmemiş</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Katılımcılar Tab */}
          <TabsContent value="responses" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Katılımcı Listesi</CardTitle>
                <CardDescription>
                  Anketi tamamlayan kişilerin listesi - Detay için satıra tıklayın
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Ad Soyad</TableHead>
                      <TableHead>Departman</TableHead>
                      <TableHead>Tamamlanma Tarihi</TableHead>
                      <TableHead className="w-[80px]">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResponses.map((resp, idx) => (
                      <TableRow
                        key={resp.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openResponseDetail(resp)}
                      >
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {resp.respondentName || <span className="text-muted-foreground">Anonim</span>}
                          </div>
                        </TableCell>
                        <TableCell>{resp.respondentDepartment || <span className="text-muted-foreground">-</span>}</TableCell>
                        <TableCell>
                          {resp.completedAt
                            ? new Date(resp.completedAt).toLocaleString("tr-TR")
                            : new Date(resp.createdAt).toLocaleString("tr-TR")
                          }
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openResponseDetail(resp)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Katılımcı Detay Modal */}
        <Dialog open={responseDetailOpen} onOpenChange={setResponseDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {selectedResponse?.respondentName || "Anonim Katılımcı"}
              </DialogTitle>
              <DialogDescription>
                {selectedResponse?.respondentDepartment && (
                  <Badge variant="outline" className="mr-2">{selectedResponse.respondentDepartment}</Badge>
                )}
                {selectedResponse?.completedAt && (
                  <span className="text-xs">
                    {new Date(selectedResponse.completedAt).toLocaleString("tr-TR")}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {selectedResponse && getResponseAnswers(selectedResponse.id).map(({ question, selectedOptions, textAnswer }) => (
                <div key={question.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {question.sortOrder}
                    </Badge>
                    <p className="text-sm font-medium flex-1">
                      {question.questionText.replace(/^[A-Z]\.\s*[^-]+-\s*\d+\.\s*/, "")}
                    </p>
                  </div>

                  {selectedOptions.length > 0 && (
                    <div className="ml-8 space-y-1">
                      {selectedOptions.map(opt => (
                        <div key={opt.id} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>{opt.optionText}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {textAnswer && (
                    <div className="ml-8 mt-2 p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">{textAnswer}</p>
                    </div>
                  )}

                  {selectedOptions.length === 0 && !textAnswer && (
                    <p className="ml-8 text-sm text-muted-foreground italic">Yanıt verilmedi</p>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // İK Anketi için standart UI
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/surveys")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{survey.title}</h1>
            <p className="text-muted-foreground">{survey.surveyNumber} • Anket Raporu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Departman Seç" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Departmanlar</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept || ""}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV İndir
          </Button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplam Katılım</p>
                <p className="text-3xl font-bold">{stats?.totalResponses || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Olumlu Yanıt</p>
                <p className="text-3xl font-bold text-green-600">{stats?.overallPositive || 0}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Kararsız</p>
                <p className="text-3xl font-bold text-yellow-600">{stats?.overallNeutral || 0}%</p>
              </div>
              <HelpCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Olumsuz Yanıt</p>
                <p className="text-3xl font-bold text-red-600">{stats?.overallNegative || 0}%</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Genel Memnuniyet Skoru
          </CardTitle>
          <CardDescription>
            Olumlu yanıtların genel oranına göre hesaplanır
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Memnuniyet</span>
                <span className="text-sm font-medium">{stats?.engagementScore || 0}%</span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    (stats?.engagementScore || 0) >= 70 ? 'bg-green-500' :
                    (stats?.engagementScore || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${stats?.engagementScore || 0}%` }}
                />
              </div>
            </div>
            <div className="text-center px-4 border-l">
              <p className="text-4xl font-bold">{stats?.engagementScore || 0}</p>
              <p className="text-sm text-muted-foreground">/ 100</p>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>0-49: Düşük</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>50-69: Orta</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>70-100: Yüksek</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Öncelikli Aksiyon Alanları */}
      {stats?.priorityAreas && stats.priorityAreas.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Target className="h-5 w-5" />
              Öncelikli Aksiyon Alanları
            </CardTitle>
            <CardDescription>
              En düşük memnuniyet oranına sahip kategoriler - iyileştirme önceliği olarak değerlendirilebilir
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.priorityAreas.map((area, idx) => (
                <div
                  key={area.name}
                  className={`p-4 rounded-lg border ${
                    idx === 0 ? 'bg-red-50 border-red-200' :
                    idx === 1 ? 'bg-orange-50 border-orange-200' :
                    'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-lg font-bold ${
                      idx === 0 ? 'text-red-600' :
                      idx === 1 ? 'text-orange-600' :
                      'text-yellow-600'
                    }`}>
                      #{idx + 1}
                    </span>
                    <AlertTriangle className={`h-4 w-4 ${
                      idx === 0 ? 'text-red-500' :
                      idx === 1 ? 'text-orange-500' :
                      'text-yellow-500'
                    }`} />
                  </div>
                  <h4 className="font-medium text-sm mb-1">{area.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${
                      idx === 0 ? 'text-red-600' :
                      idx === 1 ? 'text-orange-600' :
                      'text-yellow-600'
                    }`}>
                      {area.positivePercent}%
                    </span>
                    <span className="text-xs text-muted-foreground">olumlu</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {area.questionCount} soru • {area.negativePercent}% olumsuz
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Kategori Analizi
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Soru Detayları
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Departman Karşılaştırma
          </TabsTrigger>
          <TabsTrigger value="responses" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Katılımcılar
          </TabsTrigger>
        </TabsList>

        {/* Kategori Analizi */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats?.categories.map(cat => (
              <Card key={cat.name}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{cat.name}</CardTitle>
                    <Badge variant="outline">{cat.questionCount} soru</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Stacked Bar Chart */}
                  <div className="space-y-2">
                    <div className="flex h-8 rounded-lg overflow-hidden">
                      <div
                        className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${cat.positivePercent}%` }}
                      >
                        {cat.positivePercent > 10 && `${cat.positivePercent}%`}
                      </div>
                      <div
                        className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${cat.neutralPercent}%` }}
                      >
                        {cat.neutralPercent > 10 && `${cat.neutralPercent}%`}
                      </div>
                      <div
                        className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${cat.negativePercent}%` }}
                      >
                        {cat.negativePercent > 10 && `${cat.negativePercent}%`}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Olumlu: {cat.positivePercent}%
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        Kararsız: {cat.neutralPercent}%
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        Olumsuz: {cat.negativePercent}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Soru Detayları */}
        <TabsContent value="questions" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {stats?.categories.map(cat => (
                  <div key={cat.name} className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">{cat.name}</h3>
                    {cat.questions.map((q, idx) => (
                      <div key={q.id} className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm flex-1">{idx + 1}. {q.text}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {q.total} yanıt
                          </span>
                        </div>
                        <div className="flex h-6 rounded overflow-hidden">
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${q.total > 0 ? (q.positive / q.total) * 100 : 0}%` }}
                            title={`Katılıyorum: ${q.positive}`}
                          />
                          <div
                            className="bg-yellow-500 transition-all"
                            style={{ width: `${q.total > 0 ? (q.neutral / q.total) * 100 : 0}%` }}
                            title={`Kararsızım: ${q.neutral}`}
                          />
                          <div
                            className="bg-red-500 transition-all"
                            style={{ width: `${q.total > 0 ? (q.negative / q.total) * 100 : 0}%` }}
                            title={`Katılmıyorum: ${q.negative}`}
                          />
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>✓ {q.positive} ({q.total > 0 ? Math.round((q.positive / q.total) * 100) : 0}%)</span>
                          <span>? {q.neutral} ({q.total > 0 ? Math.round((q.neutral / q.total) * 100) : 0}%)</span>
                          <span>✗ {q.negative} ({q.total > 0 ? Math.round((q.negative / q.total) * 100) : 0}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departman Karşılaştırma */}
        <TabsContent value="departments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Departman Bazlı Memnuniyet</CardTitle>
              <CardDescription>
                Her departmanın olumlu yanıt oranına göre sıralanmış
              </CardDescription>
            </CardHeader>
            <CardContent>
              {departmentComparison.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Departman bilgisi içeren yanıt bulunmuyor
                </p>
              ) : (
                <div className="space-y-4">
                  {departmentComparison.map((dept, idx) => (
                    <div key={dept.department} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-medium w-6">{idx + 1}.</span>
                          <span className="font-medium">{dept.department}</span>
                          <Badge variant="outline" className="ml-2">
                            {dept.responseCount} kişi
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${
                            dept.positivePercent >= 70 ? 'text-green-600' :
                            dept.positivePercent >= 50 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {dept.positivePercent}%
                          </span>
                          {idx === 0 && <TrendingUp className="h-4 w-4 text-green-500" />}
                          {idx === departmentComparison.length - 1 && departmentComparison.length > 1 && (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      <Progress
                        value={dept.positivePercent}
                        className="h-3"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Katılımcılar */}
        <TabsContent value="responses" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Katılımcı Listesi</CardTitle>
              <CardDescription>
                Anketi tamamlayan kişilerin listesi - Detay için satıra tıklayın
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Tamamlanma Tarihi</TableHead>
                    <TableHead className="w-[80px]">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResponses.map((resp, idx) => (
                    <TableRow
                      key={resp.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openResponseDetail(resp)}
                    >
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {resp.respondentName || <span className="text-muted-foreground">Anonim</span>}
                        </div>
                      </TableCell>
                      <TableCell>{resp.respondentDepartment || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>
                        {resp.completedAt
                          ? new Date(resp.completedAt).toLocaleString("tr-TR")
                          : new Date(resp.createdAt).toLocaleString("tr-TR")
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openResponseDetail(resp)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Katılımcı Detay Modal */}
      <Dialog open={responseDetailOpen} onOpenChange={setResponseDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedResponse?.respondentName || "Anonim Katılımcı"}
            </DialogTitle>
            <DialogDescription>
              {selectedResponse?.respondentDepartment && (
                <Badge variant="outline" className="mr-2">{selectedResponse.respondentDepartment}</Badge>
              )}
              {selectedResponse?.completedAt && (
                <span className="text-xs">
                  {new Date(selectedResponse.completedAt).toLocaleString("tr-TR")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {selectedResponse && getResponseAnswers(selectedResponse.id).map(({ question, selectedOptions, textAnswer }) => (
              <div key={question.id} className="border rounded-lg p-4">
                <div className="flex items-start gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {question.sortOrder}
                  </Badge>
                  <p className="text-sm font-medium flex-1">
                    {question.questionText.replace(/^[A-Z]\.\s*[^-]+-\s*\d+\.\s*/, "")}
                  </p>
                </div>

                {selectedOptions.length > 0 && (
                  <div className="ml-8 space-y-1">
                    {selectedOptions.map(opt => (
                      <div key={opt.id} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{opt.optionText}</span>
                      </div>
                    ))}
                  </div>
                )}

                {textAnswer && (
                  <div className="ml-8 mt-2 p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">{textAnswer}</p>
                  </div>
                )}

                {selectedOptions.length === 0 && !textAnswer && (
                  <p className="ml-8 text-sm text-muted-foreground italic">Yanıt verilmedi</p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
