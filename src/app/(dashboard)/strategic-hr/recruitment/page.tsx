"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Briefcase,
  Plus,
  Users,
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Lightbulb,
  Target,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Play,
  Pause,
  Ban,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building2,
  ClipboardList,
  User,
  ExternalLink
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"
import TimeToHirePanel from "./_components/TimeToHirePanel"
import SourceBreakdownPanel from "./_components/SourceBreakdownPanel"
import RejectionReasonsPanel from "./_components/RejectionReasonsPanel"
import AssessmentPanel from "./_components/AssessmentPanel"

interface JobOpening {
  id: string
  code: string
  title: string
  department: string
  location: string | null
  employmentType: string
  status: string
  priority: string
  headcount: number
  filledCount: number
  description: string | null
  requirements: string | null
  salaryMin: number | null
  salaryMax: number | null
  postingDate: string | null
  closingDate: string | null
  hiringManagerName: string | null
  hiringManagerEmail: string | null
  _count: {
    applications: number
  }
  applications?: Application[]
  createdAt: string
}

interface Candidate {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  currentTitle: string | null
  currentCompany: string | null
  yearsOfExperience: number | null
  source: string
  linkedinUrl: string | null
  resumeUrl: string | null
  notes: string | null
  _count: {
    applications: number
  }
  applications: {
    id: string
    status: string
    jobOpening: {
      id: string
      title: string
      code: string
    }
  }[]
  createdAt: string
}

interface Application {
  id: string
  status: string
  appliedAt: string
  candidate: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

interface PersonnelRequest {
  id: string
  requestNumber: string
  requesterName: string
  requesterEmail: string
  department: string
  title: string
  requestType: string
  headcount: number
  employmentType: string
  justification: string
  responsibilities: string | null
  requirements: string | null
  preferredStartDate: string | null
  location: string | null
  workModel: string | null
  salaryMin: number | null
  salaryMax: number | null
  hasBudget: boolean
  status: string
  priority: string
  approvedByName: string | null
  approvedAt: string | null
  approvalNotes: string | null
  rejectedByName: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  approvals?: {
    id: string
    step: number
    kademe: string
    role: string
    decision: "APPROVED" | "REJECTED" | "RETURNED" | "FORWARDED" | null
    comment: string | null
    decidedAt: string | null
    approver: { id: string; name: string | null; email: string | null } | null
  }[]
  jobOpening: {
    id: string
    title: string
    code: string
    status: string
  } | null
  createdAt: string
}

// Public Job Application - Dışarıdan gelen başvurular
interface PublicJobApplication {
  id: string
  applicationNumber: string
  fullName: string
  email: string | null
  mobilePhone: string | null
  birthDate: string | null
  gender: string | null
  requestedPosition: string | null
  expectedSalary: number | null
  availableStartDate: string | null
  educationLevel: string | null
  referralSource: string | null
  photoUrl: string | null
  status: string
  notes: string | null
  digitalSignature: string | null
  signatureDate: string | null
  createdAt: string
}

const employmentTypeLabels: Record<string, string> = {
  FULL_TIME: "Tam Zamanli",
  PART_TIME: "Yari Zamanli",
  CONTRACT: "Sozlesmeli",
  INTERN: "Stajyer",
  TEMPORARY: "Gecici"
}

const statusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  PENDING_APPROVAL: "Onay Bekliyor",
  OPEN: "Acik",
  ON_HOLD: "Beklemede",
  FILLED: "Dolduruldu",
  CANCELLED: "Iptal",
  CLOSED: "Kapandi"
}

const priorityLabels: Record<string, string> = {
  LOW: "Dusuk",
  MEDIUM: "Orta",
  HIGH: "Yuksek",
  URGENT: "Acil"
}

const sourceLabels: Record<string, string> = {
  DIRECT: "Direkt Basvuru",
  REFERRAL: "Referans",
  LINKEDIN: "LinkedIn",
  JOB_BOARD: "Is Ilani Sitesi",
  AGENCY: "Ajans",
  CAREER_FAIR: "Kariyer Fuari",
  INTERNAL: "Ic Aday",
  OTHER: "Diger"
}

const applicationStatusLabels: Record<string, string> = {
  NEW: "Yeni",
  SCREENING: "On Eleme",
  PHONE_SCREEN: "Telefon Gorusmesi",
  INTERVIEW: "Mulakat",
  TECHNICAL: "Teknik Mulakat",
  FINAL: "Final Mulakat",
  OFFER: "Teklif",
  HIRED: "Ise Alindi",
  REJECTED: "Reddedildi",
  WITHDRAWN: "Geri Cekildi"
}

const applicationStatusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  SCREENING: "bg-purple-100 text-purple-800",
  PHONE_SCREEN: "bg-indigo-100 text-indigo-800",
  INTERVIEW: "bg-yellow-100 text-yellow-800",
  TECHNICAL: "bg-orange-100 text-orange-800",
  FINAL: "bg-pink-100 text-pink-800",
  OFFER: "bg-cyan-100 text-cyan-800",
  HIRED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-gray-100 text-gray-800"
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800",
  OPEN: "bg-green-100 text-green-800",
  ON_HOLD: "bg-orange-100 text-orange-800",
  FILLED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-800",
  CLOSED: "bg-gray-100 text-gray-800"
}

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800"
}

const requestTypeLabels: Record<string, string> = {
  NEW_POSITION: "Yeni Pozisyon",
  REPLACEMENT: "Yenileme",
  EXPANSION: "Kadro Genisletme",
  TEMPORARY: "Gecici",
  INTERN: "Stajyer"
}

const requestStatusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  PENDING: "Onay Bekliyor",
  APPROVED: "Onaylandi",
  REJECTED: "Reddedildi",
  IN_PROGRESS: "Islemde",
  COMPLETED: "Tamamlandi",
  CANCELLED: "Iptal"
}

const requestStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-gray-100 text-gray-800"
}

// Public Job Application status labels
const jobAppStatusLabels: Record<string, string> = {
  PENDING: "Beklemede",
  REVIEWING: "Inceleniyor",
  SHORTLISTED: "On Eleme",
  INTERVIEW: "Mulakat",
  ACCEPTED: "Kabul Edildi",
  REJECTED: "Reddedildi",
  WITHDRAWN: "Geri Cekildi"
}

// Ret (kök-neden) kategori etiketleri
const RET_KATEGORI_ETIKET: Record<string, string> = {
  TEKLIF_REDDI: "Teklif Reddi (aday kaynaklı)",
  ISE_ALMAMA: "İşe Almama (şirket kaynaklı)",
  SUREC_KAYBI: "Süreç Kaybı",
}

const jobAppStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  REVIEWING: "bg-blue-100 text-blue-800",
  SHORTLISTED: "bg-purple-100 text-purple-800",
  INTERVIEW: "bg-indigo-100 text-indigo-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-gray-100 text-gray-800"
}

const educationLevelLabels: Record<string, string> = {
  PRIMARY_SCHOOL: "Ilkogretim",
  HIGH_SCHOOL: "Lise",
  ASSOCIATE: "Onlisans",
  BACHELOR: "Lisans",
  MASTER: "Yuksek Lisans",
  DOCTORATE: "Doktora"
}

const genderLabels: Record<string, string> = {
  MALE: "Bay",
  FEMALE: "Bayan"
}

const referralSourceLabels: Record<string, string> = {
  AGENCY: "Araci Kurum",
  ISKUR: "IS-KUR",
  WEBSITE: "Web Sitesi",
  REFERENCE: "Referans",
  OTHER: "Diger"
}

