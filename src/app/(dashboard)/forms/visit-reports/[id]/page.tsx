"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Printer,
  Download,
  CheckCircle,
  XCircle,
  Pencil,
  Calendar,
  Clock,
  Building2,
  MapPin,
  Briefcase,
  Users,
  FileText,
  Loader2,
  Mail,
  Send,
  Plus,
  Paperclip
} from "lucide-react"
import { RecipientInput, Recipient } from "@/components/forms/RecipientInput"
import Link from "next/link"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { useSession } from "next-auth/react"
// PDF is dynamically imported in handleDownloadPDF

interface Participant {
  id: string
  name: string
  title: string | null
  company: "ILERI_GROUP" | "VISITED_COMPANY"
}

interface ActionItem {
  id: string
  description: string
  responsible: string
  dueDate: string | null
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
}

interface Attachment {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  createdAt: string
}

interface EmailLog {
  id: string
  sentBy: string
  sentByName: string | null
  recipients: string // JSON string
  sentAt: string
}

interface VisitReport {
  id: string
  reportNumber: string
  visitDate: string
  endDate: string | null
  visitTime: string
  companyName: string
  visitType: string
  location: string | null
  project: string | null
  meetingSummary: string
  additionalNotes: string | null
  nextSteps: string | null
  status: string
  createdBy: { id: string; name: string; email: string; department: string | null }
  approvedBy: { id: string; name: string; email: string } | null
  approvedAt: string | null
  participants: Participant[]
  actionItems: ActionItem[]
  createdAt: string
}

const visitTypeLabels: Record<string, string> = {
  CUSTOMER: "Müşteri Ziyareti",
  SUPPLIER: "Tedarikçi Ziyareti",
  FAIR: "Fuar/Etkinlik",
  TECHNICAL: "Teknik Görüşme",
  AUDIT: "Denetim/Audit",
  TRAINING: "Eğitim",
  OTHER: "Diğer"
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Taslak", variant: "secondary" },
  SENT: { label: "Gönderildi", variant: "default" },
  PENDING: { label: "Onay Bekliyor", variant: "outline" },
  APPROVED: { label: "Onaylandı", variant: "default" },
  REJECTED: { label: "Reddedildi", variant: "destructive" }
}

const actionStatusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Bekliyor", color: "bg-yellow-100 text-yellow-800" },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-blue-100 text-blue-800" },
  COMPLETED: { label: "Tamamlandı", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "İptal", color: "bg-gray-100 text-gray-800" }
}

