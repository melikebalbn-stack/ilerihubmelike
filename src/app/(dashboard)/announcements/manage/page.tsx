"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Send,
  Save,
  Pin,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  ClipboardList,
  Megaphone,
  GripVertical,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { toast } from "sonner"

interface Category {
  id: string
  name: string
  color: string | null
  icon: string | null
}

interface Survey {
  id: string
  surveyNumber: string
  title: string
  description: string | null
  surveyType: string
  status: string
  isAnonymous: boolean
  startsAt: string | null
  endsAt: string | null
  _count: {
    questions: number
    responses: number
  }
}

interface SurveyQuestion {
  id?: string
  questionText: string
  questionType: string
  isRequired: boolean
  options: string[]
}

const questionTypes = [
  { value: "SINGLE_CHOICE", label: "Tek Seçim" },
  { value: "MULTIPLE_CHOICE", label: "Çoklu Seçim" },
  { value: "TEXT_SHORT", label: "Kısa Metin" },
  { value: "TEXT_LONG", label: "Uzun Metin" },
  { value: "RATING", label: "Puanlama (1-5)" },
  { value: "SCALE", label: "Ölçek (1-10)" },
  { value: "YES_NO", label: "Evet/Hayır" },
  { value: "DROPDOWN", label: "Açılır Liste" },
  { value: "DATE", label: "Tarih" },
]

const surveyStatusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Taslak", color: "bg-gray-100 text-gray-800" },
  ACTIVE: { label: "Aktif", color: "bg-green-100 text-green-800" },
  CLOSED: { label: "Kapali", color: "bg-red-100 text-red-800" },
  ARCHIVED: { label: "Arsivlenmis", color: "bg-slate-100 text-slate-800" }
}

interface Announcement {
  id: string
  title: string
  status: string
  priority: string
  isPinned: boolean
  publishedAt: string | null
  createdAt: string
  viewCount: number
  _count: {
    reads: number
    comments: number
    reactions: number
  }
}

interface Department {
  id: string
  name: string
}

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Taslak", color: "bg-gray-100 text-gray-800" },
  SCHEDULED: { label: "Zamanlanmis", color: "bg-yellow-100 text-yellow-800" },
  PUBLISHED: { label: "Yayinda", color: "bg-green-100 text-green-800" },
  ARCHIVED: { label: "Arsivlenmis", color: "bg-slate-100 text-slate-800" }
}