export default function RecruitmentPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [openings, setOpenings] = useState<JobOpening[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [requests, setRequests] = useState<PersonnelRequest[]>([])
  const [jobApplications, setJobApplications] = useState<PublicJobApplication[]>([])
  const [jobAppTotal, setJobAppTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isCandidateDialogOpen, setIsCandidateDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false)
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [isRequestDetailOpen, setIsRequestDetailOpen] = useState(false)
  const [selectedOpening, setSelectedOpening] = useState<JobOpening | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<PersonnelRequest | null>(null)
  const [selectedJobApp, setSelectedJobApp] = useState<PublicJobApplication | null>(null)
  const [isJobAppDetailOpen, setIsJobAppDetailOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("requests")
  // Ret nedeni (kök-neden) modalı
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)
  const [rejectReasonId, setRejectReasonId] = useState("")
  const [rejectNotes, setRejectNotes] = useState("")
  const [rejectReasons, setRejectReasons] = useState<{ id: string; category: string; name: string }[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [rejectionReason, setRejectionReason] = useState("")

  // Form state - Ilan
  const [formData, setFormData] = useState({
    title: "",
    department: "",
    location: "",
    employmentType: "FULL_TIME",
    description: "",
    requirements: "",
    headcount: 1,
    priority: "MEDIUM",
    hiringManagerName: "",
    hiringManagerEmail: "",
    salaryMin: "",
    salaryMax: "",
    closingDate: ""
  })

  // Form state - Aday
  const [candidateForm, setCandidateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    currentTitle: "",
    currentCompany: "",
    yearsOfExperience: "",
    source: "DIRECT",
    linkedinUrl: "",
    notes: ""
  })

  // Basvuru icin secilen aday
  const [applyForm, setApplyForm] = useState({
    candidateId: "",
    coverLetter: ""
  })

  // Eleman talebi form
  const [requestForm, setRequestForm] = useState({
    title: "",
    requestType: "NEW_POSITION",
    headcount: 1,
    employmentType: "FULL_TIME",
    justification: "",
    responsibilities: "",
    requirements: "",
    preferredStartDate: "",
    location: "",
    workModel: "ONSITE",
    salaryMin: "",
    salaryMax: "",
    hasBudget: false,
    priority: "MEDIUM"
  })

  useEffect(() => {
    fetchOpenings()
    fetchCandidates()
    fetchRequests()
    fetchJobApplications()
  }, [])

  const fetchOpenings = async () => {
    try {
      const res = await fetch("/api/strategic-hr/recruitment")
      if (res.ok) {
        const data = await res.json()
        setOpenings(data)
      }
    } catch (error) {
      console.error("Ilanlar yuklenirken hata:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCandidates = async () => {
    try {
      const res = await fetch("/api/strategic-hr/recruitment/candidates")
      if (res.ok) {
        const data = await res.json()
        setCandidates(data)
      }
    } catch (error) {
      console.error("Adaylar yuklenirken hata:", error)
    }
  }

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/strategic-hr/recruitment/personnel-requests")
      if (res.ok) {
        const data = await res.json()
        setRequests(data)
      }
    } catch (error) {
      console.error("Talepler yuklenirken hata:", error)
    }
  }

  const fetchJobApplications = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all" && activeTab === "job-applications") {
        params.set("status", statusFilter)
      }
      if (searchTerm && activeTab === "job-applications") {
        params.set("search", searchTerm)
      }
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications?${params}`)
      if (res.ok) {
        const data = await res.json()
        setJobApplications(data.applications)
        setJobAppTotal(data.pagination.total)
      }
    } catch (error) {
      console.error("Is basvurulari yuklenirken hata:", error)
    }
  }

  const fetchJobAppDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedJobApp(data)
        setIsJobAppDetailOpen(true)
      }
    } catch (error) {
      console.error("Basvuru detayi yuklenirken hata:", error)
    }
  }

  const handleJobAppStatusChange = async (id: string, newStatus: string) => {
    // REJECTED → ret nedeni ZORUNLU: doğrudan PATCH etme, önce ret modalını aç.
    if (newStatus === "REJECTED") {
      if (rejectReasons.length === 0) await fetchRejectReasons()
      setRejectTargetId(id)
      setRejectReasonId("")
      setRejectNotes("")
      setRejectDialogOpen(true)
      return
    }
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        fetchJobApplications()
        toast.success("Basvuru durumu guncellendi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Durum guncellenemedi")
      }
    } catch (error) {
      console.error("Durum guncellenirken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  // Ret nedeni sözlüğü + ret modalı onayı
  const fetchRejectReasons = async () => {
    try {
      const res = await fetch("/api/strategic-hr/recruitment/rejection-reasons?activeOnly=1")
      if (res.ok) setRejectReasons(await res.json())
    } catch (e) { console.error("Ret nedenleri yuklenemedi:", e) }
  }
  const confirmReject = async () => {
    if (!rejectTargetId || !rejectReasonId) return
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${rejectTargetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejectionReasonId: rejectReasonId, ...(rejectNotes ? { notes: rejectNotes } : {}) })
      })
      if (res.ok) {
        setRejectDialogOpen(false)
        fetchJobApplications()
        toast.success("Basvuru ret nedeniyle reddedildi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Reddedilemedi")
      }
    } catch (e) {
      console.error("Ret hatasi:", e); toast.error("Bir hata olustu")
    }
  }

  const handleJobAppNotesUpdate = async (id: string, notes: string) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes })
      })
      if (res.ok) {
        toast.success("Notlar kaydedildi")
      }
    } catch (error) {
      console.error("Notlar kaydedilirken hata:", error)
    }
  }

  const handleDeleteJobApp = async (id: string) => {
    if (!confirm("Bu basvuruyu silmek istediginizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`, {
        method: "DELETE"
      })
      if (res.ok) {
        fetchJobApplications()
        setIsJobAppDetailOpen(false)
        toast.success("Basvuru silindi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Basvuru silinemedi")
      }
    } catch (error) {
      console.error("Basvuru silinirken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  const fetchOpeningDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedOpening(data)
        setIsDetailDialogOpen(true)
      }
    } catch (error) {
      console.error("Ilan detayi yuklenirken hata:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch("/api/strategic-hr/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          headcount: parseInt(formData.headcount.toString()),
          salaryMin: formData.salaryMin ? parseInt(formData.salaryMin) : null,
          salaryMax: formData.salaryMax ? parseInt(formData.salaryMax) : null,
          closingDate: formData.closingDate || null
        })
      })

      if (res.ok) {
        setIsDialogOpen(false)
        fetchOpenings()
        resetForm()
        toast.success("Is ilani olusturuldu")
      } else {
        const error = await res.json()
        toast.error(error.error || "Ilan olusturulamadi")
      }
    } catch (error) {
      console.error("Ilan olusturulurken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  const handleCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch("/api/strategic-hr/recruitment/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...candidateForm,
          yearsOfExperience: candidateForm.yearsOfExperience ? parseInt(candidateForm.yearsOfExperience) : null
        })
      })

      if (res.ok) {
        setIsCandidateDialogOpen(false)
        fetchCandidates()
        resetCandidateForm()
        toast.success("Aday eklendi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Aday eklenemedi")
      }
    } catch (error) {
      console.error("Aday eklenirken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOpening) return

    try {
      const res = await fetch("/api/strategic-hr/recruitment/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobOpeningId: selectedOpening.id,
          candidateId: applyForm.candidateId,
          coverLetter: applyForm.coverLetter || null
        })
      })

      if (res.ok) {
        setIsApplyDialogOpen(false)
        fetchOpenings()
        fetchCandidates()
        setApplyForm({ candidateId: "", coverLetter: "" })
        toast.success("Basvuru olusturuldu")
      } else {
        const error = await res.json()
        toast.error(error.error || "Basvuru olusturulamadi")
      }
    } catch (error) {
      console.error("Basvuru olusturulurken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  const handleStatusChange = async (openingId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/${openingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        fetchOpenings()
        toast.success("Ilan durumu guncellendi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Durum guncellenemedi")
      }
    } catch (error) {
      console.error("Durum guncellenirken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  const handleDeleteOpening = async (openingId: string) => {
    if (!confirm("Bu ilani silmek istediginizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/strategic-hr/recruitment/${openingId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        fetchOpenings()
        toast.success("Ilan silindi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Ilan silinemedi")
      }
    } catch (error) {
      console.error("Ilan silinirken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!confirm("Bu adayi silmek istediginizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/strategic-hr/recruitment/candidates/${candidateId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        fetchCandidates()
        toast.success("Aday silindi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Aday silinemedi")
      }
    } catch (error) {
      console.error("Aday silinirken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  // Eleman Talebi fonksiyonlari
  const handleRequestSubmit = async (e: React.FormEvent, submitForApproval: boolean = false) => {
    e.preventDefault()

    try {
      const res = await fetch("/api/strategic-hr/recruitment/personnel-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestForm,
          headcount: parseInt(requestForm.headcount.toString()),
          salaryMin: requestForm.salaryMin ? parseInt(requestForm.salaryMin) : null,
          salaryMax: requestForm.salaryMax ? parseInt(requestForm.salaryMax) : null,
          preferredStartDate: requestForm.preferredStartDate || null,
          status: submitForApproval ? "PENDING" : "DRAFT"
        })
      })

      if (res.ok) {
        setIsRequestDialogOpen(false)
        fetchRequests()
        resetRequestForm()
        toast.success(submitForApproval ? "Talep onaya gonderildi" : "Talep taslak olarak kaydedildi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Talep olusturulamadi")
      }
    } catch (error) {
      console.error("Talep olusturulurken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  const handleRequestAction = async (requestId: string, action: string, data?: any) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/personnel-requests/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data })
      })

      if (res.ok) {
        fetchRequests()
        fetchOpenings()
        setIsRequestDetailOpen(false)
        setRejectionReason("")
        const messages: Record<string, string> = {
          approve: "Talep onaylandi",
          reject: "Talep reddedildi",
          submit: "Talep onaya gonderildi",
          cancel: "Talep iptal edildi",
          create_opening: "Ilan olusturuldu"
        }
        toast.success(messages[action] || "Islem basarili")
      } else {
        const error = await res.json()
        toast.error(error.error || "Islem basarisiz")
      }
    } catch (error) {
      console.error("Islem hatasi:", error)
      toast.error("Bir hata olustu")
    }
  }

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm("Bu talebi silmek istediginizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/strategic-hr/recruitment/personnel-requests/${requestId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        fetchRequests()
        toast.success("Talep silindi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Talep silinemedi")
      }
    } catch (error) {
      console.error("Talep silinirken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  const resetRequestForm = () => {
    setRequestForm({
      title: "",
      requestType: "NEW_POSITION",
      headcount: 1,
      employmentType: "FULL_TIME",
      justification: "",
      responsibilities: "",
      requirements: "",
      preferredStartDate: "",
      location: "",
      workModel: "ONSITE",
      salaryMin: "",
      salaryMax: "",
      hasBudget: false,
      priority: "MEDIUM"
    })
  }

  // Yetki kontrolleri
  const userRole = session?.user?.role || ""
  const userDepartment = session?.user?.department || ""
  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"]
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"]
  const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept))
  const hasFullAccess = fullAccessRoles.includes(userRole) || isHrDepartment

  const resetForm = () => {
    setFormData({
      title: "",
      department: "",
      location: "",
      employmentType: "FULL_TIME",
      description: "",
      requirements: "",
      headcount: 1,
      priority: "MEDIUM",
      hiringManagerName: "",
      hiringManagerEmail: "",
      salaryMin: "",
      salaryMax: "",
      closingDate: ""
    })
  }

  const resetCandidateForm = () => {
    setCandidateForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      currentTitle: "",
      currentCompany: "",
      yearsOfExperience: "",
      source: "DIRECT",
      linkedinUrl: "",
      notes: ""
    })
  }

  // Filtreleme
  const filteredOpenings = openings.filter(o => {
    const matchesSearch = o.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || o.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredCandidates = candidates.filter(c => {
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase()
    return fullName.includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.currentCompany?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  })

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requestNumber.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Stats
  const totalOpenings = openings.length
  const openPositions = openings.filter(o => o.status === "OPEN").length
  const totalCandidates = candidates.length
  const totalApplications = openings.reduce((sum, o) => sum + o._count.applications, 0)
  const pendingRequests = requests.filter(r => r.status === "PENDING").length
  const totalRequests = requests.length
  const pendingJobApps = jobApplications.filter(a => a.status === "PENDING").length

  // Job applications için filtreleme
  const filteredJobApplications = jobApplications.filter(a => {
    const matchesSearch = a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      a.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.requestedPosition?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchesStatus = statusFilter === "all" || a.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Yukleniyor...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Ise Alim
          </h1>
          <p className="text-muted-foreground">
            Acik pozisyonlari ve aday basvurularini yonetin
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsGuideOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-2" />
            Kilavuz
          </Button>
          <Button variant="outline" asChild>
            <a href="/job-application" target="_blank" rel="noopener noreferrer">
              İş Başvuru Formu
            </a>
          </Button>
          <Button onClick={() => setIsRequestDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Eleman Talebi
          </Button>
          {hasFullAccess && (
            <>
              <Button variant="outline" onClick={() => setIsCandidateDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Yeni Aday
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Ilan
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Yeni Is Ilani</DialogTitle>
                <DialogDescription>
                  Yeni bir acik pozisyon ilani olusturun
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Pozisyon Adi *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Kidemli Yazilim Muhendisi"
                      required
                    />
                  </div>

                  <div>
                    <Label>Departman *</Label>
                    <Input
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="Bilgi Teknolojileri"
                      required
                    />
                  </div>

                  <div>
                    <Label>Lokasyon</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Istanbul - Merkez"
                    />
                  </div>

                  <div>
                    <Label>Calisma Tipi</Label>
                    <Select
                      value={formData.employmentType}
                      onValueChange={(v) => setFormData({ ...formData, employmentType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL_TIME">Tam Zamanli</SelectItem>
                        <SelectItem value="PART_TIME">Yari Zamanli</SelectItem>
                        <SelectItem value="CONTRACT">Sozlesmeli</SelectItem>
                        <SelectItem value="INTERN">Stajyer</SelectItem>
                        <SelectItem value="TEMPORARY">Gecici</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Kisi Sayisi</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.headcount}
                      onChange={(e) => setFormData({ ...formData, headcount: parseInt(e.target.value) })}
                    />
                  </div>

                  <div>
                    <Label>Oncelik</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(v) => setFormData({ ...formData, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Dusuk</SelectItem>
                        <SelectItem value="MEDIUM">Orta</SelectItem>
                        <SelectItem value="HIGH">Yuksek</SelectItem>
                        <SelectItem value="URGENT">Acil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Kapanma Tarihi</Label>
                    <Input
                      type="date"
                      value={formData.closingDate}
                      onChange={(e) => setFormData({ ...formData, closingDate: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Min Maas (TL)</Label>
                    <Input
                      type="number"
                      value={formData.salaryMin}
                      onChange={(e) => setFormData({ ...formData, salaryMin: e.target.value })}
                      placeholder="50000"
                    />
                  </div>

                  <div>
                    <Label>Max Maas (TL)</Label>
                    <Input
                      type="number"
                      value={formData.salaryMax}
                      onChange={(e) => setFormData({ ...formData, salaryMax: e.target.value })}
                      placeholder="80000"
                    />
                  </div>

                  <div>
                    <Label>Ise Alim Yoneticisi</Label>
                    <Input
                      value={formData.hiringManagerName}
                      onChange={(e) => setFormData({ ...formData, hiringManagerName: e.target.value })}
                      placeholder="Ad Soyad"
                    />
                  </div>

                  <div>
                    <Label>Yonetici E-posta</Label>
                    <Input
                      type="email"
                      value={formData.hiringManagerEmail}
                      onChange={(e) => setFormData({ ...formData, hiringManagerEmail: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Is Tanimi *</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Pozisyon hakkinda detayli bilgi..."
                      rows={4}
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Gereksinimler</Label>
                    <Textarea
                      value={formData.requirements}
                      onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                      placeholder="Aranan ozellikler..."
                      rows={4}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Iptal
                  </Button>
                  <Button type="submit" disabled={!formData.title || !formData.department || !formData.description}>
                    Olustur
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Eleman Talebi Modal */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Eleman Talebi</DialogTitle>
            <DialogDescription>
              Departmaniniz icin yeni eleman talebinde bulunun
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => handleRequestSubmit(e, false)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Pozisyon Adi *</Label>
                <Input
                  value={requestForm.title}
                  onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                  placeholder="Yazilim Muhendisi"
                  required
                />
              </div>

              <div>
                <Label>Talep Tipi</Label>
                <Select
                  value={requestForm.requestType}
                  onValueChange={(v) => setRequestForm({ ...requestForm, requestType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW_POSITION">Yeni Pozisyon</SelectItem>
                    <SelectItem value="REPLACEMENT">Yenileme (Ayrilan Yerine)</SelectItem>
                    <SelectItem value="EXPANSION">Kadro Genisletme</SelectItem>
                    <SelectItem value="TEMPORARY">Gecici/Donemel</SelectItem>
                    <SelectItem value="INTERN">Stajyer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Kisi Sayisi</Label>
                <Input
                  type="number"
                  min={1}
                  value={requestForm.headcount}
                  onChange={(e) => setRequestForm({ ...requestForm, headcount: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div>
                <Label>Calisma Tipi</Label>
                <Select
                  value={requestForm.employmentType}
                  onValueChange={(v) => setRequestForm({ ...requestForm, employmentType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Tam Zamanli</SelectItem>
                    <SelectItem value="PART_TIME">Yari Zamanli</SelectItem>
                    <SelectItem value="CONTRACT">Sozlesmeli</SelectItem>
                    <SelectItem value="INTERN">Stajyer</SelectItem>
                    <SelectItem value="TEMPORARY">Gecici</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Oncelik</Label>
                <Select
                  value={requestForm.priority}
                  onValueChange={(v) => setRequestForm({ ...requestForm, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Dusuk</SelectItem>
                    <SelectItem value="MEDIUM">Orta</SelectItem>
                    <SelectItem value="HIGH">Yuksek</SelectItem>
                    <SelectItem value="URGENT">Acil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tercih Edilen Baslama</Label>
                <Input
                  type="date"
                  value={requestForm.preferredStartDate}
                  onChange={(e) => setRequestForm({ ...requestForm, preferredStartDate: e.target.value })}
                />
              </div>

              <div>
                <Label>Lokasyon</Label>
                <Input
                  value={requestForm.location}
                  onChange={(e) => setRequestForm({ ...requestForm, location: e.target.value })}
                  placeholder="Istanbul"
                />
              </div>

              <div>
                <Label>Calisma Modeli</Label>
                <Select
                  value={requestForm.workModel}
                  onValueChange={(v) => setRequestForm({ ...requestForm, workModel: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONSITE">Ofis</SelectItem>
                    <SelectItem value="REMOTE">Uzaktan</SelectItem>
                    <SelectItem value="HYBRID">Hibrit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Min Maas (TL)</Label>
                <Input
                  type="number"
                  value={requestForm.salaryMin}
                  onChange={(e) => setRequestForm({ ...requestForm, salaryMin: e.target.value })}
                  placeholder="50000"
                />
              </div>

              <div>
                <Label>Max Maas (TL)</Label>
                <Input
                  type="number"
                  value={requestForm.salaryMax}
                  onChange={(e) => setRequestForm({ ...requestForm, salaryMax: e.target.value })}
                  placeholder="80000"
                />
              </div>

              <div className="col-span-2">
                <Label>Gerekce / Neden Ihtiyac Var? *</Label>
                <Textarea
                  value={requestForm.justification}
                  onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                  placeholder="Bu pozisyona neden ihtiyac duyuluyor? Mevcut is yukunuz, proje gereksinimleri vb."
                  rows={3}
                  required
                />
              </div>

              <div className="col-span-2">
                <Label>Gorev Tanimi</Label>
                <Textarea
                  value={requestForm.responsibilities}
                  onChange={(e) => setRequestForm({ ...requestForm, responsibilities: e.target.value })}
                  placeholder="Bu pozisyonun ana sorumlulukları..."
                  rows={3}
                />
              </div>

              <div className="col-span-2">
                <Label>Aranan Ozellikler</Label>
                <Textarea
                  value={requestForm.requirements}
                  onChange={(e) => setRequestForm({ ...requestForm, requirements: e.target.value })}
                  placeholder="Egitim, deneyim, beceriler..."
                  rows={3}
                />
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasBudget"
                  checked={requestForm.hasBudget}
                  onChange={(e) => setRequestForm({ ...requestForm, hasBudget: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="hasBudget" className="cursor-pointer">
                  Butce onayi mevcut
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
                Iptal
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!requestForm.title || !requestForm.justification}
                onClick={(e) => handleRequestSubmit(e as any, false)}
              >
                Taslak Kaydet
              </Button>
              <Button
                type="button"
                disabled={!requestForm.title || !requestForm.justification}
                onClick={(e) => handleRequestSubmit(e as any, true)}
              >
                Onaya Gonder
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Talep Detay Modal */}
      <Dialog open={isRequestDetailOpen} onOpenChange={setIsRequestDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedRequest.title}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      <span className="font-mono">{selectedRequest.requestNumber}</span>
                      <Badge className={requestStatusColors[selectedRequest.status]}>
                        {requestStatusLabels[selectedRequest.status]}
                      </Badge>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Talep Eden:</span>
                    <p className="font-medium">{selectedRequest.requesterName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Departman:</span>
                    <p className="font-medium">{selectedRequest.department}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Talep Tipi:</span>
                    <p className="font-medium">{requestTypeLabels[selectedRequest.requestType]}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kisi Sayisi:</span>
                    <p className="font-medium">{selectedRequest.headcount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Calisma Tipi:</span>
                    <p className="font-medium">{employmentTypeLabels[selectedRequest.employmentType]}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Oncelik:</span>
                    <Badge className={priorityColors[selectedRequest.priority]}>
                      {priorityLabels[selectedRequest.priority]}
                    </Badge>
                  </div>
                  {selectedRequest.location && (
                    <div>
                      <span className="text-muted-foreground">Lokasyon:</span>
                      <p className="font-medium">{selectedRequest.location}</p>
                    </div>
                  )}
                  {selectedRequest.preferredStartDate && (
                    <div>
                      <span className="text-muted-foreground">Tercih Edilen Baslama:</span>
                      <p className="font-medium">
                        {format(new Date(selectedRequest.preferredStartDate), "d MMM yyyy", { locale: tr })}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-1">Gerekce</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedRequest.justification}
                  </p>
                </div>

                {selectedRequest.responsibilities && (
                  <div>
                    <h4 className="font-medium mb-1">Gorev Tanimi</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRequest.responsibilities}
                    </p>
                  </div>
                )}

                {selectedRequest.requirements && (
                  <div>
                    <h4 className="font-medium mb-1">Aranan Ozellikler</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRequest.requirements}
                    </p>
                  </div>
                )}

                {selectedRequest.status === "APPROVED" && selectedRequest.approvedByName && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>Onaylayan:</strong> {selectedRequest.approvedByName}
                      {selectedRequest.approvedAt && (
                        <span> - {format(new Date(selectedRequest.approvedAt), "d MMM yyyy HH:mm", { locale: tr })}</span>
                      )}
                    </p>
                    {selectedRequest.approvalNotes && (
                      <p className="text-sm text-green-700 mt-1">{selectedRequest.approvalNotes}</p>
                    )}
                  </div>
                )}

                {selectedRequest.status === "REJECTED" && selectedRequest.rejectedByName && (
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>Reddeden:</strong> {selectedRequest.rejectedByName}
                      {selectedRequest.rejectedAt && (
                        <span> - {format(new Date(selectedRequest.rejectedAt), "d MMM yyyy HH:mm", { locale: tr })}</span>
                      )}
                    </p>
                    {selectedRequest.rejectionReason && (
                      <p className="text-sm text-red-700 mt-1"><strong>Sebep:</strong> {selectedRequest.rejectionReason}</p>
                    )}
                  </div>
                )}

                {selectedRequest.jobOpening && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Olusturulan Ilan:</strong> {selectedRequest.jobOpening.code} - {selectedRequest.jobOpening.title}
                    </p>
                  </div>
                )}

                {/* Onay zinciri (3 kademe: Müdür → GMY → GM) */}
                {selectedRequest.approvals && selectedRequest.approvals.length > 0 && (
                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium mb-2">Onay Zinciri</p>
                    <div className="space-y-2">
                      {selectedRequest.approvals.map((a) => {
                        const isCurrent =
                          a.decision === null &&
                          selectedRequest.approvals?.find((x) => x.decision === null)?.id === a.id
                        return (
                          <div key={a.id} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium">{a.step}. {a.role}</span>
                              {a.approver?.name && <span className="text-slate-500"> — {a.approver.name}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {a.decision === "APPROVED" ? (
                                <Badge className="bg-green-100 text-green-700">Onayladı</Badge>
                              ) : a.decision === "REJECTED" ? (
                                <Badge className="bg-red-100 text-red-700">Reddetti</Badge>
                              ) : isCurrent ? (
                                <Badge className="bg-amber-100 text-amber-700">Sırada</Badge>
                              ) : (
                                <Badge variant="secondary">Bekliyor</Badge>
                              )}
                              {a.decidedAt && (
                                <span className="text-xs text-slate-400">
                                  {format(new Date(a.decidedAt), "d MMM HH:mm", { locale: tr })}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Red gerekce alani — yalnız sıradaki adımın onaycısına */}
                {selectedRequest.status === "PENDING" &&
                  selectedRequest.approvals?.find((a) => a.decision === null)?.approver?.email === session?.user?.email && (
                  <div>
                    <Label>Red Gerekcesi (red icin zorunlu)</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Talebin neden reddedildigini aciklayin..."
                      rows={2}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {/* Talep sahibi islemleri */}
                {selectedRequest.status === "DRAFT" && selectedRequest.requesterEmail === session?.user?.email && (
                  <>
                    <Button variant="outline" onClick={() => handleRequestAction(selectedRequest.id, "submit")}>
                      Onaya Gonder
                    </Button>
                    <Button variant="destructive" onClick={() => handleDeleteRequest(selectedRequest.id)}>
                      Sil
                    </Button>
                  </>
                )}

                {selectedRequest.status === "PENDING" && selectedRequest.requesterEmail === session?.user?.email && (
                  <Button variant="outline" onClick={() => handleRequestAction(selectedRequest.id, "cancel")}>
                    Iptal Et
                  </Button>
                )}

                {/* Onay/red: YALNIZ sıradaki adımın onaycısı (admin bile başkası adına onaylayamaz) */}
                {selectedRequest.status === "PENDING" &&
                  selectedRequest.approvals?.find((a) => a.decision === null)?.approver?.email === session?.user?.email && (
                  <>
                    <Button
                      variant="destructive"
                      disabled={!rejectionReason}
                      onClick={() => handleRequestAction(selectedRequest.id, "reject", { rejectionReason })}
                    >
                      Reddet
                    </Button>
                    <Button onClick={() => handleRequestAction(selectedRequest.id, "approve")}>
                      Onayla
                    </Button>
                  </>
                )}

                {selectedRequest.status === "APPROVED" && hasFullAccess && !selectedRequest.jobOpening && (
                  <Button onClick={() => handleRequestAction(selectedRequest.id, "create_opening")}>
                    Ilan Olustur
                  </Button>
                )}

                <Button variant="outline" onClick={() => setIsRequestDetailOpen(false)}>
                  Kapat
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Aday Ekleme Modal */}
      <Dialog open={isCandidateDialogOpen} onOpenChange={setIsCandidateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Aday Ekle</DialogTitle>
            <DialogDescription>
              Aday havuzuna yeni bir aday ekleyin
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCandidateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Ad *</Label>
                <Input
                  value={candidateForm.firstName}
                  onChange={(e) => setCandidateForm({ ...candidateForm, firstName: e.target.value })}
                  placeholder="Ad"
                  required
                />
              </div>
              <div>
                <Label>Soyad *</Label>
                <Input
                  value={candidateForm.lastName}
                  onChange={(e) => setCandidateForm({ ...candidateForm, lastName: e.target.value })}
                  placeholder="Soyad"
                  required
                />
              </div>
              <div>
                <Label>E-posta *</Label>
                <Input
                  type="email"
                  value={candidateForm.email}
                  onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input
                  value={candidateForm.phone}
                  onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                  placeholder="+90 5XX XXX XX XX"
                />
              </div>
              <div>
                <Label>Mevcut Pozisyon</Label>
                <Input
                  value={candidateForm.currentTitle}
                  onChange={(e) => setCandidateForm({ ...candidateForm, currentTitle: e.target.value })}
                  placeholder="Yazilim Muhendisi"
                />
              </div>
              <div>
                <Label>Mevcut Sirket</Label>
                <Input
                  value={candidateForm.currentCompany}
                  onChange={(e) => setCandidateForm({ ...candidateForm, currentCompany: e.target.value })}
                  placeholder="ABC Teknoloji"
                />
              </div>
              <div>
                <Label>Deneyim (Yil)</Label>
                <Input
                  type="number"
                  value={candidateForm.yearsOfExperience}
                  onChange={(e) => setCandidateForm({ ...candidateForm, yearsOfExperience: e.target.value })}
                  placeholder="5"
                />
              </div>
              <div>
                <Label>Kaynak</Label>
                <Select
                  value={candidateForm.source}
                  onValueChange={(v) => setCandidateForm({ ...candidateForm, source: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECT">Direkt Basvuru</SelectItem>
                    <SelectItem value="REFERRAL">Referans</SelectItem>
                    <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                    <SelectItem value="JOB_BOARD">Is Ilani Sitesi</SelectItem>
                    <SelectItem value="AGENCY">Ajans</SelectItem>
                    <SelectItem value="CAREER_FAIR">Kariyer Fuari</SelectItem>
                    <SelectItem value="INTERNAL">Ic Aday</SelectItem>
                    <SelectItem value="OTHER">Diger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>LinkedIn URL</Label>
                <Input
                  value={candidateForm.linkedinUrl}
                  onChange={(e) => setCandidateForm({ ...candidateForm, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div className="col-span-2">
                <Label>Notlar</Label>
                <Textarea
                  value={candidateForm.notes}
                  onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })}
                  placeholder="Aday hakkinda notlar..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCandidateDialogOpen(false)}>
                Iptal
              </Button>
              <Button type="submit" disabled={!candidateForm.firstName || !candidateForm.lastName || !candidateForm.email}>
                Ekle
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ilan Detay Modal */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedOpening && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedOpening.title}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      <span className="font-mono">{selectedOpening.code}</span>
                      <Badge className={statusColors[selectedOpening.status]}>
                        {statusLabels[selectedOpening.status]}
                      </Badge>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Temel Bilgiler */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOpening.department}</span>
                  </div>
                  {selectedOpening.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedOpening.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>{employmentTypeLabels[selectedOpening.employmentType]}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOpening.filledCount}/{selectedOpening.headcount} kadro</span>
                  </div>
                  {selectedOpening.closingDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Kapanma: {format(new Date(selectedOpening.closingDate), "d MMM yyyy", { locale: tr })}</span>
                    </div>
                  )}
                  {(selectedOpening.salaryMin || selectedOpening.salaryMax) && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Maas:</span>
                      <span>
                        {selectedOpening.salaryMin?.toLocaleString()} - {selectedOpening.salaryMax?.toLocaleString()} TL
                      </span>
                    </div>
                  )}
                </div>

                {/* Is Tanimi */}
                {selectedOpening.description && (
                  <div>
                    <h4 className="font-medium mb-2">Is Tanimi</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedOpening.description}
                    </p>
                  </div>
                )}

                {/* Gereksinimler */}
                {selectedOpening.requirements && (
                  <div>
                    <h4 className="font-medium mb-2">Gereksinimler</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedOpening.requirements}
                    </p>
                  </div>
                )}

                {/* Basvurular */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Basvurular ({selectedOpening._count.applications})</h4>
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsApplyDialogOpen(true)
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Basvuru Ekle
                    </Button>
                  </div>
                  {selectedOpening.applications && selectedOpening.applications.length > 0 ? (
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Aday</TableHead>
                            <TableHead>E-posta</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Tarih</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOpening.applications.map((app) => (
                            <TableRow key={app.id}>
                              <TableCell className="font-medium">
                                {app.candidate.firstName} {app.candidate.lastName}
                              </TableCell>
                              <TableCell>{app.candidate.email}</TableCell>
                              <TableCell>
                                <Badge className={applicationStatusColors[app.status]}>
                                  {applicationStatusLabels[app.status]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {format(new Date(app.appliedAt), "d MMM yyyy", { locale: tr })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Henuz basvuru yok
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Basvuru Ekleme Modal */}
      <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Basvuru Ekle</DialogTitle>
            <DialogDescription>
              {selectedOpening?.title} pozisyonuna aday basvurusu ekleyin
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApplySubmit} className="space-y-4">
            <div>
              <Label>Aday Sec *</Label>
              <Select
                value={applyForm.candidateId}
                onValueChange={(v) => setApplyForm({ ...applyForm, candidateId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aday secin..." />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} - {c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>On Yazi (Opsiyonel)</Label>
              <Textarea
                value={applyForm.coverLetter}
                onChange={(e) => setApplyForm({ ...applyForm, coverLetter: e.target.value })}
                placeholder="Adayin on yazisi..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsApplyDialogOpen(false)}>
                Iptal
              </Button>
              <Button type="submit" disabled={!applyForm.candidateId}>
                Basvuru Olustur
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Kilavuz Modal */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Ise Alim Kilavuzu
            </DialogTitle>
            <DialogDescription>
              Ise alim surecinin nasil yurutulecegini ogrenim
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                Ise Alim Modulu Nedir?
              </h3>
              <p className="text-sm text-muted-foreground">
                Ise alim modulu, acik pozisyonlari yonetmek, aday havuzu olusturmak ve mulakat
                sureclerini takip etmek icin kullanilir.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-green-500" />
                Ise Alim Sureci
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex gap-3 items-start">
                  <Badge className="bg-blue-100 text-blue-800">1</Badge>
                  <div>
                    <p className="font-medium">Ilan Olusturma</p>
                    <p className="text-muted-foreground">"Yeni Ilan" ile pozisyon bilgilerini girin.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="bg-green-100 text-green-800">2</Badge>
                  <div>
                    <p className="font-medium">Ilani Yayinlama</p>
                    <p className="text-muted-foreground">Taslak ilani "Acik" durumuna getirin.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="bg-purple-100 text-purple-800">3</Badge>
                  <div>
                    <p className="font-medium">Aday Ekleme</p>
                    <p className="text-muted-foreground">"Yeni Aday" ile aday havuzuna kisi ekleyin.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="bg-orange-100 text-orange-800">4</Badge>
                  <div>
                    <p className="font-medium">Basvuru Olusturma</p>
                    <p className="text-muted-foreground">Ilan detayinda "Basvuru Ekle" ile adayi ilana basvurun.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="bg-pink-100 text-pink-800">5</Badge>
                  <div>
                    <p className="font-medium">Surec Takibi</p>
                    <p className="text-muted-foreground">Basvuru durumlarini guncelleyin (On Eleme, Mulakat, Teklif vb.)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 bg-amber-50 p-4 rounded-lg">
              <h3 className="font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Ipuclari
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Is tanimi ve gereksinimleri net bir sekilde yazin</li>
                <li>Aday havuzunu duzenli olarak guncelleyin</li>
                <li>Referans adaylarina oncelik verin</li>
                <li>Mulakat geri bildirimlerini hizli girin</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setIsGuideOpen(false)}>Anladim</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Ilan</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOpenings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acik Pozisyon</CardTitle>
            <Briefcase className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openPositions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Aday</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCandidates}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Basvuru</CardTitle>
            <UserPlus className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalApplications}</div>
          </CardContent>
        </Card>
      </div>

      {/* Arama ve Filtre */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ilan veya aday ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {activeTab === "openings" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Durum filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Durumlar</SelectItem>
              <SelectItem value="DRAFT">Taslak</SelectItem>
              <SelectItem value="OPEN">Acik</SelectItem>
              <SelectItem value="ON_HOLD">Beklemede</SelectItem>
              <SelectItem value="FILLED">Dolduruldu</SelectItem>
              <SelectItem value="CLOSED">Kapandi</SelectItem>
            </SelectContent>
          </Select>
        )}
        {activeTab === "requests" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Durum filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Durumlar</SelectItem>
              <SelectItem value="DRAFT">Taslak</SelectItem>
              <SelectItem value="PENDING">Onay Bekliyor</SelectItem>
              <SelectItem value="APPROVED">Onaylandi</SelectItem>
              <SelectItem value="REJECTED">Reddedildi</SelectItem>
              <SelectItem value="IN_PROGRESS">Islemde</SelectItem>
              <SelectItem value="COMPLETED">Tamamlandi</SelectItem>
              <SelectItem value="CANCELLED">Iptal</SelectItem>
            </SelectContent>
          </Select>
        )}
        {activeTab === "job-applications" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Durum filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Durumlar</SelectItem>
              <SelectItem value="PENDING">Beklemede</SelectItem>
              <SelectItem value="REVIEWING">Inceleniyor</SelectItem>
              <SelectItem value="SHORTLISTED">On Eleme</SelectItem>
              <SelectItem value="INTERVIEW">Mulakat</SelectItem>
              <SelectItem value="ACCEPTED">Kabul Edildi</SelectItem>
              <SelectItem value="REJECTED">Reddedildi</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="job-applications">
            Is Basvurulari ({filteredJobApplications.length})
            {pendingJobApps > 0 && (
              <Badge className="ml-2 bg-orange-500">{pendingJobApps}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Eleman Talepleri ({filteredRequests.length})
            {pendingRequests > 0 && hasFullAccess && (
              <Badge className="ml-2 bg-yellow-500">{pendingRequests}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="openings">Acik Pozisyonlar ({filteredOpenings.length})</TabsTrigger>
          <TabsTrigger value="candidates">Aday Havuzu ({filteredCandidates.length})</TabsTrigger>
          <TabsTrigger value="analiz">Analiz</TabsTrigger>
          <TabsTrigger value="sinavlar">Sınavlar</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Eleman Talepleri</CardTitle>
              <CardDescription>
                Departmanlardan gelen eleman talepleri
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm || statusFilter !== "all" ? "Aramanizla eslesen talep bulunamadi." : "Henuz eleman talebi yok."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Talep No</TableHead>
                      <TableHead>Pozisyon</TableHead>
                      <TableHead>Departman</TableHead>
                      <TableHead>Talep Eden</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Kisi</TableHead>
                      <TableHead>Oncelik</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Tarih</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-sm">{req.requestNumber}</TableCell>
                        <TableCell className="font-medium">{req.title}</TableCell>
                        <TableCell>{req.department}</TableCell>
                        <TableCell>{req.requesterName}</TableCell>
                        <TableCell>{requestTypeLabels[req.requestType]}</TableCell>
                        <TableCell>{req.headcount}</TableCell>
                        <TableCell>
                          <Badge className={priorityColors[req.priority]}>
                            {priorityLabels[req.priority]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={requestStatusColors[req.status]}>
                            {requestStatusLabels[req.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(req.createdAt), "d MMM", { locale: tr })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Islemler</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => {
                                setSelectedRequest(req)
                                setIsRequestDetailOpen(true)
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                Detay Gor
                              </DropdownMenuItem>
                              {req.status === "DRAFT" && req.requesterEmail === session?.user?.email && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleRequestAction(req.id, "submit")}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Onaya Gonder
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => handleDeleteRequest(req.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Sil
                                  </DropdownMenuItem>
                                </>
                              )}
                              {req.status === "PENDING" && hasFullAccess && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleRequestAction(req.id, "approve")}>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Onayla
                                  </DropdownMenuItem>
                                </>
                              )}
                              {req.status === "APPROVED" && hasFullAccess && !req.jobOpening && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleRequestAction(req.id, "create_opening")}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Ilan Olustur
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openings">
          <Card>
            <CardHeader>
              <CardTitle>Is Ilanlari</CardTitle>
              <CardDescription>
                Tum acik pozisyonlar ve basvuru durumlari
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredOpenings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm || statusFilter !== "all" ? "Aramanizla eslesen ilan bulunamadi." : "Henuz is ilani olusturulmamis."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kod</TableHead>
                      <TableHead>Pozisyon</TableHead>
                      <TableHead>Departman</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Oncelik</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Basvuru</TableHead>
                      <TableHead>Kadro</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOpenings.map((opening) => (
                      <TableRow key={opening.id}>
                        <TableCell className="font-mono text-sm">{opening.code}</TableCell>
                        <TableCell className="font-medium">{opening.title}</TableCell>
                        <TableCell>{opening.department}</TableCell>
                        <TableCell>{employmentTypeLabels[opening.employmentType]}</TableCell>
                        <TableCell>
                          <Badge className={priorityColors[opening.priority]}>
                            {priorityLabels[opening.priority]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[opening.status]}>
                            {statusLabels[opening.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{opening._count.applications}</TableCell>
                        <TableCell>
                          {opening.filledCount}/{opening.headcount}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Islemler</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => fetchOpeningDetail(opening.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Detay Gor
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Durum Degistir</DropdownMenuLabel>
                              {opening.status === "DRAFT" && (
                                <DropdownMenuItem onClick={() => handleStatusChange(opening.id, "OPEN")}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Yayinla
                                </DropdownMenuItem>
                              )}
                              {opening.status === "OPEN" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleStatusChange(opening.id, "ON_HOLD")}>
                                    <Pause className="h-4 w-4 mr-2" />
                                    Beklet
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(opening.id, "FILLED")}>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Dolduruldu
                                  </DropdownMenuItem>
                                </>
                              )}
                              {opening.status === "ON_HOLD" && (
                                <DropdownMenuItem onClick={() => handleStatusChange(opening.id, "OPEN")}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Tekrar Ac
                                </DropdownMenuItem>
                              )}
                              {["DRAFT", "OPEN", "ON_HOLD"].includes(opening.status) && (
                                <DropdownMenuItem onClick={() => handleStatusChange(opening.id, "CANCELLED")}>
                                  <Ban className="h-4 w-4 mr-2" />
                                  Iptal Et
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteOpening(opening.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="candidates">
          <Card>
            <CardHeader>
              <CardTitle>Aday Havuzu</CardTitle>
              <CardDescription>
                Tum adaylar ve basvuru gecmisleri
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Aramanizla eslesen aday bulunamadi." : "Henuz aday kaydedilmemis."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ad Soyad</TableHead>
                      <TableHead>E-posta</TableHead>
                      <TableHead>Mevcut Pozisyon</TableHead>
                      <TableHead>Sirket</TableHead>
                      <TableHead>Deneyim</TableHead>
                      <TableHead>Kaynak</TableHead>
                      <TableHead>Basvuru</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCandidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">
                          {candidate.firstName} {candidate.lastName}
                        </TableCell>
                        <TableCell>{candidate.email}</TableCell>
                        <TableCell>{candidate.currentTitle || "-"}</TableCell>
                        <TableCell>{candidate.currentCompany || "-"}</TableCell>
                        <TableCell>
                          {candidate.yearsOfExperience
                            ? `${candidate.yearsOfExperience} yil`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {sourceLabels[candidate.source]}
                          </Badge>
                        </TableCell>
                        <TableCell>{candidate._count.applications}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Islemler</DropdownMenuLabel>
                              {candidate.phone && (
                                <DropdownMenuItem>
                                  <Phone className="h-4 w-4 mr-2" />
                                  {candidate.phone}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <Mail className="h-4 w-4 mr-2" />
                                E-posta Gonder
                              </DropdownMenuItem>
                              {candidate.linkedinUrl && (
                                <DropdownMenuItem asChild>
                                  <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer">
                                    LinkedIn Profili
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteCandidate(candidate.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="job-applications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Is Basvurulari
              </CardTitle>
              <CardDescription>
                Web sitesi uzerinden gelen is basvurulari
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredJobApplications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm || statusFilter !== "all" ? "Aramanizla eslesen basvuru bulunamadi." : "Henuz is basvurusu yok."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Basvuru No</TableHead>
                      <TableHead>Ad Soyad</TableHead>
                      <TableHead>Pozisyon</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Egitim</TableHead>
                      <TableHead>Kaynak</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Tarih</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJobApplications.map((app) => (
                      <TableRow
                        key={app.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => router.push(`/strategic-hr/recruitment/job-applications/${app.id}`)}
                      >
                        <TableCell className="font-mono text-sm">{app.applicationNumber}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {app.photoUrl ? (
                              <img
                                src={app.photoUrl}
                                alt={app.fullName}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="w-4 h-4 text-gray-500" />
                              </div>
                            )}
                            {app.fullName}
                          </div>
                        </TableCell>
                        <TableCell>{app.requestedPosition || "-"}</TableCell>
                        <TableCell>{app.mobilePhone || "-"}</TableCell>
                        <TableCell>
                          {app.educationLevel ? educationLevelLabels[app.educationLevel] || app.educationLevel : "-"}
                        </TableCell>
                        <TableCell>
                          {app.referralSource ? (
                            <Badge variant="outline">
                              {referralSourceLabels[app.referralSource] || app.referralSource}
                            </Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={jobAppStatusColors[app.status] || "bg-gray-100 text-gray-800"}>
                            {jobAppStatusLabels[app.status] || app.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(app.createdAt), "d MMM yyyy", { locale: tr })}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Islemler</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => fetchJobAppDetail(app.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Detay Gor (Inline)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Durum Degistir</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleJobAppStatusChange(app.id, "REVIEWING")}>
                                <Eye className="h-4 w-4 mr-2" />
                                Inceleniyor
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleJobAppStatusChange(app.id, "SHORTLISTED")}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                On Eleme
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleJobAppStatusChange(app.id, "INTERVIEW")}>
                                <Users className="h-4 w-4 mr-2" />
                                Mulakat
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleJobAppStatusChange(app.id, "ACCEPTED")}>
                                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                                Kabul Et
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleJobAppStatusChange(app.id, "REJECTED")}>
                                <XCircle className="h-4 w-4 mr-2 text-red-600" />
                                Reddet
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteJobApp(app.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analiz">
          <div className="space-y-4">
            <TimeToHirePanel />
            <SourceBreakdownPanel />
            <RejectionReasonsPanel />
          </div>
        </TabsContent>

        <TabsContent value="sinavlar">
          <AssessmentPanel />
        </TabsContent>
      </Tabs>

      {/* Is Basvurusu Detay Modal */}
      <Dialog open={isJobAppDetailOpen} onOpenChange={setIsJobAppDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedJobApp && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {selectedJobApp.photoUrl ? (
                      <img
                        src={selectedJobApp.photoUrl}
                        alt={selectedJobApp.fullName}
                        className="w-16 h-20 rounded-lg object-cover border"
                      />
                    ) : (
                      <div className="w-16 h-20 rounded-lg bg-gray-200 flex items-center justify-center border">
                        <User className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <DialogTitle className="text-xl">{selectedJobApp.fullName}</DialogTitle>
                      <DialogDescription className="flex items-center gap-2 mt-1">
                        <span className="font-mono">{selectedJobApp.applicationNumber}</span>
                        <Badge className={jobAppStatusColors[selectedJobApp.status] || "bg-gray-100 text-gray-800"}>
                          {jobAppStatusLabels[selectedJobApp.status] || selectedJobApp.status}
                        </Badge>
                      </DialogDescription>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Temel Bilgiler */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedJobApp.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${selectedJobApp.email}`} className="text-blue-600 hover:underline">
                        {selectedJobApp.email}
                      </a>
                    </div>
                  )}
                  {selectedJobApp.mobilePhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${selectedJobApp.mobilePhone}`} className="text-blue-600 hover:underline">
                        {selectedJobApp.mobilePhone}
                      </a>
                    </div>
                  )}
                  {selectedJobApp.birthDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(selectedJobApp.birthDate), "d MMMM yyyy", { locale: tr })}</span>
                    </div>
                  )}
                  {selectedJobApp.gender && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Cinsiyet: </span>
                      <span>{genderLabels[selectedJobApp.gender] || selectedJobApp.gender}</span>
                    </div>
                  )}
                  {selectedJobApp.requestedPosition && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Talep Edilen Pozisyon: </span>
                      <span className="font-medium">{selectedJobApp.requestedPosition}</span>
                    </div>
                  )}
                  {selectedJobApp.expectedSalary && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Beklenen Maas: </span>
                      <span className="font-medium">{selectedJobApp.expectedSalary.toLocaleString()} TL</span>
                    </div>
                  )}
                  {selectedJobApp.availableStartDate && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Ise Baslama: </span>
                      <span>{format(new Date(selectedJobApp.availableStartDate), "d MMM yyyy", { locale: tr })}</span>
                    </div>
                  )}
                  {selectedJobApp.educationLevel && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Egitim: </span>
                      <span>{educationLevelLabels[selectedJobApp.educationLevel] || selectedJobApp.educationLevel}</span>
                    </div>
                  )}
                  {selectedJobApp.referralSource && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Kaynak: </span>
                      <span>{referralSourceLabels[selectedJobApp.referralSource] || selectedJobApp.referralSource}</span>
                    </div>
                  )}
                </div>

                {/* Dijital Imza */}
                {selectedJobApp.digitalSignature && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Dijital Imza</span>
                    </div>
                    <p className="text-sm text-green-600 mt-1">
                      {selectedJobApp.fullName} tarafindan {selectedJobApp.signatureDate} tarihinde dijital olarak imzalanmistir.
                    </p>
                  </div>
                )}

                {/* Basvuru Tarihi */}
                <div className="text-sm text-muted-foreground">
                  Basvuru Tarihi: {format(new Date(selectedJobApp.createdAt), "d MMMM yyyy HH:mm", { locale: tr })}
                </div>

                {/* IK Notlari */}
                <div>
                  <Label>IK Notlari</Label>
                  <Textarea
                    defaultValue={selectedJobApp.notes || ""}
                    placeholder="Bu basvuru hakkinda notlariniz..."
                    rows={3}
                    onBlur={(e) => handleJobAppNotesUpdate(selectedJobApp.id, e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Durum Degistirme */}
                <div>
                  <Label>Durum Degistir</Label>
                  <Select
                    value={selectedJobApp.status}
                    onValueChange={(v) => {
                      handleJobAppStatusChange(selectedJobApp.id, v)
                      setSelectedJobApp({ ...selectedJobApp, status: v })
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Beklemede</SelectItem>
                      <SelectItem value="REVIEWING">Inceleniyor</SelectItem>
                      <SelectItem value="SHORTLISTED">On Eleme</SelectItem>
                      <SelectItem value="INTERVIEW">Mulakat</SelectItem>
                      <SelectItem value="ACCEPTED">Kabul Edildi</SelectItem>
                      <SelectItem value="REJECTED">Reddedildi</SelectItem>
                      <SelectItem value="WITHDRAWN">Geri Cekildi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(`/strategic-hr/recruitment/job-applications/${selectedJobApp.id}`, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Tam Detay
                </Button>
                <Button variant="destructive" onClick={() => handleDeleteJobApp(selectedJobApp.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Sil
                </Button>
                <Button variant="outline" onClick={() => setIsJobAppDetailOpen(false)}>
                  Kapat
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ret nedeni (kök-neden) modalı — REJECTED'da zorunlu */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ret Nedeni</DialogTitle>
            <DialogDescription>Başvuruyu reddetmek için bir kök-neden seçin (zorunlu).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ret Nedeni</Label>
              <Select value={rejectReasonId} onValueChange={setRejectReasonId}>
                <SelectTrigger><SelectValue placeholder="Neden seçin…" /></SelectTrigger>
                <SelectContent>
                  {(["TEKLIF_REDDI", "ISE_ALMAMA", "SUREC_KAYBI"] as const).map((kat) => {
                    const grup = rejectReasons.filter((r) => r.category === kat)
                    if (grup.length === 0) return null
                    return (
                      <div key={kat}>
                        <div className="px-2 py-1 text-xs font-semibold text-slate-400">{RET_KATEGORI_ETIKET[kat]}</div>
                        {grup.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                      </div>
                    )
                  })}
                </SelectContent>
              </Select>
              {rejectReasons.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Tanımlı ret nedeni yok — "Analiz → Ret Nedenleri" bölümünden ekleyin.</p>
              )}
            </div>
            <div>
              <Label>Detay Not (opsiyonel)</Label>
              <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Serbest metin açıklama…" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Vazgeç</Button>
            <Button variant="destructive" disabled={!rejectReasonId} onClick={confirmReject}>Reddet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