export default function VisitReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const printRef = useRef<HTMLDivElement>(null)
  const [report, setReport] = useState<VisitReport | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [mailSending, setMailSending] = useState(false)
  const [recipients, setRecipients] = useState<Recipient[]>([{ name: "", email: "" }])

  const id = params.id as string

  useEffect(() => {
    fetchReport()
  }, [id])

  async function fetchReport() {
    try {
      const res = await fetch(`/api/forms/visit-reports/${id}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data)
        // Fetch attachments
        try {
          const attRes = await fetch(`/api/forms/visit-reports/${id}/attachments`)
          if (attRes.ok) {
            const attData = await attRes.json()
            setAttachments(attData)
          }
        } catch {
          console.error("Ekler yüklenemedi")
        }
        // Fetch email logs
        try {
          const logRes = await fetch(`/api/forms/visit-reports/${id}/email-logs`)
          if (logRes.ok) {
            const logData = await logRes.json()
            setEmailLogs(logData)
          }
        } catch {
          console.error("Email logları yüklenemedi")
        }
      } else {
        router.push("/forms/visit-reports")
      }
    } catch {
      console.error("Rapor yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(action: "approve" | "reject") {
    if (!confirm(action === "approve" ? "Raporu onaylamak istiyor musunuz?" : "Raporu reddetmek istiyor musunuz?")) {
      return
    }

    try {
      const res = await fetch(`/api/forms/visit-reports/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      })

      if (res.ok) {
        fetchReport()
      } else {
        const data = await res.json()
        alert(data.error || "İşlem başarısız")
      }
    } catch {
      alert("Bir hata oluştu")
    }
  }

  function handlePrint() {
    window.print()
  }

  async function handleDownloadPDF() {
    if (!report) return

    setPdfLoading(true)
    try {
      // Import dynamically to avoid SSR issues
      const { generateVisitReportPDF } = await import("@/lib/pdf/visit-report-pdf")
      const doc = await generateVisitReportPDF(report)

      // Create blob and download via anchor element (more secure method)
      const blob = doc.output("blob")
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${report.reportNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("PDF indirme hatası:", error)
    } finally {
      setPdfLoading(false)
    }
  }

  function addRecipient() {
    setRecipients([...recipients, { name: "", email: "" }])
  }

  function removeRecipient(index: number) {
    setRecipients(recipients.filter((_, i) => i !== index))
  }

  function updateRecipient(index: number, recipient: Recipient) {
    const updated = [...recipients]
    updated[index] = recipient
    setRecipients(updated)
  }

  async function handleSendMail() {
    if (!report) return

    const validRecipients = recipients.filter(r => r.email.trim())
    if (validRecipients.length === 0) {
      alert("En az bir alıcı ekleyin")
      return
    }

    setMailSending(true)
    try {
      const res = await fetch(`/api/forms/visit-reports/${id}/send-mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: validRecipients })
      })

      if (res.ok) {
        alert("Mail başarıyla gönderildi!")
        setRecipients([{ name: "", email: "" }])
        // Gönderim geçmişini yenile
        try {
          const logRes = await fetch(`/api/forms/visit-reports/${id}/email-logs`)
          if (logRes.ok) {
            const logData = await logRes.json()
            setEmailLogs(logData)
          }
        } catch { /* ignore */ }
      } else {
        const data = await res.json()
        alert(data.error || "Mail gönderilemedi")
      }
    } catch {
      alert("Bir hata oluştu")
    } finally {
      setMailSending(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!report) {
    return null
  }

  const ourPeople = report.participants.filter(p => p.company === "ILERI_GROUP")
  const theirPeople = report.participants.filter(p => p.company === "VISITED_COMPANY")
  const canApprove = session?.user?.permissions?.includes("forms.approve") ?? false

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <Link href="/forms/visit-reports">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl lg:text-3xl font-bold">{report.reportNumber}</h1>
                <Badge variant={statusLabels[report.status]?.variant || "secondary"}>
                  {statusLabels[report.status]?.label || report.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {report.companyName} - {visitTypeLabels[report.visitType]}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {report.status !== "APPROVED" && (
              <Link href={`/forms/visit-reports/${id}/edit`}>
                <Button variant="outline">
                  <Pencil className="h-4 w-4 mr-2" />
                  Düzenle
                </Button>
              </Link>
            )}
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Yazdır
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF} disabled={pdfLoading}>
              {pdfLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {pdfLoading ? "İndiriliyor..." : "PDF İndir"}
            </Button>
            {report.status === "PENDING" && canApprove && (
              <>
                <Button variant="destructive" onClick={() => handleApprove("reject")}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reddet
                </Button>
                <Button onClick={() => handleApprove("approve")}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Onayla
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Print Area */}
        <div id="print-area" ref={printRef}>
          {/* Report Header for Print */}
          <div className="hidden print:block mb-6 pb-4 border-b-2 border-[#1e3a5f]">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-[#1e3a5f]">İLERİ GRUP</h1>
                <p className="text-sm text-gray-600">Savunma Sanayi Çözümleri</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-[#1e3a5f] bg-gray-100 px-4 py-2 rounded">
                  {report.reportNumber}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Oluşturma: {format(new Date(report.createdAt), "dd.MM.yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Temel Bilgiler */}
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="print:pb-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Temel Bilgiler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ziyaret Tarihi</p>
                    <p className="font-medium">
                      {format(new Date(report.visitDate), "dd MMMM yyyy, EEEE", { locale: tr })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Saat</p>
                    <p className="font-medium">{report.visitTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Firma</p>
                    <p className="font-medium">{report.companyName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ziyaret Türü</p>
                    <p className="font-medium">{visitTypeLabels[report.visitType]}</p>
                  </div>
                </div>
                {report.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Konum</p>
                      <p className="font-medium">{report.location}</p>
                    </div>
                  </div>
                )}
                {report.project && (
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Proje/Konu</p>
                      <p className="font-medium">{report.project}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Katılımcılar */}
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="print:pb-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Katılımcılar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">İleri Group&apos;tan</h4>
                  <ul className="space-y-2">
                    {ourPeople.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#1e3a5f]" />
                        <span className="font-medium">{p.name}</span>
                        {p.title && <span className="text-muted-foreground">- {p.title}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">Görüşülen Kişiler</h4>
                  <ul className="space-y-2">
                    {theirPeople.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="font-medium">{p.name}</span>
                        {p.title && <span className="text-muted-foreground">- {p.title}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Görüşme Özeti */}
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="print:pb-2">
              <CardTitle>Görüşme Özeti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {report.meetingSummary}
              </div>
            </CardContent>
          </Card>

          {/* Aksiyon Maddeleri */}
          {report.actionItems.length > 0 && (
            <Card className="print:shadow-none print:border-0">
              <CardHeader className="print:pb-2">
                <CardTitle>Aksiyon Maddeleri</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">Aksiyon</th>
                        <th className="text-left py-2 px-2">Sorumlu</th>
                        <th className="text-left py-2 px-2">Termin</th>
                        <th className="text-left py-2 px-2">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.actionItems.map((action, index) => (
                        <tr key={action.id} className="border-b">
                          <td className="py-2 px-2">{index + 1}</td>
                          <td className="py-2 px-2">{action.description}</td>
                          <td className="py-2 px-2">{action.responsible}</td>
                          <td className="py-2 px-2">
                            {action.dueDate
                              ? format(new Date(action.dueDate), "dd.MM.yyyy")
                              : "-"}
                          </td>
                          <td className="py-2 px-2">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${actionStatusLabels[action.status]?.color || ""}`}>
                              {actionStatusLabels[action.status]?.label || action.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ek Notlar */}
          {(report.additionalNotes || report.nextSteps) && (
            <Card className="print:shadow-none print:border-0">
              <CardHeader className="print:pb-2">
                <CardTitle>Ek Notlar ve Sonuç</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.additionalNotes && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">Toplantı Notları</h4>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {report.additionalNotes}
                    </div>
                  </div>
                )}
                {report.nextSteps && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">Sonraki Adımlar</h4>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {report.nextSteps}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Ekler */}
          {attachments.length > 0 && (
            <Card className="print:shadow-none print:border-0">
              <CardHeader className="print:pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Ekler ({attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      {att.mimeType.startsWith("image/") ? (
                        <img src={att.filePath} alt={att.fileName} className="w-full h-24 object-cover rounded mb-2" />
                      ) : (
                        <div className="w-full h-24 flex items-center justify-center bg-gray-100 rounded mb-2">
                          <FileText className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <p className="text-xs font-medium truncate">{att.fileName}</p>
                      <p className="text-xs text-gray-400">{(att.fileSize / 1024).toFixed(0)} KB</p>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Onay Bilgisi */}
          <Card className="print:shadow-none print:border-0">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div>
                  <span>Oluşturan: </span>
                  <span className="font-medium text-foreground">{report.createdBy.name}</span>
                  <span className="mx-2">•</span>
                  <span>{format(new Date(report.createdAt), "dd.MM.yyyy HH:mm")}</span>
                </div>
                {report.approvedBy && (
                  <div>
                    <span>{report.status === "APPROVED" ? "Onaylayan: " : "İşleyen: "}</span>
                    <span className="font-medium text-foreground">{report.approvedBy.name}</span>
                    {report.approvedAt && (
                      <>
                        <span className="mx-2">•</span>
                        <span>{format(new Date(report.approvedAt), "dd.MM.yyyy HH:mm")}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Print Footer */}
          <div className="hidden print:block mt-8 pt-4 border-t text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Doküman No: {report.reportNumber} | Revizyon: 0</span>
              <span>Oluşturan: {report.createdBy.email}</span>
              <span>ILERIHub</span>
            </div>
          </div>
        </div>

        {/* Raporu Gönder Bölümü */}
        <Card className="no-print">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Raporu Gönder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Alıcılar</p>
              <p className="text-xs text-muted-foreground">
                İsim yazınca Active Directory&apos;den önerilecek, email otomatik gelecek. Manuel de ekleyebilirsiniz.
              </p>
            </div>
            {recipients.map((recipient, index) => (
              <RecipientInput
                key={index}
                recipient={recipient}
                onChange={(r) => updateRecipient(index, r)}
                onRemove={() => removeRecipient(index)}
                canRemove={recipients.length > 1}
              />
            ))}
            <Button variant="outline" size="sm" onClick={addRecipient}>
              <Plus className="h-4 w-4 mr-2" />
              Alıcı Ekle
            </Button>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button onClick={handleSendMail} disabled={mailSending}>
                {mailSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {mailSending ? "Gönderiliyor..." : "Gönder"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Gönderim Geçmişi */}
        {emailLogs.length > 0 && (
          <Card className="no-print">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Gönderim Geçmişi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {emailLogs.map((log) => {
                  let parsedRecipients: { name?: string; email: string }[] = []
                  try {
                    parsedRecipients = JSON.parse(log.recipients)
                  } catch { /* ignore */ }
                  return (
                    <div key={log.id} className="p-3 border rounded-lg bg-gray-50 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {log.sentByName || log.sentBy}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.sentAt), "dd.MM.yyyy HH:mm", { locale: tr })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {parsedRecipients.map((r, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {r.name ? `${r.name} (${r.email})` : r.email}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