export default function AnnouncementManagePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("list")
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    id: "",
    title: "",
    summary: "",
    content: "",
    categoryId: "",
    priority: "NORMAL",
    targetType: "ALL",
    targetDepartments: [] as string[],
    targetRoles: [] as string[],
    isPinned: false,
    publishAt: "",
    expiresAt: "",
    allowComments: true,
    allowReactions: true,
    requireAcknowledgment: false,
    surveyId: "",
    status: "DRAFT"
  })

  // Category form
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    description: "",
    color: "#3b82f6",
    icon: ""
  })

  // Survey form
  const [surveyForm, setSurveyForm] = useState({
    id: "",
    title: "",
    description: "",
    surveyType: "POLL",
    isAnonymous: false,
    startsAt: "",
    endsAt: "",
    status: "DRAFT"
  })
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([])
  const [savingSurvey, setSavingSurvey] = useState(false)
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null)

  const userEmail = session?.user?.email?.toLowerCase() || ""
  const userRole = session?.user?.role || "EMPLOYEE"
  const isAdmin = userEmail === "melih.dilben@ilerigroup.com" ||
                  userRole === "ADMIN" ||
                  userRole === "SUPER_ADMIN"

  useEffect(() => {
    // Session yüklenene kadar bekle
    if (session === undefined) return

    // Session yüklendi ama kullanıcı yok veya admin değil
    if (session === null || !isAdmin) {
      router.push("/announcements")
      return
    }

    fetchData()
  }, [session, isAdmin, router])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [announcementsRes, categoriesRes, surveysRes, departmentsRes] = await Promise.all([
        fetch("/api/announcements?limit=100"),
        fetch("/api/announcements/categories"),
        fetch("/api/surveys?limit=50"),
        fetch("/api/departments")
      ])

      if (announcementsRes.ok) {
        const data = await announcementsRes.json()
        setAnnouncements(data.announcements || [])
      }
      if (categoriesRes.ok) {
        setCategories(await categoriesRes.json())
      }
      if (surveysRes.ok) {
        const data = await surveysRes.json()
        setSurveys(data.surveys || [])
      }
      if (departmentsRes.ok) {
        setDepartments(await departmentsRes.json())
      }
    } catch (error) {
      console.error("Veri yüklenirken hata:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (publishNow = false) => {
    // Validasyon
    if (!formData.title.trim()) {
      toast.error("Baslik zorunludur")
      return
    }
    if (!formData.content.trim()) {
      toast.error("Icerik zorunludur")
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...formData,
        status: publishNow ? "PUBLISHED" : (formData.status || "DRAFT")
      }

      const url = formData.id
        ? `/api/announcements/${formData.id}`
        : "/api/announcements"
      const method = formData.id ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        toast.success(publishNow ? "Duyuru yayinlandi" : "Duyuru kaydedildi")
        resetForm()
        fetchData()
        setActiveTab("list")
      } else {
        const errorData = await res.json()
        toast.error(errorData.error || "Duyuru kaydedilemedi")
        console.error("API Error:", errorData)
      }
    } catch (error) {
      console.error("Duyuru kaydedilirken hata:", error)
      toast.error("Duyuru kaydedilirken bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (announcement: Announcement) => {
    // Fetch full announcement data
    fetch(`/api/announcements/${announcement.id}`)
      .then(res => res.json())
      .then(data => {
        setFormData({
          id: data.id,
          title: data.title || "",
          summary: data.summary || "",
          content: data.content || "",
          categoryId: data.categoryId || "",
          priority: data.priority || "NORMAL",
          targetType: data.targetType || "ALL",
          targetDepartments: data.targetDepartments || [],
          targetRoles: data.targetRoles || [],
          isPinned: data.isPinned || false,
          publishAt: data.publishAt ? new Date(data.publishAt).toISOString().slice(0, 16) : "",
          expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString().slice(0, 16) : "",
          allowComments: data.allowComments ?? true,
          allowReactions: data.allowReactions ?? true,
          requireAcknowledgment: data.requireAcknowledgment || false,
          surveyId: data.surveyId || "",
          status: data.status || "DRAFT"
        })
        setActiveTab("create")
      })
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Bu duyuruyu silmek istediginize emin misiniz?")) return

    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "DELETE"
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error("Duyuru silinirken hata:", error)
    }
  }

  const resetForm = () => {
    setFormData({
      id: "",
      title: "",
      summary: "",
      content: "",
      categoryId: "",
      priority: "NORMAL",
      targetType: "ALL",
      targetDepartments: [],
      targetRoles: [],
      isPinned: false,
      publishAt: "",
      expiresAt: "",
      allowComments: true,
      allowReactions: true,
      requireAcknowledgment: false,
      surveyId: "",
      status: "DRAFT"
    })
  }

  const handleSaveCategory = async () => {
    try {
      const method = categoryForm.id ? "PUT" : "POST"
      const res = await fetch("/api/announcements/categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm)
      })

      if (res.ok) {
        setCategoryDialog(false)
        setCategoryForm({ id: "", name: "", description: "", color: "#3b82f6", icon: "" })
        fetchData()
      }
    } catch (error) {
      console.error("Kategori kaydedilirken hata:", error)
    }
  }

  // Survey functions
  const addQuestion = () => {
    setSurveyQuestions([
      ...surveyQuestions,
      {
        questionText: "",
        questionType: "SINGLE_CHOICE",
        isRequired: true,
        options: [""]
      }
    ])
    setExpandedQuestion(surveyQuestions.length)
  }

  const updateQuestion = (index: number, field: keyof SurveyQuestion, value: unknown) => {
    const updated = [...surveyQuestions]
    updated[index] = { ...updated[index], [field]: value }
    setSurveyQuestions(updated)
  }

  const removeQuestion = (index: number) => {
    setSurveyQuestions(surveyQuestions.filter((_, i) => i !== index))
    setExpandedQuestion(null)
  }

  const addOption = (questionIndex: number) => {
    const updated = [...surveyQuestions]
    updated[questionIndex].options.push("")
    setSurveyQuestions(updated)
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...surveyQuestions]
    updated[questionIndex].options[optionIndex] = value
    setSurveyQuestions(updated)
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...surveyQuestions]
    updated[questionIndex].options = updated[questionIndex].options.filter((_, i) => i !== optionIndex)
    setSurveyQuestions(updated)
  }

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= surveyQuestions.length) return

    const updated = [...surveyQuestions]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setSurveyQuestions(updated)
    setExpandedQuestion(newIndex)
  }

  const resetSurveyForm = () => {
    setSurveyForm({
      id: "",
      title: "",
      description: "",
      surveyType: "POLL",
      isAnonymous: false,
      startsAt: "",
      endsAt: "",
      status: "DRAFT"
    })
    setSurveyQuestions([])
    setExpandedQuestion(null)
  }

  const handleSaveSurvey = async (activate = false) => {
    if (!surveyForm.title) {
      toast.error("Anket basligi zorunludur")
      return
    }
    if (surveyQuestions.length === 0) {
      toast.error("En az bir soru eklemelisiniz")
      return
    }

    // Seçenek gerektiren soru tipleri
    const optionRequiredTypes = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "DROPDOWN"]

    // Validate questions
    for (let i = 0; i < surveyQuestions.length; i++) {
      const q = surveyQuestions[i]
      if (!q.questionText.trim()) {
        toast.error(`Soru ${i + 1}: Soru metni boş olamaz`)
        setExpandedQuestion(i)
        return
      }
      if (optionRequiredTypes.includes(q.questionType)) {
        const validOptions = q.options.filter(o => o.trim())
        if (validOptions.length < 2) {
          toast.error(`Soru ${i + 1}: En az 2 seçenek eklemelisiniz`)
          setExpandedQuestion(i)
          return
        }
      }
    }

    setSavingSurvey(true)
    try {
      const payload = {
        ...surveyForm,
        status: activate ? "ACTIVE" : surveyForm.status,
        questions: surveyQuestions.map(q => ({
          questionText: q.questionText,
          questionType: q.questionType,
          isRequired: q.isRequired,
          options: optionRequiredTypes.includes(q.questionType)
            ? q.options.filter(o => o.trim()).map(o => ({ optionText: o }))
            : []
        }))
      }

      const url = surveyForm.id ? `/api/surveys/${surveyForm.id}` : "/api/surveys"
      const method = surveyForm.id ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        toast.success(surveyForm.id ? "Anket guncellendi" : "Anket olusturuldu")
        resetSurveyForm()
        fetchData()
        setActiveTab("surveys")
      } else {
        const error = await res.json()
        toast.error(error.error || "Anket kaydedilemedi")
      }
    } catch (error) {
      console.error("Anket kaydedilirken hata:", error)
      toast.error("Anket kaydedilirken hata olustu")
    } finally {
      setSavingSurvey(false)
    }
  }

  const handleDeleteSurvey = async (id: string) => {
    if (!confirm("Bu anketi silmek istediginize emin misiniz?")) return

    try {
      const res = await fetch(`/api/surveys/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Anket silindi")
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || "Anket silinemedi")
      }
    } catch (error) {
      console.error("Anket silinirken hata:", error)
      toast.error("Anket silinirken hata olustu")
    }
  }

  const handleEditSurvey = async (survey: Survey) => {
    // Full survey data'yı çek
    try {
      const res = await fetch(`/api/surveys/${survey.id}`)
      if (res.ok) {
        const data = await res.json()
        setSurveyForm({
          id: data.id,
          title: data.title || "",
          description: data.description || "",
          surveyType: data.surveyType || "POLL",
          isAnonymous: data.isAnonymous || false,
          startsAt: data.startsAt ? new Date(data.startsAt).toISOString().slice(0, 16) : "",
          endsAt: data.endsAt ? new Date(data.endsAt).toISOString().slice(0, 16) : "",
          status: data.status || "DRAFT"
        })
        setSurveyQuestions(
          (data.questions || []).map((q: { id: string; questionText: string; questionType: string; isRequired: boolean; options: { optionText: string }[] }) => ({
            id: q.id,
            questionText: q.questionText,
            questionType: q.questionType,
            isRequired: q.isRequired,
            options: q.options?.map((o: { optionText: string }) => o.optionText) || []
          }))
        )
        setActiveTab("create-survey")
      }
    } catch (error) {
      console.error("Anket yüklenirken hata:", error)
      toast.error("Anket yüklenemedi")
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })
  }

  // Session veya veri yüklenene kadar spinner göster
  if (session === undefined || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="classic-spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/announcements">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Duyuru Yonetimi</h1>
            <p className="text-sm text-muted-foreground">
              Duyurulari ve kategorileri yonetin
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="list">
            <Megaphone className="h-4 w-4 mr-2" />
            Duyurular
          </TabsTrigger>
          <TabsTrigger value="create">
            <Plus className="h-4 w-4 mr-2" />
            {formData.id ? "Duzenle" : "Yeni Duyuru"}
          </TabsTrigger>
          <TabsTrigger value="categories">
            <BarChart3 className="h-4 w-4 mr-2" />
            Kategoriler
          </TabsTrigger>
          <TabsTrigger value="surveys">
            <ClipboardList className="h-4 w-4 mr-2" />
            Anketler
          </TabsTrigger>
          <TabsTrigger value="create-survey">
            <Plus className="h-4 w-4 mr-2" />
            {surveyForm.id ? "Anket Duzenle" : "Yeni Anket"}
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Baslik</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Oncelik</TableHead>
                    <TableHead>Yayin Tarihi</TableHead>
                    <TableHead className="text-center">Goruntulenme</TableHead>
                    <TableHead className="text-right">Islemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {announcement.isPinned && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium">{announcement.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusLabels[announcement.status]?.color}>
                          {statusLabels[announcement.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{announcement.priority}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(announcement.publishedAt)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Eye className="h-4 w-4" />
                          {announcement.viewCount}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(announcement)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(announcement.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {announcements.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  Henuz duyuru olusturulmamis
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create/Edit Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {formData.id ? "Duyuru Duzenle" : "Yeni Duyuru Olustur"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="title">Baslik *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Duyuru basligi"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="summary">Ozet</Label>
                  <Textarea
                    id="summary"
                    value={formData.summary}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    placeholder="Kisa ozet (liste gorunumunde gorunur)"
                    rows={2}
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="content">Icerik *</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Duyuru icerigi (HTML destekler)"
                    rows={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryId">Kategori</Label>
                  <Select
                    value={formData.categoryId || "none"}
                    onValueChange={(v) => setFormData({ ...formData, categoryId: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori secin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kategori Yok</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Oncelik</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Dusuk</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="HIGH">Yuksek</SelectItem>
                      <SelectItem value="URGENT">Acil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-4">
                <h3 className="font-semibold">Hedef Kitle</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Hedef Tipi</Label>
                    <Select
                      value={formData.targetType}
                      onValueChange={(v) => setFormData({ ...formData, targetType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Herkes</SelectItem>
                        <SelectItem value="DEPARTMENTS">Belirli Departmanlar</SelectItem>
                        <SelectItem value="ROLES">Belirli Roller</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.targetType === "DEPARTMENTS" && (
                    <div className="md:col-span-2 space-y-2">
                      <Label>Departmanlar</Label>
                      <div className="flex flex-wrap gap-2">
                        {departments.map((dept) => (
                          <Badge
                            key={dept.id}
                            variant={formData.targetDepartments.includes(dept.name) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              const current = formData.targetDepartments
                              if (current.includes(dept.name)) {
                                setFormData({
                                  ...formData,
                                  targetDepartments: current.filter(d => d !== dept.name)
                                })
                              } else {
                                setFormData({
                                  ...formData,
                                  targetDepartments: [...current, dept.name]
                                })
                              }
                            }}
                          >
                            {dept.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.targetType === "ROLES" && (
                    <div className="md:col-span-2 space-y-2">
                      <Label>Roller</Label>
                      <div className="flex flex-wrap gap-2">
                        {["ADMIN", "HR_MANAGER", "QUALITY_MANAGER", "IT_MANAGER", "DEPT_HEAD", "SUPERVISOR", "EMPLOYEE"].map((role) => (
                          <Badge
                            key={role}
                            variant={formData.targetRoles.includes(role) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              const current = formData.targetRoles
                              if (current.includes(role)) {
                                setFormData({
                                  ...formData,
                                  targetRoles: current.filter(r => r !== role)
                                })
                              } else {
                                setFormData({
                                  ...formData,
                                  targetRoles: [...current, role]
                                })
                              }
                            }}
                          >
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Timing */}
              <div className="space-y-4">
                <h3 className="font-semibold">Zamanlama</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="publishAt">Yayin Zamani</Label>
                    <Input
                      id="publishAt"
                      type="datetime-local"
                      value={formData.publishAt}
                      onChange={(e) => setFormData({ ...formData, publishAt: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Bos birakirsaniz hemen yayinlanir
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiresAt">Gecerlilik Bitis</Label>
                    <Input
                      id="expiresAt"
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Bos birakirsaniz suresi dolmaz
                    </p>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-4">
                <h3 className="font-semibold">Secenekler</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="isPinned">Sabitle</Label>
                    <Switch
                      id="isPinned"
                      checked={formData.isPinned}
                      onCheckedChange={(v) => setFormData({ ...formData, isPinned: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="requireAcknowledgment">Okundu Onayi Gerekli</Label>
                    <Switch
                      id="requireAcknowledgment"
                      checked={formData.requireAcknowledgment}
                      onCheckedChange={(v) => setFormData({ ...formData, requireAcknowledgment: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allowComments">Yorumlara Izin Ver</Label>
                    <Switch
                      id="allowComments"
                      checked={formData.allowComments}
                      onCheckedChange={(v) => setFormData({ ...formData, allowComments: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allowReactions">Tepkilere Izin Ver</Label>
                    <Switch
                      id="allowReactions"
                      checked={formData.allowReactions}
                      onCheckedChange={(v) => setFormData({ ...formData, allowReactions: v })}
                    />
                  </div>
                </div>
              </div>

              {/* Survey */}
              <div className="space-y-4">
                <h3 className="font-semibold">Iliskili Anket</h3>
                <Select
                  value={formData.surveyId || "none"}
                  onValueChange={(v) => setFormData({ ...formData, surveyId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Anket secin (opsiyonel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Anket Yok</SelectItem>
                    {surveys
                      .filter(s => s.status === "ACTIVE" || s.status === "DRAFT")
                      .map((survey) => (
                        <SelectItem key={survey.id} value={survey.id}>
                          {survey.title} ({survey._count.questions} soru)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={resetForm}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Iptal
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSubmit(false)}
                    disabled={saving || !formData.title || !formData.content}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Taslak Kaydet
                  </Button>
                  <Button
                    onClick={() => handleSubmit(true)}
                    disabled={saving || !formData.title || !formData.content}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {saving ? "Kaydediliyor..." : "Yayinla"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Kategoriler</CardTitle>
              <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Kategori
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {categoryForm.id ? "Kategori Duzenle" : "Yeni Kategori"}
                    </DialogTitle>
                    <DialogDescription>
                      Duyuru kategorisi olusturun veya duzenleyin
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="catName">Kategori Adi</Label>
                      <Input
                        id="catName"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        placeholder="ornegin: Duyuru, Haber, Etkinlik"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="catDesc">Aciklama</Label>
                      <Input
                        id="catDesc"
                        value={categoryForm.description}
                        onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                        placeholder="Kategori aciklamasi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="catColor">Renk</Label>
                      <div className="flex gap-2">
                        <Input
                          id="catColor"
                          type="color"
                          value={categoryForm.color}
                          onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                          className="w-16 h-10 p-1"
                        />
                        <Input
                          value={categoryForm.color}
                          onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                          placeholder="#3b82f6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCategoryDialog(false)}>
                      Iptal
                    </Button>
                    <Button onClick={handleSaveCategory} disabled={!categoryForm.name}>
                      Kaydet
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <Card key={category.id} className="relative">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: category.color || "#gray" }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCategoryForm({
                              id: category.id,
                              name: category.name,
                              description: "",
                              color: category.color || "#3b82f6",
                              icon: category.icon || ""
                            })
                            setCategoryDialog(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {categories.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    Henuz kategori olusturulmamis
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Surveys Tab */}
        <TabsContent value="surveys" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Anketler</CardTitle>
              <Button size="sm" onClick={() => { resetSurveyForm(); setActiveTab("create-survey") }}>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Anket
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anket No</TableHead>
                    <TableHead>Baslik</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-center">Sorular</TableHead>
                    <TableHead className="text-center">Yanitlar</TableHead>
                    <TableHead className="text-right">Islemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {surveys.map((survey) => (
                    <TableRow key={survey.id}>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {survey.surveyNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{survey.title}</span>
                          {survey.isAnonymous && (
                            <Badge variant="outline" className="ml-2 text-xs">Anonim</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {survey.surveyType === "POLL" ? "Oylama" :
                           survey.surveyType === "FEEDBACK" ? "Geri Bildirim" : "Anket"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={surveyStatusLabels[survey.status]?.color}>
                          {surveyStatusLabels[survey.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{survey._count.questions}</TableCell>
                      <TableCell className="text-center">{survey._count.responses}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditSurvey(survey)}
                            disabled={survey._count.responses > 0}
                            title={survey._count.responses > 0 ? "Yanitlanmis anketler duzenlenemez" : "Duzenle"}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSurvey(survey.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {surveys.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Henuz anket olusturulmamis</p>
                  <Button
                    variant="link"
                    onClick={() => { resetSurveyForm(); setActiveTab("create-survey") }}
                  >
                    Ilk anketi olustur
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create/Edit Survey Tab */}
        <TabsContent value="create-survey" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {surveyForm.id ? "Anket Duzenle" : "Yeni Anket Olustur"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="surveyTitle">Anket Basligi *</Label>
                  <Input
                    id="surveyTitle"
                    value={surveyForm.title}
                    onChange={(e) => setSurveyForm({ ...surveyForm, title: e.target.value })}
                    placeholder="ornegin: Calisan Memnuniyeti Anketi"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="surveyDescription">Aciklama</Label>
                  <Textarea
                    id="surveyDescription"
                    value={surveyForm.description}
                    onChange={(e) => setSurveyForm({ ...surveyForm, description: e.target.value })}
                    placeholder="Anket hakkinda kisa aciklama"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Anket Tipi</Label>
                  <Select
                    value={surveyForm.surveyType}
                    onValueChange={(v) => setSurveyForm({ ...surveyForm, surveyType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POLL">Oylama (Hizli anket)</SelectItem>
                      <SelectItem value="FEEDBACK">Geri Bildirim</SelectItem>
                      <SelectItem value="QUESTIONNAIRE">Anket (Detayli)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="isAnonymous">Anonim Anket</Label>
                  <Switch
                    id="isAnonymous"
                    checked={surveyForm.isAnonymous}
                    onCheckedChange={(v) => setSurveyForm({ ...surveyForm, isAnonymous: v })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startsAt">Baslangic Tarihi</Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={surveyForm.startsAt}
                    onChange={(e) => setSurveyForm({ ...surveyForm, startsAt: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endsAt">Bitis Tarihi</Label>
                  <Input
                    id="endsAt"
                    type="datetime-local"
                    value={surveyForm.endsAt}
                    onChange={(e) => setSurveyForm({ ...surveyForm, endsAt: e.target.value })}
                  />
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Sorular ({surveyQuestions.length})</h3>
                  <Button size="sm" onClick={addQuestion}>
                    <Plus className="h-4 w-4 mr-2" />
                    Soru Ekle
                  </Button>
                </div>

                {surveyQuestions.length === 0 ? (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Henuz soru eklenmemis</p>
                    <Button variant="link" onClick={addQuestion}>
                      Ilk soruyu ekle
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {surveyQuestions.map((question, qIndex) => (
                      <Card key={qIndex} className="border">
                        <CardHeader
                          className="py-3 cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedQuestion(expandedQuestion === qIndex ? null : qIndex)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                Soru {qIndex + 1}: {question.questionText || "(Bos)"}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {questionTypes.find(t => t.value === question.questionType)?.label}
                              </Badge>
                              {question.isRequired && (
                                <Badge variant="secondary" className="text-xs">Zorunlu</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); moveQuestion(qIndex, "up") }}
                                disabled={qIndex === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); moveQuestion(qIndex, "down") }}
                                disabled={qIndex === surveyQuestions.length - 1}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={(e) => { e.stopPropagation(); removeQuestion(qIndex) }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>

                        {expandedQuestion === qIndex && (
                          <CardContent className="pt-0 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2 space-y-2">
                                <Label>Soru Metni *</Label>
                                <Input
                                  value={question.questionText}
                                  onChange={(e) => updateQuestion(qIndex, "questionText", e.target.value)}
                                  placeholder="Sorunuzu yazin..."
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Soru Tipi</Label>
                                <Select
                                  value={question.questionType}
                                  onValueChange={(v) => updateQuestion(qIndex, "questionType", v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {questionTypes.map((type) => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-center justify-between">
                                <Label>Zorunlu Soru</Label>
                                <Switch
                                  checked={question.isRequired}
                                  onCheckedChange={(v) => updateQuestion(qIndex, "isRequired", v)}
                                />
                              </div>
                            </div>

                            {/* Options for choice questions */}
                            {["SINGLE_CHOICE", "MULTIPLE_CHOICE", "DROPDOWN"].includes(question.questionType) && (
                              <div className="space-y-3">
                                <Label>Seçenekler</Label>
                                {question.options.map((option, oIndex) => (
                                  <div key={oIndex} className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground w-6">
                                      {oIndex + 1}.
                                    </span>
                                    <Input
                                      value={option}
                                      onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                      placeholder={`Seçenek ${oIndex + 1}`}
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => removeOption(qIndex, oIndex)}
                                      disabled={question.options.length <= 1}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addOption(qIndex)}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Seçenek Ekle
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={resetSurveyForm}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Iptal
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSaveSurvey(false)}
                    disabled={savingSurvey || !surveyForm.title || surveyQuestions.length === 0}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Taslak Kaydet
                  </Button>
                  <Button
                    onClick={() => handleSaveSurvey(true)}
                    disabled={savingSurvey || !surveyForm.title || surveyQuestions.length === 0}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {savingSurvey ? "Kaydediliyor..." : "Aktif Et"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
