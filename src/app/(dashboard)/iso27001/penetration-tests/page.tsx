"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import {
  ShieldAlert, Plus, Eye, Pen, FileText, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Clock, Shield, ClipboardList, X,
  Wrench, User, Calendar, ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

interface Finding {
  id: string
  findingNumber: string
  severity: string
  title: string
  category: string | null
  description: string | null
  impact: string | null
  recommendation: string | null
  responsiblePerson: string | null
  deadline: string | null
  actionStatus: string
  actionNote: string | null
  resolvedAt: string | null
  resolvedByName: string | null
}

interface PenTest {
  id: string
  testNumber: string
  title: string
  description: string | null
  testDate: string
  testType: string
  scope: string | null
  methodology: string | null
  tester: string
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  infoCount: number
  reportFileUrl: string | null
  reportFileName: string | null
  status: string
  conductedByName: string | null
  approvedByName: string | null
  approvedAt: string | null
  createdAt: string
  _count: { signatures: number }
}

interface Signature {
  id: string
  signerName: string
  signerEmail: string
  signerTitle: string | null
  signerDepartment: string | null
  signatureCode: string
  signedAt: string
  signatureType: string
  notes: string | null
}

const testTypeLabels: Record<string, string> = {
  VULNERABILITY_ASSESSMENT: "Zafiyet Değerlendirme",
  INTERNAL_PENTEST: "İç Sızma Testi",
  EXTERNAL_PENTEST: "Dış Sızma Testi",
  WEB_APP: "Web Uygulama Testi",
  SOCIAL_ENGINEERING: "Sosyal Mühendislik",
}

const statusLabels: Record<string, string> = {
  PLANNED: "Planlandı",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  APPROVED: "Onaylandı",
}

const statusColors: Record<string, string> = {
  PLANNED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
}

const signatureTypeLabels: Record<string, string> = {
  APPROVAL: "Onay",
  REVIEW: "Gözden Geçirme",
  ACKNOWLEDGMENT: "Bilgilenme",
  WITNESS: "Tanık",
}

const severityLabels: Record<string, string> = {
  CRITICAL: "Kritik",
  HIGH: "Yüksek",
  MEDIUM: "Orta",
  LOW: "Düşük",
  INFO: "Bilgi",
}

const severityColors: Record<string, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-500 text-white",
  LOW: "bg-green-500 text-white",
  INFO: "bg-blue-100 text-blue-700",
}

const actionStatusLabels: Record<string, string> = {
  OPEN: "Açık",
  IN_PROGRESS: "Devam Ediyor",
  RESOLVED: "Çözüldü",
  ACCEPTED: "Kabul Edildi",
}

const actionStatusColors: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
  ACCEPTED: "bg-gray-100 text-gray-700",
}

