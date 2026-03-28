"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
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
  Plus,
  Loader2,
  ClipboardList,
  Link2,
  Copy,
  Check,
  Eye,
  BarChart3,
  Trash2,
  ExternalLink,
  Users,
  Calendar,
  AlertCircle,
} from "lucide-react"

interface SurveyOption {
  id?: string
  optionText: string
  sortOrder: number
}

interface SurveyQuestion {
  id?: string
  questionText: string
  questionType: string
  isRequired: boolean
  sortOrder: number
  options: SurveyOption[]
}

interface Survey {
  id: string
  surveyNumber: string
  title: string
  description: string | null
  status: string
  isPublic: boolean
  publicSlug: string | null
  isAnonymous: boolean
  requireAllQuestions: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  _count: {
    responses: number
    questions: number
  }
}

interface SurveyResponse {
  id: string
  respondentName: string | null
  respondentDepartment: string | null
  completedAt: string | null
  createdAt: string
}

interface SurveyDetail extends Survey {
  questions: Array<{
    id: string
    questionText: string
    questionType: string
    sortOrder: number
    options: Array<{
      id: string
      optionText: string
    }>
    answers: Array<{
      answerText: string | null
      numericValue: number | null
      optionId: string | null
      response: {
        respondentName: string | null
        respondentDepartment: string | null
      }
    }>
  }>
  responses: SurveyResponse[]
}

const questionTypes = [
  { value: "SINGLE_CHOICE", label: "Tek Secim" },
  { value: "MULTIPLE_CHOICE", label: "Coklu Secim" },
  { value: "TEXT_SHORT", label: "Kisa Metin" },
  { value: "TEXT_LONG", label: "Uzun Metin" },
  { value: "YES_NO", label: "Evet/Hayir" },
  { value: "RATING", label: "Puanlama (1-5)" },
  { value: "SCALE", label: "Olcek (1-10)" },
]

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  ACTIVE: "bg-green-100 text-green-800",
  CLOSED: "bg-red-100 text-red-800",
  ARCHIVED: "bg-blue-100 text-blue-800",
}

const statusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  ACTIVE: "Aktif",
  CLOSED: "Kapali",
  ARCHIVED: "Arsiv",
}