export default function PenetrationTestsPage() {
  const { data: session } = useSession()
  const [tests, setTests] = useState<PenTest[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, completed: 0, approved: 0, pending: 0, totalCritical: 0 })
  const [statusFilter, setStatusFilter] = useState("all")

  // Seçili test
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Yeni test dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    title: "", description: "", testDate: new Date().toISOString().split("T")[0],
    testType: "VULNERABILITY_ASSESSMENT", scope: "", methodology: "", tester: "",
    criticalCount: "0", highCount: "0", mediumCount: "0", lowCount: "0", infoCount: "0",
    reportFileUrl: "", reportFileName: "", status: "PLANNED",
  })

  // İmza dialog
  const [showSignDialog, setShowSignDialog] = useState(false)
  const [signingTestId, setSigningTestId] = useState("")
  const [signingTestTitle, setSigningTestTitle] = useState("")
  const [signing, setSigning] = useState(false)
  const [signatureType, setSignatureType] = useState("APPROVAL")
  const [signatureNotes, setSignatureNotes] = useState("")

  // Bulgu düzenleme dialog
  const [showFindingDialog, setShowFindingDialog] = useState(false)
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null)
  const [updatingFinding, setUpdatingFinding] = useState(false)
  const [findingForm, setFindingForm] = useState({
    actionStatus: "OPEN", actionNote: "", responsiblePerson: "", deadline: "",
  })

  // Bulgu detay dialog
  const [showFindingDetailDialog, setShowFindingDetailDialog] = useState(false)
  const [detailFinding, setDetailFinding] = useState<Finding | null>(null)

  const fetchTests = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      const res = await fetch(`/api/iso27001/penetration-tests?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTests(data.tests || [])
        setStats(data.stats || stats)
      }
    } catch {
      toast.error("Veriler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTests() }, [statusFilter])

  const handleExpandTest = async (testId: string) => {
    if (expandedTestId === testId) {
      setExpandedTestId(null)
      return
    }
    setExpandedTestId(testId)
    setLoadingDetails(true)
    try {
      const [findingsRes, signaturesRes] = await Promise.all([
        fetch(`/api/iso27001/penetration-tests/${testId}/findings`),
        fetch(`/api/iso27001/penetration-tests/${testId}/sign`),
      ])
      if (findingsRes.ok) setFindings(await findingsRes.json())
      if (signaturesRes.ok) setSignatures(await signaturesRes.json())
    } catch {
      toast.error("Detaylar yüklenemedi")
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error("Başlık zorunludur"); return }
    setCreating(true)
    try {
      const res = await fetch("/api/iso27001/penetration-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`${data.test.testNumber} numaralı test oluşturuldu`)
        setShowCreateDialog(false)
        setForm({
          title: "", description: "", testDate: new Date().toISOString().split("T")[0],
          testType: "VULNERABILITY_ASSESSMENT", scope: "", methodology: "", tester: "",
          criticalCount: "0", highCount: "0", mediumCount: "0", lowCount: "0", infoCount: "0",
          reportFileUrl: "", reportFileName: "", status: "PLANNED",
        })
        fetchTests()
      } else {
        const data = await res.json()
        toast.error(data.error || "Hata oluştu")
      }
    } catch { toast.error("Bağlantı hatası") }
    finally { setCreating(false) }
  }

  const handleSign = async () => {
    setSigning(true)
    try {
      const res = await fetch(`/api/iso27001/penetration-tests/${signingTestId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureType, notes: signatureNotes }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(
          <div>
            <p className="font-semibold">Test imzalandı!</p>
            <p className="text-sm">İmza Kodu: <span className="font-mono">{data.signature.signatureCode}</span></p>
          </div>
        )
        setShowSignDialog(false)
        setSignatureNotes("")
        fetchTests()
        // Açık test varsa imzaları yenile
        if (expandedTestId === signingTestId) {
          const sigRes = await fetch(`/api/iso27001/penetration-tests/${signingTestId}/sign`)
          if (sigRes.ok) setSignatures(await sigRes.json())
        }
      } else {
        toast.error(data.error || "İmzalama hatası")
      }
    } catch { toast.error("Bağlantı hatası") }
    finally { setSigning(false) }
  }

  const handleUpdateFinding = async () => {
    if (!editingFinding || !expandedTestId) return
    setUpdatingFinding(true)
    try {
      const res = await fetch(`/api/iso27001/penetration-tests/${expandedTestId}/findings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId: editingFinding.id,
          actionStatus: findingForm.actionStatus,
          actionNote: findingForm.actionNote,
          responsiblePerson: findingForm.responsiblePerson,
          deadline: findingForm.deadline || null,
        }),
      })
      if (res.ok) {
        toast.success("Bulgu güncellendi")
        setShowFindingDialog(false)
        // Bulguları yenile
        const fRes = await fetch(`/api/iso27001/penetration-tests/${expandedTestId}/findings`)
        if (fRes.ok) setFindings(await fRes.json())
      } else {
        const data = await res.json()
        toast.error(data.error || "Hata oluştu")
      }
    } catch { toast.error("Bağlantı hatası") }
    finally { setUpdatingFinding(false) }
  }

  const openFindingEdit = (finding: Finding) => {
    setEditingFinding(finding)
    setFindingForm({
      actionStatus: finding.actionStatus,
      actionNote: finding.actionNote || "",
      responsiblePerson: finding.responsiblePerson || "",
      deadline: finding.deadline ? finding.deadline.split("T")[0] : "",
    })
    setShowFindingDialog(true)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (res.ok) {
        const data = await res.json()
        setForm(prev => ({
          ...prev,
          reportFileUrl: data.url,
          reportFileName: file.name,
        }))
        toast.success("Dosya yüklendi")
      }
    } catch { toast.error("Dosya yüklenemedi") }
  }

  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd.MM.yyyy", { locale: tr }) : "-"
  const fmtDateTime = (d: string | null) => d ? format(new Date(d), "dd.MM.yyyy HH:mm", { locale: tr }) : "-"

  const handlePrintReport = (test: PenTest) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) { toast.error("Popup engelleyici aktif olabilir"); return }

    const totalFindings = test.criticalCount + test.highCount + test.mediumCount + test.lowCount + test.infoCount

    const findingsRows = findings.map(f => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;font-family:monospace;font-size:12px">${f.findingNumber}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;color:#fff;font-size:12px;background:${
            f.severity === "CRITICAL" ? "#dc2626" : f.severity === "HIGH" ? "#f97316" : f.severity === "MEDIUM" ? "#eab308" : f.severity === "LOW" ? "#22c55e" : "#3b82f6"
          }">${severityLabels[f.severity] || f.severity}</span>
        </td>
        <td style="padding:8px;border:1px solid #ddd;font-weight:500">${f.title}</td>
        <td style="padding:8px;border:1px solid #ddd;color:#666">${f.category || "-"}</td>
        <td style="padding:8px;border:1px solid #ddd">${f.description || "-"}</td>
        <td style="padding:8px;border:1px solid #ddd">${f.recommendation || "-"}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;background:${
            f.actionStatus === "OPEN" ? "#fee2e2" : f.actionStatus === "IN_PROGRESS" ? "#dbeafe" : f.actionStatus === "RESOLVED" ? "#dcfce7" : "#f3f4f6"
          };color:${
            f.actionStatus === "OPEN" ? "#b91c1c" : f.actionStatus === "IN_PROGRESS" ? "#1d4ed8" : f.actionStatus === "RESOLVED" ? "#15803d" : "#374151"
          }">${actionStatusLabels[f.actionStatus] || f.actionStatus}</span>
        </td>
        <td style="padding:8px;border:1px solid #ddd">${f.responsiblePerson || "-"}</td>
        <td style="padding:8px;border:1px solid #ddd">${f.deadline ? fmtDate(f.deadline) : "-"}</td>
      </tr>
    `).join("")

    const signaturesRows = signatures.map(sig => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;font-weight:500">${sig.signerName}</td>
        <td style="padding:8px;border:1px solid #ddd">${sig.signerTitle || "-"}</td>
        <td style="padding:8px;border:1px solid #ddd">${sig.signerDepartment || "-"}</td>
        <td style="padding:8px;border:1px solid #ddd">${signatureTypeLabels[sig.signatureType] || sig.signatureType}</td>
        <td style="padding:8px;border:1px solid #ddd">${fmtDateTime(sig.signedAt)}</td>
        <td style="padding:8px;border:1px solid #ddd;font-family:monospace;font-size:11px">${sig.signatureCode}</td>
      </tr>
    `).join("")

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${test.testNumber} - Sızma Testi Raporu</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { margin: 15mm; size: A4 landscape; } }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; line-height: 1.5; margin: 0; padding: 20px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a5f; padding-bottom: 15px; margin-bottom: 25px; }
    .header img { height: 60px; }
    .header-right { text-align: right; }
    .header-right h1 { margin: 0; font-size: 20px; color: #1e3a5f; }
    .header-right p { margin: 4px 0 0; color: #666; font-size: 13px; }
    .doc-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 20px; }
    .doc-info table { width: 100%; border-collapse: collapse; }
    .doc-info td { padding: 5px 12px; font-size: 13px; }
    .doc-info td:first-child { font-weight: 600; color: #475569; width: 160px; }
    .section-title { font-size: 16px; font-weight: 700; color: #1e3a5f; margin: 25px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #e2e8f0; }
    table.data { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px; }
    table.data th { background: #1e3a5f; color: #fff; padding: 8px; border: 1px solid #1e3a5f; text-align: left; font-size: 11px; }
    table.data td { padding: 8px; border: 1px solid #ddd; vertical-align: top; }
    table.data tr:nth-child(even) { background: #f8fafc; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
    .summary-card { text-align: center; padding: 12px; border-radius: 6px; }
    .summary-card .count { font-size: 24px; font-weight: 700; }
    .summary-card .label { font-size: 11px; margin-top: 2px; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 2px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    .scope-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 13px; white-space: pre-wrap; margin-bottom: 10px; }
    .no-print { margin: 20px 0; text-align: center; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding:10px 30px;background:#1e3a5f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">Yazdır / PDF Olarak Kaydet</button>
  </div>

  <div class="header">
    <img src="/ilerigrouplogo.png" alt="İleri Group" />
    <div class="header-right">
      <h1>Sızma Testi / Zafiyet Değerlendirme Raporu</h1>
      <p>ISO 27001 Annex A.8.8 - Teknik Zafiyetlerin Yönetimi</p>
    </div>
  </div>

  <div class="doc-info">
    <table>
      <tr><td>Doküman No:</td><td>${test.testNumber}</td><td style="font-weight:600;color:#475569;width:160px">Test Tarihi:</td><td>${fmtDate(test.testDate)}</td></tr>
      <tr><td>Test Başlığı:</td><td>${test.title}</td><td style="font-weight:600;color:#475569">Test Tipi:</td><td>${testTypeLabels[test.testType] || test.testType}</td></tr>
      <tr><td>Testi Yapan:</td><td>${test.tester}</td><td style="font-weight:600;color:#475569">Durum:</td><td>${statusLabels[test.status] || test.status}</td></tr>
      <tr><td>Oluşturma Tarihi:</td><td>${fmtDate(test.createdAt)}</td><td style="font-weight:600;color:#475569">Rapor Tarihi:</td><td>${format(new Date(), "dd.MM.yyyy", { locale: tr })}</td></tr>
    </table>
  </div>

  ${test.description ? `<div class="section-title">Açıklama</div><div class="scope-box">${test.description}</div>` : ""}
  ${test.scope ? `<div class="section-title">Kapsam</div><div class="scope-box">${test.scope}</div>` : ""}
  ${test.methodology ? `<div class="section-title">Metodoloji</div><div class="scope-box">${test.methodology}</div>` : ""}

  <div class="section-title">Bulgu Özeti</div>
  <div class="summary-grid">
    <div class="summary-card" style="background:#fef2f2"><div class="count" style="color:#dc2626">${test.criticalCount}</div><div class="label" style="color:#991b1b">Kritik</div></div>
    <div class="summary-card" style="background:#fff7ed"><div class="count" style="color:#f97316">${test.highCount}</div><div class="label" style="color:#9a3412">Yüksek</div></div>
    <div class="summary-card" style="background:#fefce8"><div class="count" style="color:#eab308">${test.mediumCount}</div><div class="label" style="color:#854d0e">Orta</div></div>
    <div class="summary-card" style="background:#f0fdf4"><div class="count" style="color:#22c55e">${test.lowCount}</div><div class="label" style="color:#166534">Düşük</div></div>
    <div class="summary-card" style="background:#eff6ff"><div class="count" style="color:#3b82f6">${test.infoCount}</div><div class="label" style="color:#1e40af">Bilgi</div></div>
  </div>
  <p style="font-size:13px;color:#475569"><strong>Toplam Bulgu:</strong> ${totalFindings}</p>

  ${findings.length > 0 ? `
  <div class="section-title">Detaylı Bulgular ve Düzeltici Faaliyetler</div>
  <table class="data">
    <thead>
      <tr>
        <th>No</th><th>Seviye</th><th>Bulgu</th><th>Kategori</th><th>Açıklama</th><th>Öneri</th><th>Durum</th><th>Sorumlu</th><th>Termin</th>
      </tr>
    </thead>
    <tbody>${findingsRows}</tbody>
  </table>
  <p style="font-size:12px;color:#475569">
    Açık: ${findings.filter(f => f.actionStatus === "OPEN").length} |
    Devam Eden: ${findings.filter(f => f.actionStatus === "IN_PROGRESS").length} |
    Çözülen: ${findings.filter(f => f.actionStatus === "RESOLVED").length} |
    Kabul Edilen: ${findings.filter(f => f.actionStatus === "ACCEPTED").length}
  </p>
  ` : "<p style='color:#666;font-style:italic'>Bu test için bulgu kaydı bulunmamaktadır.</p>"}

  ${signatures.length > 0 ? `
  <div class="section-title">Dijital İmzalar</div>
  <table class="data">
    <thead>
      <tr><th>İmzalayan</th><th>Ünvan</th><th>Departman</th><th>İmza Tipi</th><th>Tarih</th><th>İmza Kodu</th></tr>
    </thead>
    <tbody>${signaturesRows}</tbody>
  </table>
  ` : ""}

  <div class="footer">
    <p>Bu rapor İleri Group Bilgi Güvenliği Yönetim Sistemi kapsamında üretilmiştir.</p>
    <p>${test.testNumber} | Oluşturulma: ${fmtDate(test.createdAt)} | Yazdırılma: ${format(new Date(), "dd.MM.yyyy HH:mm", { locale: tr })}</p>
  </div>
</body>
</html>`

    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-red-600" />
            Sızma Testleri ve Zafiyet Değerlendirme
          </h1>
          <p className="text-muted-foreground mt-1">ISO 27001 Annex A.8.8 - Teknik Zafiyetlerin Yönetimi</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Test Ekle
        </Button>
      </div>

      {/* Özet Kartları */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Test</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed + stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onay Bekleyen</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kritik Bulgu</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.totalCritical}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtre */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="w-48">
              <Label>Durum</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="PLANNED">Planlandı</SelectItem>
                  <SelectItem value="IN_PROGRESS">Devam Ediyor</SelectItem>
                  <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
                  <SelectItem value="APPROVED">Onaylandı</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Listesi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Testler</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>
          ) : tests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Henüz sızma testi kaydı bulunmuyor</div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Test No</TableHead>
                  <TableHead>Başlık</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Bulgular</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İmza</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map(test => (
                  <>
                    <TableRow key={test.id} className={expandedTestId === test.id ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => handleExpandTest(test.id)}>
                          {expandedTestId === test.id ?
                            <ChevronUp className="h-4 w-4" /> :
                            <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{test.testNumber}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{test.title}</TableCell>
                      <TableCell className="text-sm">{testTypeLabels[test.testType] || test.testType}</TableCell>
                      <TableCell className="text-sm">{fmtDate(test.testDate)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {test.criticalCount > 0 && <Badge variant="destructive" className="text-xs">{test.criticalCount}K</Badge>}
                          {test.highCount > 0 && <Badge className="bg-orange-500 text-xs">{test.highCount}Y</Badge>}
                          {test.mediumCount > 0 && <Badge className="bg-yellow-500 text-white text-xs">{test.mediumCount}O</Badge>}
                          {test.lowCount > 0 && <Badge className="bg-green-500 text-xs">{test.lowCount}D</Badge>}
                          {test.infoCount > 0 && <Badge variant="secondary" className="text-xs">{test.infoCount}B</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[test.status] || ""}>{statusLabels[test.status] || test.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {test._count.signatures > 0 ? (
                          <Badge variant="outline" className="cursor-pointer" onClick={() => handleExpandTest(test.id)}>
                            <Pen className="h-3 w-3 mr-1" />
                            {test._count.signatures}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" title="İmzala"
                            onClick={() => { setSigningTestId(test.id); setSigningTestTitle(test.title); setShowSignDialog(true) }}>
                            <Pen className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Rapor Yazdır"
                            onClick={() => { if (expandedTestId !== test.id) { handleExpandTest(test.id).then(() => setTimeout(() => handlePrintReport(test), 500)) } else { handlePrintReport(test) } }}>
                            <ClipboardList className="h-4 w-4" />
                          </Button>
                          {test.reportFileUrl && (
                            <Button variant="ghost" size="icon" title="Yüklenen Rapor" asChild>
                              <a href={test.reportFileUrl} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Genişletilmiş Detay */}
                    {expandedTestId === test.id && (
                      <TableRow key={`${test.id}-detail`}>
                        <TableCell colSpan={9} className="p-0">
                          <div className="p-4 bg-muted/30 space-y-4">
                            {loadingDetails ? (
                              <div className="text-center py-6 text-muted-foreground">Yükleniyor...</div>
                            ) : (
                              <>
                                {/* Test Bilgileri Kartı */}
                                <Card>
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                      <Shield className="h-4 w-4 text-blue-600" />
                                      Test Bilgileri
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Tip:</span>{" "}
                                        {testTypeLabels[test.testType]}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Tarih:</span>{" "}
                                        {fmtDate(test.testDate)}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Testi Yapan:</span>{" "}
                                        {test.tester}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Durum:</span>{" "}
                                        <Badge className={statusColors[test.status]}>{statusLabels[test.status]}</Badge>
                                      </div>
                                    </div>
                                    {test.description && (
                                      <div className="mt-3">
                                        <span className="text-muted-foreground text-xs">Açıklama:</span>
                                        <p className="text-sm mt-1">{test.description}</p>
                                      </div>
                                    )}
                                    {test.scope && (
                                      <div className="mt-3">
                                        <span className="text-muted-foreground text-xs">Kapsam:</span>
                                        <p className="text-sm mt-1 whitespace-pre-wrap">{test.scope}</p>
                                      </div>
                                    )}
                                    <div className="mt-3 flex gap-2">
                                      <Button variant="outline" size="sm" onClick={() => handlePrintReport(test)}>
                                        <ClipboardList className="h-4 w-4 mr-2" />
                                        Rapor Yazdır
                                      </Button>
                                      {test.reportFileUrl && (
                                        <Button variant="outline" size="sm" asChild>
                                          <a href={test.reportFileUrl} target="_blank" rel="noopener noreferrer">
                                            <FileText className="h-4 w-4 mr-2" />
                                            Yüklenen Rapor
                                          </a>
                                        </Button>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Düzeltici Faaliyetler Kartı */}
                                <Card>
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                      <Wrench className="h-4 w-4 text-orange-600" />
                                      Düzeltici Faaliyetler
                                      <Badge variant="outline" className="ml-2">{findings.length} Bulgu</Badge>
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {findings.length === 0 ? (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        Bu test için henüz bulgu kaydı bulunmuyor
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="w-[80px]">No</TableHead>
                                              <TableHead className="w-[80px]">Seviye</TableHead>
                                              <TableHead>Bulgu</TableHead>
                                              <TableHead>Kategori</TableHead>
                                              <TableHead>Sorumlu</TableHead>
                                              <TableHead>Termin</TableHead>
                                              <TableHead>Durum</TableHead>
                                              <TableHead className="w-[80px]">İşlem</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {findings.map(f => (
                                              <TableRow key={f.id}>
                                                <TableCell className="font-mono text-xs">{f.findingNumber}</TableCell>
                                                <TableCell>
                                                  <Badge className={`text-xs ${severityColors[f.severity] || ""}`}>
                                                    {severityLabels[f.severity] || f.severity}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                  <button
                                                    className="text-sm font-medium text-left hover:text-blue-600 hover:underline cursor-pointer"
                                                    onClick={() => { setDetailFinding(f); setShowFindingDetailDialog(true) }}
                                                  >
                                                    {f.title}
                                                  </button>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{f.category || "-"}</TableCell>
                                                <TableCell className="text-sm">{f.responsiblePerson || "-"}</TableCell>
                                                <TableCell className="text-sm">{fmtDate(f.deadline)}</TableCell>
                                                <TableCell>
                                                  <Badge className={`text-xs ${actionStatusColors[f.actionStatus] || ""}`}>
                                                    {actionStatusLabels[f.actionStatus] || f.actionStatus}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                                    title="Düzenle" onClick={() => openFindingEdit(f)}>
                                                    <Pen className="h-3 w-3" />
                                                  </Button>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                    {/* Özet bilgi */}
                                    {findings.length > 0 && (
                                      <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                                        <span>Açık: {findings.filter(f => f.actionStatus === "OPEN").length}</span>
                                        <span>Devam: {findings.filter(f => f.actionStatus === "IN_PROGRESS").length}</span>
                                        <span>Çözüldü: {findings.filter(f => f.actionStatus === "RESOLVED").length}</span>
                                        <span>Kabul: {findings.filter(f => f.actionStatus === "ACCEPTED").length}</span>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>

                                {/* Dijital İmzalar Kartı */}
                                <Card>
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                      <CardTitle className="text-base flex items-center gap-2">
                                        <Pen className="h-4 w-4 text-green-600" />
                                        Dijital İmzalar
                                        <Badge variant="outline" className="ml-2">{signatures.length}</Badge>
                                      </CardTitle>
                                      <Button size="sm" variant="outline"
                                        onClick={() => { setSigningTestId(test.id); setSigningTestTitle(test.title); setShowSignDialog(true) }}>
                                        <Pen className="h-3 w-3 mr-1" />
                                        İmzala
                                      </Button>
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    {signatures.length === 0 ? (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        Henüz imza atılmamış
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>İmzalayan</TableHead>
                                            <TableHead>Ünvan / Bölüm</TableHead>
                                            <TableHead>Tip</TableHead>
                                            <TableHead>Tarih</TableHead>
                                            <TableHead>İmza Kodu</TableHead>
                                            <TableHead>Notlar</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {signatures.map(sig => (
                                            <TableRow key={sig.id}>
                                              <TableCell className="font-medium">{sig.signerName}</TableCell>
                                              <TableCell className="text-sm text-muted-foreground">
                                                {[sig.signerTitle, sig.signerDepartment].filter(Boolean).join(" / ") || "-"}
                                              </TableCell>
                                              <TableCell>
                                                <Badge variant="outline">{signatureTypeLabels[sig.signatureType] || sig.signatureType}</Badge>
                                              </TableCell>
                                              <TableCell className="text-sm">
                                                {format(new Date(sig.signedAt), "dd.MM.yyyy HH:mm", { locale: tr })}
                                              </TableCell>
                                              <TableCell className="font-mono text-xs">{sig.signatureCode}</TableCell>
                                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                {sig.notes || "-"}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yeni Test Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Sızma Testi / Zafiyet Değerlendirme</DialogTitle>
            <DialogDescription>Test bilgilerini girin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Başlık *</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Zafiyet Değerlendirme Raporu" />
              </div>
              <div>
                <Label>Test Tipi</Label>
                <Select value={form.testType} onValueChange={v => setForm({ ...form, testType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(testTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Test Tarihi</Label>
                <Input type="date" value={form.testDate} onChange={e => setForm({ ...form, testDate: e.target.value })} />
              </div>
              <div>
                <Label>Testi Yapan</Label>
                <Input value={form.tester} onChange={e => setForm({ ...form, tester: e.target.value })} placeholder="Ad Soyad / Firma" />
              </div>
              <div>
                <Label>Durum</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Kapsam</Label>
              <Textarea value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} rows={2} placeholder="Tarama kapsamındaki sistemler..." />
            </div>
            <div>
              <Label>Metodoloji</Label>
              <Textarea value={form.methodology} onChange={e => setForm({ ...form, methodology: e.target.value })} rows={2} placeholder="Kullanılan tarama yöntemleri..." />
            </div>
            <div>
              <Label className="font-semibold">Bulgu Sayıları</Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
                <div>
                  <Label className="text-xs text-red-600">Kritik</Label>
                  <Input type="number" min="0" value={form.criticalCount} onChange={e => setForm({ ...form, criticalCount: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-orange-600">Yüksek</Label>
                  <Input type="number" min="0" value={form.highCount} onChange={e => setForm({ ...form, highCount: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-yellow-600">Orta</Label>
                  <Input type="number" min="0" value={form.mediumCount} onChange={e => setForm({ ...form, mediumCount: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-green-600">Düşük</Label>
                  <Input type="number" min="0" value={form.lowCount} onChange={e => setForm({ ...form, lowCount: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-blue-600">Bilgi</Label>
                  <Input type="number" min="0" value={form.infoCount} onChange={e => setForm({ ...form, infoCount: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <Label>Rapor Dosyası</Label>
              <Input type="file" accept=".pdf,.html,.doc,.docx" onChange={handleFileUpload} />
              {form.reportFileName && <p className="text-sm text-green-600 mt-1">Yüklendi: {form.reportFileName}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>İptal</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* İmzalama Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dijital İmza</DialogTitle>
            <DialogDescription>{signingTestTitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>İmza Tipi</Label>
              <Select value={signatureType} onValueChange={setSignatureType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(signatureTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notlar (isteğe bağlı)</Label>
              <Textarea value={signatureNotes} onChange={e => setSignatureNotes(e.target.value)} rows={3} placeholder="İmza ile ilgili notlar..." />
            </div>
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
              <p><strong>İmzalayan:</strong> {session?.user?.name}</p>
              <p><strong>E-posta:</strong> {session?.user?.email}</p>
              <p className="mt-2 text-xs">Bu işlem geri alınamaz. İmzanız dijital olarak kaydedilecektir.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignDialog(false)}>İptal</Button>
            <Button onClick={handleSign} disabled={signing}>
              <Pen className="h-4 w-4 mr-2" />
              {signing ? "İmzalanıyor..." : "İmzala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulgu Düzenleme Dialog */}
      <Dialog open={showFindingDialog} onOpenChange={setShowFindingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Düzeltici Faaliyet Güncelle</DialogTitle>
            <DialogDescription>
              {editingFinding?.findingNumber} - {editingFinding?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Durum</Label>
              <Select value={findingForm.actionStatus} onValueChange={v => setFindingForm({ ...findingForm, actionStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(actionStatusLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sorumlu Kişi</Label>
              <Input value={findingForm.responsiblePerson}
                onChange={e => setFindingForm({ ...findingForm, responsiblePerson: e.target.value })}
                placeholder="Ad Soyad" />
            </div>
            <div>
              <Label>Termin Tarihi</Label>
              <Input type="date" value={findingForm.deadline}
                onChange={e => setFindingForm({ ...findingForm, deadline: e.target.value })} />
            </div>
            <div>
              <Label>Düzeltici Faaliyet Notu</Label>
              <Textarea value={findingForm.actionNote}
                onChange={e => setFindingForm({ ...findingForm, actionNote: e.target.value })}
                rows={3} placeholder="Yapılan/yapılacak işlemler..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFindingDialog(false)}>İptal</Button>
            <Button onClick={handleUpdateFinding} disabled={updatingFinding}>
              {updatingFinding ? "Güncelleniyor..." : "Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulgu Detay Dialog */}
      <Dialog open={showFindingDetailDialog} onOpenChange={setShowFindingDetailDialog}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className={severityColors[detailFinding?.severity || ""]}>
                {severityLabels[detailFinding?.severity || ""] || detailFinding?.severity}
              </Badge>
              {detailFinding?.findingNumber} - {detailFinding?.title}
            </DialogTitle>
          </DialogHeader>
          {detailFinding && (
            <div className="space-y-4 text-sm">
              {detailFinding.category && (
                <div>
                  <Label className="text-muted-foreground text-xs">Kategori</Label>
                  <p>{detailFinding.category}</p>
                </div>
              )}
              {detailFinding.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Açıklama</Label>
                  <p className="whitespace-pre-wrap">{detailFinding.description}</p>
                </div>
              )}
              {detailFinding.impact && (
                <div>
                  <Label className="text-muted-foreground text-xs">Etki</Label>
                  <p className="whitespace-pre-wrap">{detailFinding.impact}</p>
                </div>
              )}
              {detailFinding.recommendation && (
                <div>
                  <Label className="text-muted-foreground text-xs">Öneri</Label>
                  <p className="whitespace-pre-wrap">{detailFinding.recommendation}</p>
                </div>
              )}
              <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Durum</Label>
                  <div>
                    <Badge className={actionStatusColors[detailFinding.actionStatus]}>
                      {actionStatusLabels[detailFinding.actionStatus]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Sorumlu</Label>
                  <p>{detailFinding.responsiblePerson || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Termin</Label>
                  <p>{fmtDate(detailFinding.deadline)}</p>
                </div>
                {detailFinding.resolvedAt && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Çözüm Tarihi</Label>
                    <p>{fmtDate(detailFinding.resolvedAt)} - {detailFinding.resolvedByName}</p>
                  </div>
                )}
              </div>
              {detailFinding.actionNote && (
                <div>
                  <Label className="text-muted-foreground text-xs">Düzeltici Faaliyet Notu</Label>
                  <p className="whitespace-pre-wrap bg-muted p-2 rounded">{detailFinding.actionNote}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