export default function SurveysPage() {
  const { data: session } = useSession()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Yeni anket formu
  const [newSurvey, setNewSurvey] = useState({
    title: "",
    description: "",
    isPublic: true,
    publicSlug: "",
    isAnonymous: false,
    requireAllQuestions: true,
    questions: [] as SurveyQuestion[],
  })

  // Yeni soru
  const [newQuestion, setNewQuestion] = useState<SurveyQuestion>({
    questionText: "",
    questionType: "SINGLE_CHOICE",
    isRequired: true,
    sortOrder: 0,
    options: [],
  })
  const [newOptionText, setNewOptionText] = useState("")

  useEffect(() => {
    fetchSurveys()
  }, [])

  const fetchSurveys = async () => {
    try {
      const res = await fetch("/api/surveys?limit=100")
      if (res.ok) {
        const data = await res.json()
        setSurveys(data.surveys || [])
      }
    } catch (error) {
      console.error("Anketler yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSurveyDetail = async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/surveys/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedSurvey(data)
      }
    } catch (error) {
      console.error("Anket detayi yuklenemedi:", error)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleCreateSurvey = async () => {
    if (!newSurvey.title.trim()) return
    if (newSurvey.questions.length === 0) {
      alert("En az bir soru eklemelisiniz.")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSurvey),
      })

      if (res.ok) {
        setShowCreateDialog(false)
        setNewSurvey({
          title: "",
          description: "",
          isPublic: true,
          publicSlug: "",
          isAnonymous: false,
          requireAllQuestions: true,
          questions: [],
        })
        fetchSurveys()
      } else {
        const data = await res.json()
        alert(data.error || "Anket olusturulamadi.")
      }
    } catch (error) {
      console.error("Anket olusturma hatasi:", error)
    } finally {
      setCreating(false)
    }
  }

  const handleActivateSurvey = async (id: string) => {
    try {
      const res = await fetch(`/api/surveys/${id}/activate`, { method: "POST" })
      if (res.ok) {
        fetchSurveys()
      }
    } catch (error) {
      console.error("Anket aktif edilemedi:", error)
    }
  }

  const handleCloseSurvey = async (id: string) => {
    try {
      const res = await fetch(`/api/surveys/${id}/close`, { method: "POST" })
      if (res.ok) {
        fetchSurveys()
      }
    } catch (error) {
      console.error("Anket kapatilamadi:", error)
    }
  }

  const addQuestion = () => {
    if (!newQuestion.questionText.trim()) return

    const needsOptions = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(newQuestion.questionType)
    if (needsOptions && newQuestion.options.length < 2) {
      alert("Secimli sorular icin en az 2 secenek eklemelisiniz.")
      return
    }

    setNewSurvey(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        { ...newQuestion, sortOrder: prev.questions.length }
      ]
    }))

    setNewQuestion({
      questionText: "",
      questionType: "SINGLE_CHOICE",
      isRequired: true,
      sortOrder: 0,
      options: [],
    })
  }

  const addOption = () => {
    if (!newOptionText.trim()) return
    setNewQuestion(prev => ({
      ...prev,
      options: [
        ...prev.options,
        { optionText: newOptionText.trim(), sortOrder: prev.options.length }
      ]
    }))
    setNewOptionText("")
  }

  const removeOption = (index: number) => {
    setNewQuestion(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }))
  }

  const removeQuestion = (index: number) => {
    setNewSurvey(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }))
  }

  const copyPublicLink = async (surveyId: string) => {
    const link = `http://hub.ilerigroup.com/survey/${surveyId}`

    try {
      // Modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link)
      } else {
        // Fallback for non-HTTPS environments
        const textArea = document.createElement('textarea')
        textArea.value = link
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }

      setCopiedSlug(surveyId)
      toast.success('Link kopyalandı!', {
        description: link
      })
      setTimeout(() => setCopiedSlug(null), 2000)
    } catch (err) {
      console.error('Kopyalama hatası:', err)
      toast.error('Link kopyalanamadı', {
        description: 'Lütfen manuel olarak kopyalayın: ' + link
      })
    }
  }

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50)
  }

  // Rol kontrolu
  const userRole = session?.user?.role || "USER"
  const userDepartment = session?.user?.department || ""
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr", "ik"]
  const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept.toLowerCase()))
  const canManage = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"].includes(userRole) || isHrDepartment

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <span>Bu sayfaya erisim yetkiniz bulunmamaktadir.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Anket Yonetimi</h1>
          <p className="text-muted-foreground">Public anketler olusturun ve sonuclari goruntuley</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Anket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Yeni Anket Olustur</DialogTitle>
              <DialogDescription>
                Login gerektirmeyen public anket olusturun
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Temel Bilgiler */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Anket Basligi *</Label>
                  <Input
                    value={newSurvey.title}
                    onChange={(e) => {
                      setNewSurvey(prev => ({
                        ...prev,
                        title: e.target.value,
                        publicSlug: prev.publicSlug || generateSlug(e.target.value)
                      }))
                    }}
                    placeholder="Ornek: Calisan Memnuniyet Anketi 2025"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Aciklama</Label>
                  <Textarea
                    value={newSurvey.description}
                    onChange={(e) => setNewSurvey(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Anket hakkinda kisa bir aciklama..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Public Link (URL)</Label>
                  <div className="flex gap-2">
                    <span className="flex items-center text-sm text-muted-foreground">/anket/</span>
                    <Input
                      value={newSurvey.publicSlug}
                      onChange={(e) => setNewSurvey(prev => ({ ...prev, publicSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                      placeholder="mavi-yaka-anketi-2025"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Tum Sorular Zorunlu</Label>
                    <p className="text-sm text-muted-foreground">Katilimcilar tum sorulari cevaplamak zorunda</p>
                  </div>
                  <Switch
                    checked={newSurvey.requireAllQuestions}
                    onCheckedChange={(checked) => setNewSurvey(prev => ({ ...prev, requireAllQuestions: checked }))}
                  />
                </div>
              </div>

              {/* Sorular */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-4">Sorular ({newSurvey.questions.length})</h3>

                {/* Eklenen Sorular */}
                {newSurvey.questions.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {newSurvey.questions.map((q, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <span className="font-medium">{idx + 1}. {q.questionText}</span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            ({questionTypes.find(t => t.value === q.questionType)?.label})
                          </span>
                          {q.options.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Secenekler: {q.options.map(o => o.optionText).join(", ")}
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeQuestion(idx)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Yeni Soru Ekleme */}
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Soru Metni</Label>
                        <Input
                          value={newQuestion.questionText}
                          onChange={(e) => setNewQuestion(prev => ({ ...prev, questionText: e.target.value }))}
                          placeholder="Sorunuzu yazin..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Soru Tipi</Label>
                        <Select
                          value={newQuestion.questionType}
                          onValueChange={(value) => setNewQuestion(prev => ({ ...prev, questionType: value, options: [] }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {questionTypes.map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Secenekler (Secimli sorular icin) */}
                    {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(newQuestion.questionType) && (
                      <div className="space-y-2">
                        <Label>Secenekler</Label>
                        <div className="flex gap-2">
                          <Input
                            value={newOptionText}
                            onChange={(e) => setNewOptionText(e.target.value)}
                            placeholder="Secenek ekle..."
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
                          />
                          <Button type="button" variant="outline" onClick={addOption}>Ekle</Button>
                        </div>
                        {newQuestion.options.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {newQuestion.options.map((opt, idx) => (
                              <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeOption(idx)}>
                                {opt.optionText} ×
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Soruyu Ekle
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Iptal</Button>
              <Button onClick={handleCreateSurvey} disabled={creating || !newSurvey.title || newSurvey.questions.length === 0}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Anketi Olustur (Taslak)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Anket Listesi */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : surveys.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">Henuz anket yok</h3>
              <p className="text-muted-foreground">Yeni bir anket olusturarak baslayın</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">Tumu ({surveys.length})</TabsTrigger>
            <TabsTrigger value="active">Aktif ({surveys.filter(s => s.status === "ACTIVE").length})</TabsTrigger>
            <TabsTrigger value="draft">Taslak ({surveys.filter(s => s.status === "DRAFT").length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <SurveyTable
              surveys={surveys}
              onActivate={handleActivateSurvey}
              onClose={handleCloseSurvey}
              onCopyLink={copyPublicLink}
              copiedSlug={copiedSlug}
              onViewDetail={fetchSurveyDetail}
            />
          </TabsContent>
          <TabsContent value="active" className="mt-4">
            <SurveyTable
              surveys={surveys.filter(s => s.status === "ACTIVE")}
              onActivate={handleActivateSurvey}
              onClose={handleCloseSurvey}
              onCopyLink={copyPublicLink}
              copiedSlug={copiedSlug}
              onViewDetail={fetchSurveyDetail}
            />
          </TabsContent>
          <TabsContent value="draft" className="mt-4">
            <SurveyTable
              surveys={surveys.filter(s => s.status === "DRAFT")}
              onActivate={handleActivateSurvey}
              onClose={handleCloseSurvey}
              onCopyLink={copyPublicLink}
              copiedSlug={copiedSlug}
              onViewDetail={fetchSurveyDetail}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Anket Detay Dialog */}
      <Dialog open={!!selectedSurvey} onOpenChange={() => setSelectedSurvey(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : selectedSurvey && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedSurvey.title}</DialogTitle>
                <DialogDescription>
                  {selectedSurvey._count.responses} yanit | {selectedSurvey._count.questions} soru
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="responses">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="responses">Yanitlar ({selectedSurvey.responses.length})</TabsTrigger>
                  <TabsTrigger value="stats">Istatistikler</TabsTrigger>
                </TabsList>

                <TabsContent value="responses" className="mt-4">
                  {selectedSurvey.responses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Henuz yanit yok</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ad Soyad</TableHead>
                          <TableHead>Departman</TableHead>
                          <TableHead>Tarih</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSurvey.responses.map(resp => (
                          <TableRow key={resp.id}>
                            <TableCell>{resp.respondentName || "Anonim"}</TableCell>
                            <TableCell>{resp.respondentDepartment || "-"}</TableCell>
                            <TableCell>{new Date(resp.createdAt).toLocaleString("tr-TR")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="stats" className="mt-4">
                  <div className="space-y-6">
                    {selectedSurvey.questions.map((question, idx) => (
                      <Card key={question.id}>
                        <CardHeader>
                          <CardTitle className="text-base">{idx + 1}. {question.questionText}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {["SINGLE_CHOICE", "MULTIPLE_CHOICE", "YES_NO"].includes(question.questionType) ? (
                            <div className="space-y-2">
                              {question.questionType === "YES_NO" ? (
                                <>
                                  {["yes", "no"].map(val => {
                                    const count = question.answers.filter(a => a.answerText === val).length
                                    const percent = selectedSurvey.responses.length > 0
                                      ? Math.round((count / selectedSurvey.responses.length) * 100)
                                      : 0
                                    return (
                                      <div key={val} className="flex items-center gap-2">
                                        <span className="w-20">{val === "yes" ? "Evet" : "Hayir"}</span>
                                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                          <div
                                            className="bg-primary h-full"
                                            style={{ width: `${percent}%` }}
                                          />
                                        </div>
                                        <span className="w-16 text-right text-sm">{count} (%{percent})</span>
                                      </div>
                                    )
                                  })}
                                </>
                              ) : (
                                question.options.map(opt => {
                                  const count = question.answers.filter(a => a.optionId === opt.id).length
                                  const percent = selectedSurvey.responses.length > 0
                                    ? Math.round((count / selectedSurvey.responses.length) * 100)
                                    : 0
                                  return (
                                    <div key={opt.id} className="flex items-center gap-2">
                                      <span className="w-32 truncate">{opt.optionText}</span>
                                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                        <div
                                          className="bg-primary h-full"
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                      <span className="w-16 text-right text-sm">{count} (%{percent})</span>
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          ) : ["RATING", "SCALE"].includes(question.questionType) ? (
                            <div>
                              <p className="text-2xl font-bold">
                                {question.answers.length > 0
                                  ? (question.answers.reduce((sum, a) => sum + (a.numericValue || 0), 0) / question.answers.length).toFixed(1)
                                  : "-"
                                }
                              </p>
                              <p className="text-sm text-muted-foreground">Ortalama puan</p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {question.answers.map((a, i) => (
                                <p key={i} className="text-sm p-2 bg-muted rounded">
                                  {a.answerText || "-"}
                                </p>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SurveyTable({
  surveys,
  onActivate,
  onClose,
  onCopyLink,
  copiedSlug,
  onViewDetail
}: {
  surveys: Survey[]
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onCopyLink: (slug: string) => void
  copiedSlug: string | null
  onViewDetail: (id: string) => void
}) {
  return (
    <Card>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Anket</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Yanitlar</TableHead>
            <TableHead>Public Link</TableHead>
            <TableHead>Olusturma</TableHead>
            <TableHead className="text-right">Islemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {surveys.map(survey => (
            <TableRow
              key={survey.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => window.location.href = `/surveys/${survey.id}/results`}
            >
              <TableCell>
                <div>
                  <p className="font-medium">{survey.title}</p>
                  <p className="text-sm text-muted-foreground">{survey.surveyNumber}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={statusColors[survey.status]}>
                  {statusLabels[survey.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{survey._count.responses}</span>
                </div>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {survey.status === "ACTIVE" ? (
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">/survey/{survey.id}</code>
                    <Button variant="ghost" size="sm" onClick={() => onCopyLink(survey.id)}>
                      {copiedSlug === survey.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(survey.createdAt).toLocaleDateString("tr-TR")}
                </div>
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`/surveys/${survey.id}/results`}>
                      <BarChart3 className="h-4 w-4" />
                    </a>
                  </Button>
                  {survey.status === "ACTIVE" && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/survey/${survey.id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {survey.status === "DRAFT" && (
                    <Button variant="outline" size="sm" onClick={() => onActivate(survey.id)}>
                      Aktif Et
                    </Button>
                  )}
                  {survey.status === "ACTIVE" && (
                    <Button variant="outline" size="sm" onClick={() => onClose(survey.id)}>
                      Kapat
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </Card>
  )
}
