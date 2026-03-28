"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Ticket,
  Timer,
  Star,
  RefreshCw,
  ArrowUpRight,
  Loader2,
  FileDown,
  Eye,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// Türkçe karakterleri ASCII'ye dönüştür (PDF için)
const turkishToAscii = (text: string): string => {
  const charMap: Record<string, string> = {
    'ı': 'i', 'İ': 'I',
    'ş': 's', 'Ş': 'S',
    'ğ': 'g', 'Ğ': 'G',
    'ü': 'u', 'Ü': 'U',
    'ö': 'o', 'Ö': 'O',
    'ç': 'c', 'Ç': 'C',
  }
  return text.replace(/[ışğüöçİŞĞÜÖÇ]/g, char => charMap[char] || char)
}

interface ReportData {
  period: number
  summary: {
    totalTickets: number
    openTickets: number
    resolvedTickets: number
    closedTickets: number
    slaBreached: number
    avgResolutionTime: number
    avgResponseTime: number
    avgSatisfaction: number
    resolutionRate: number
  }
  byPriority: Record<string, number>
  byType: Record<string, number>
  byStatus: Record<string, number>
  byCategory: Array<{ name: string; color: string; count: number }>
  individualPerformance: Array<{
    email: string
    name: string
    totalAssigned: number
    resolved: number
    closed: number
    avgResponseTime: number
    avgResolutionTime: number
    slaBreached: number
    avgSatisfaction: number
  }>
  dailyTrend: Array<{ date: string; created: number; resolved: number }>
}

interface PersonDetail {
  email: string
  name: string
  totalAssigned: number
  resolved: number
  closed: number
  avgResponseTime: number
  avgResolutionTime: number
  slaBreached: number
  avgSatisfaction: number
  tickets?: Array<{
    id: string
    ticketNumber: string
    subject: string
    status: string
    priority: string
    createdAt: string
    resolvedAt: string | null
    respondedAt: string | null
    slaResolutionBreached: boolean
  }>
}

export default function ITReportsPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReportData | null>(null)
  const [period, setPeriod] = useState("30")
  const [selectedPerson, setSelectedPerson] = useState<PersonDetail | null>(null)
  const [personDetailOpen, setPersonDetailOpen] = useState(false)
  const [loadingPersonDetail, setLoadingPersonDetail] = useState(false)

  // Sadece IT Manager veya Admin erişebilir
  const canAccessReports = session?.user?.role === "IT_MANAGER" ||
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "SUPER_ADMIN"

  useEffect(() => {
    if (status === "authenticated" && !canAccessReports) {
      redirect("/dashboard")
    }
  }, [status, canAccessReports])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/reports?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data)
      }
    } catch (error) {
      console.error("Rapor yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchReport()
    }
  }, [session, period])

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} dk`
    } else if (hours < 24) {
      return `${Math.round(hours * 10) / 10} saat`
    } else {
      return `${Math.round(hours / 24 * 10) / 10} gun`
    }
  }

  // Personel detayını yükle
  const loadPersonDetail = async (person: ReportData["individualPerformance"][0]) => {
    setSelectedPerson(person)
    setPersonDetailOpen(true)
    setLoadingPersonDetail(true)

    try {
      const res = await fetch(`/api/tickets/reports/person?email=${encodeURIComponent(person.email)}&period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedPerson({ ...person, tickets: data.tickets })
      }
    } catch (error) {
      console.error("Personel detayi yuklenemedi:", error)
    } finally {
      setLoadingPersonDetail(false)
    }
  }

  // PDF olarak indir
  const downloadPDF = () => {
    if (!report) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Başlık
    doc.setFontSize(20)
    doc.text("IT Destek Raporu", pageWidth / 2, 20, { align: "center" })

    doc.setFontSize(12)
    doc.text(turkishToAscii(`Donem: Son ${period} gun`), pageWidth / 2, 28, { align: "center" })
    doc.text(turkishToAscii(`Olusturma Tarihi: ${new Date().toLocaleDateString("tr-TR")}`), pageWidth / 2, 35, { align: "center" })

    // Özet
    doc.setFontSize(14)
    doc.text(turkishToAscii("Genel Ozet"), 14, 50)

    const summaryData = [
      [turkishToAscii("Toplam Ticket"), report.summary.totalTickets.toString()],
      [turkishToAscii("Acik Ticket"), report.summary.openTickets.toString()],
      [turkishToAscii("Cozulen Ticket"), report.summary.resolvedTickets.toString()],
      [turkishToAscii("Cozum Orani"), `%${report.summary.resolutionRate}`],
      [turkishToAscii("Ort. Yanit Suresi"), turkishToAscii(formatDuration(report.summary.avgResponseTime))],
      [turkishToAscii("Ort. Cozum Suresi"), turkishToAscii(formatDuration(report.summary.avgResolutionTime))],
      [turkishToAscii("SLA Ihlali"), report.summary.slaBreached.toString()],
      [turkishToAscii("Memnuniyet Puani"), `${report.summary.avgSatisfaction.toFixed(1)}/5`],
    ]

    autoTable(doc, {
      startY: 55,
      head: [["Metrik", "Deger"]],
      body: summaryData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    })

    // Bireysel Performans
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    doc.setFontSize(14)
    doc.text(turkishToAscii("Bireysel Performans"), 14, finalY + 15)

    const performanceData = report.individualPerformance.map(p => {
      const resRate = p.totalAssigned > 0
        ? Math.round(((p.resolved + p.closed) / p.totalAssigned) * 100)
        : 0
      return [
        turkishToAscii(p.name),
        p.totalAssigned.toString(),
        (p.resolved + p.closed).toString(),
        `%${resRate}`,
        turkishToAscii(formatDuration(p.avgResponseTime)),
        turkishToAscii(formatDuration(p.avgResolutionTime)),
        p.slaBreached.toString(),
        p.avgSatisfaction > 0 ? p.avgSatisfaction.toFixed(1) : "-",
      ]
    })

    autoTable(doc, {
      startY: finalY + 20,
      head: [["Personel", "Atanan", "Cozulen", "Oran", "Ort.Yanit", "Ort.Cozum", "SLA Ihl.", "Memn."]],
      body: performanceData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
    })

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        turkishToAscii(`Sayfa ${i} / ${pageCount} - ILERIHub IT Raporlari`),
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      )
    }

    doc.save(`IT-Raporu-${new Date().toISOString().split("T")[0]}.pdf`)
  }

  // Personel PDF raporu indir
  const downloadPersonPDF = (person: PersonDetail) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Başlık
    doc.setFontSize(18)
    doc.text(turkishToAscii("Bireysel Performans Raporu"), pageWidth / 2, 20, { align: "center" })

    doc.setFontSize(14)
    doc.text(turkishToAscii(person.name), pageWidth / 2, 30, { align: "center" })

    doc.setFontSize(10)
    doc.text(person.email, pageWidth / 2, 37, { align: "center" })
    doc.text(turkishToAscii(`Donem: Son ${period} gun | Tarih: ${new Date().toLocaleDateString("tr-TR")}`), pageWidth / 2, 44, { align: "center" })

    // Özet Metrikler
    const resRate = person.totalAssigned > 0
      ? Math.round(((person.resolved + person.closed) / person.totalAssigned) * 100)
      : 0

    const metricsData = [
      [turkishToAscii("Toplam Atanan Ticket"), person.totalAssigned.toString()],
      [turkishToAscii("Cozulen Ticket"), (person.resolved + person.closed).toString()],
      [turkishToAscii("Cozum Orani"), `%${resRate}`],
      [turkishToAscii("Ortalama Yanit Suresi"), turkishToAscii(formatDuration(person.avgResponseTime))],
      [turkishToAscii("Ortalama Cozum Suresi"), turkishToAscii(formatDuration(person.avgResolutionTime))],
      [turkishToAscii("SLA Ihlali"), person.slaBreached.toString()],
      [turkishToAscii("Memnuniyet Puani"), person.avgSatisfaction > 0 ? `${person.avgSatisfaction.toFixed(1)}/5` : turkishToAscii("Degerlendirilmedi")],
    ]

    autoTable(doc, {
      startY: 55,
      head: [["Metrik", "Deger"]],
      body: metricsData,
      theme: "striped",
      headStyles: { fillColor: [34, 197, 94] },
    })

    // Ticket Listesi
    if (person.tickets && person.tickets.length > 0) {
      const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
      doc.setFontSize(12)
      doc.text(turkishToAscii("Ticket Listesi"), 14, finalY + 15)

      const ticketData = person.tickets.map(t => [
        t.ticketNumber,
        turkishToAscii(t.subject.length > 30 ? t.subject.substring(0, 30) + "..." : t.subject),
        turkishToAscii(statusLabels[t.status] || t.status),
        turkishToAscii(priorityLabels[t.priority] || t.priority),
        new Date(t.createdAt).toLocaleDateString("tr-TR"),
        t.resolvedAt ? new Date(t.resolvedAt).toLocaleDateString("tr-TR") : "-",
        t.slaResolutionBreached ? "Evet" : "Hayir",
      ])

      autoTable(doc, {
        startY: finalY + 20,
        head: [[turkishToAscii("Ticket No"), "Konu", "Durum", "Oncelik", "Olusturma", "Cozum", "SLA Ihl."]],
        body: ticketData,
        theme: "striped",
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 8 },
      })
    }

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        turkishToAscii(`Sayfa ${i} / ${pageCount} - ILERIHub Bireysel Performans Raporu`),
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      )
    }

    doc.save(`${turkishToAscii(person.name).replace(/\s+/g, "-")}-Performans-${new Date().toISOString().split("T")[0]}.pdf`)
  }

  const priorityLabels: Record<string, string> = {
    TICKET_CRITICAL: "Kritik",
    TICKET_HIGH: "Yuksek",
    NORMAL: "Normal",
    TICKET_LOW: "Dusuk",
  }

  const priorityColors: Record<string, string> = {
    TICKET_CRITICAL: "bg-red-500",
    TICKET_HIGH: "bg-orange-500",
    NORMAL: "bg-blue-500",
    TICKET_LOW: "bg-gray-400",
  }

  const typeLabels: Record<string, string> = {
    INCIDENT: "Olay",
    SERVICE_REQUEST: "Hizmet Talebi",
    PROBLEM: "Problem",
    CHANGE_REQUEST: "Degisiklik",
  }

  const statusLabels: Record<string, string> = {
    NEW: "Yeni",
    ASSIGNED: "Atandi",
    IN_PROGRESS: "Islemde",
    PENDING: "Beklemede",
    ON_HOLD: "Askida",
    RESOLVED: "Cozuldu",
    CLOSED: "Kapatildi",
    CANCELLED: "Iptal",
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!canAccessReports) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            IT Raporlari
          </h1>
          <p className="text-muted-foreground">
            Destek talepleri ve performans analizleri
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Son 7 gun</SelectItem>
              <SelectItem value="30">Son 30 gun</SelectItem>
              <SelectItem value="90">Son 90 gun</SelectItem>
              <SelectItem value="365">Son 1 yil</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
          <Button onClick={downloadPDF} disabled={!report || loading}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF Indir
          </Button>
        </div>
      </div>

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Ticket className="h-4 w-4" />
                  Toplam Ticket
                </CardDescription>
                <CardTitle className="text-xl sm:text-3xl">{report.summary.totalTickets}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <span className="text-green-500 font-medium">{report.summary.closedTickets}</span>
                  <span className="mx-1">kapatildi,</span>
                  <span className="text-orange-500 font-medium">{report.summary.openTickets}</span>
                  <span className="ml-1">acik</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Timer className="h-4 w-4" />
                  Ort. Cozum Suresi
                </CardDescription>
                <CardTitle className="text-xl sm:text-3xl">{formatDuration(report.summary.avgResolutionTime)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  Ilk yanit: {formatDuration(report.summary.avgResponseTime)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Cozum Orani
                </CardDescription>
                <CardTitle className="text-xl sm:text-3xl">{report.summary.resolutionRate}%</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={report.summary.resolutionRate} className="h-2" />
              </CardContent>
            </Card>

            <Card className={report.summary.slaBreached > 0 ? "border-red-300" : ""}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className={`h-4 w-4 ${report.summary.slaBreached > 0 ? "text-red-500" : ""}`} />
                  SLA Ihlali
                </CardDescription>
                <CardTitle className={`text-xl sm:text-3xl ${report.summary.slaBreached > 0 ? "text-red-500" : ""}`}>
                  {report.summary.slaBreached}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {report.summary.totalTickets > 0
                    ? `%${Math.round((report.summary.slaBreached / report.summary.totalTickets) * 100)} ihlal orani`
                    : "Ihlal yok"
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Satisfaction & Distribution */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Memnuniyet */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Memnuniyet Puani
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">
                    {report.summary.avgSatisfaction.toFixed(1)}
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-6 w-6 ${
                          star <= Math.round(report.summary.avgSatisfaction)
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">5 uzerinden</p>
              </CardContent>
            </Card>

            {/* Oncelik Dagilimi */}
            <Card>
              <CardHeader>
                <CardTitle>Oncelik Dagilimi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(report.byPriority).map(([priority, count]) => (
                    <div key={priority} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${priorityColors[priority]}`} />
                      <span className="flex-1 text-sm">{priorityLabels[priority]}</span>
                      <span className="font-medium">{count}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {report.summary.totalTickets > 0
                          ? `%${Math.round((count / report.summary.totalTickets) * 100)}`
                          : "0%"
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tip Dagilimi */}
            <Card>
              <CardHeader>
                <CardTitle>Talep Tipi Dagilimi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(report.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <span className="flex-1 text-sm">{typeLabels[type]}</span>
                      <span className="font-medium">{count}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {report.summary.totalTickets > 0
                          ? `%${Math.round((count / report.summary.totalTickets) * 100)}`
                          : "0%"
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category & Status Distribution */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Kategori Dagilimi */}
            <Card>
              <CardHeader>
                <CardTitle>Kategori Dagilimi</CardTitle>
              </CardHeader>
              <CardContent>
                {report.byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Kategori verisi yok</p>
                ) : (
                  <div className="space-y-3">
                    {report.byCategory.map((cat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="flex-1 text-sm">{cat.name}</span>
                        <span className="font-medium">{cat.count}</span>
                        <div className="w-20">
                          <Progress
                            value={(cat.count / report.summary.totalTickets) * 100}
                            className="h-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Durum Dagilimi */}
            <Card>
              <CardHeader>
                <CardTitle>Durum Dagilimi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(report.byStatus).map(([status, count]) => (
                    count > 0 && (
                      <div key={status} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <span className="text-sm">{statusLabels[status]}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    )
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Son 7 Gunluk Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 h-32">
                {report.dailyTrend.map((day, idx) => {
                  const maxValue = Math.max(...report.dailyTrend.map(d => Math.max(d.created, d.resolved)), 1)
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex gap-0.5 items-end h-20">
                        <div
                          className="w-3 bg-blue-500 rounded-t"
                          style={{ height: `${(day.created / maxValue) * 100}%`, minHeight: day.created > 0 ? '4px' : '0' }}
                          title={`Olusturulan: ${day.created}`}
                        />
                        <div
                          className="w-3 bg-green-500 rounded-t"
                          style={{ height: `${(day.resolved / maxValue) * 100}%`, minHeight: day.resolved > 0 ? '4px' : '0' }}
                          title={`Cozulen: ${day.resolved}`}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(day.date).toLocaleDateString('tr-TR', { weekday: 'short' })}
                      </div>
                      <div className="text-[10px] font-medium">
                        {day.created}/{day.resolved}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span>Olusturulan</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>Cozulen</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Bireysel Performans
              </CardTitle>
              <CardDescription>
                IT ekibi uyeleri performans metrikleri
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.individualPerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Henuz atanmis ticket yok
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Personel</TableHead>
                        <TableHead className="text-center">Atanan</TableHead>
                        <TableHead className="text-center">Cozulen</TableHead>
                        <TableHead className="text-center">Cozum Orani</TableHead>
                        <TableHead className="text-center">Ort. Yanit</TableHead>
                        <TableHead className="text-center">Ort. Cozum</TableHead>
                        <TableHead className="text-center">SLA Ihlali</TableHead>
                        <TableHead className="text-center">Memnuniyet</TableHead>
                        <TableHead className="text-center">Islemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.individualPerformance.map((person, idx) => {
                        const resolutionRate = person.totalAssigned > 0
                          ? Math.round(((person.resolved + person.closed) / person.totalAssigned) * 100)
                          : 0
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{person.name}</p>
                                <p className="text-xs text-muted-foreground">{person.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {person.totalAssigned}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-green-600">{person.resolved + person.closed}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Progress value={resolutionRate} className="w-12 h-2" />
                                <span className="text-xs">{resolutionRate}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">
                              {formatDuration(person.avgResponseTime)}
                            </TableCell>
                            <TableCell className="text-center text-sm">
                              {formatDuration(person.avgResolutionTime)}
                            </TableCell>
                            <TableCell className="text-center">
                              {person.slaBreached > 0 ? (
                                <Badge variant="destructive">{person.slaBreached}</Badge>
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {person.avgSatisfaction > 0 ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                  <span>{person.avgSatisfaction.toFixed(1)}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => loadPersonDetail(person)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Detay
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Personel Detay Dialog */}
      <Dialog open={personDetailOpen} onOpenChange={setPersonDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Bireysel Performans Detayi
            </DialogTitle>
            <DialogDescription>
              {selectedPerson?.name} - Son {period} gun
            </DialogDescription>
          </DialogHeader>

          {selectedPerson && (
            <div className="space-y-6">
              {/* Özet Kartlar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Atanan</CardDescription>
                    <CardTitle className="text-2xl">{selectedPerson.totalAssigned}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Cozulen</CardDescription>
                    <CardTitle className="text-2xl text-green-600">
                      {selectedPerson.resolved + selectedPerson.closed}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Ort. Yanit</CardDescription>
                    <CardTitle className="text-xl">{formatDuration(selectedPerson.avgResponseTime)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Ort. Cozum</CardDescription>
                    <CardTitle className="text-xl">{formatDuration(selectedPerson.avgResolutionTime)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Ticket Listesi */}
              <div>
                <h3 className="font-medium mb-3">Ticket Listesi</h3>
                {loadingPersonDetail ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : selectedPerson.tickets && selectedPerson.tickets.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket No</TableHead>
                          <TableHead>Konu</TableHead>
                          <TableHead className="text-center">Durum</TableHead>
                          <TableHead className="text-center">Oncelik</TableHead>
                          <TableHead className="text-center">Olusturma</TableHead>
                          <TableHead className="text-center">Cozum</TableHead>
                          <TableHead className="text-center">SLA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPerson.tickets.map((ticket) => (
                          <TableRow key={ticket.id}>
                            <TableCell className="font-medium">{ticket.ticketNumber}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{ticket.subject}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{statusLabels[ticket.status]}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className={`w-2 h-2 rounded-full mx-auto ${priorityColors[ticket.priority]}`} />
                            </TableCell>
                            <TableCell className="text-center text-sm">
                              {new Date(ticket.createdAt).toLocaleDateString("tr-TR")}
                            </TableCell>
                            <TableCell className="text-center text-sm">
                              {ticket.resolvedAt
                                ? new Date(ticket.resolvedAt).toLocaleDateString("tr-TR")
                                : "-"
                              }
                            </TableCell>
                            <TableCell className="text-center">
                              {ticket.slaResolutionBreached ? (
                                <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Ticket verisi yuklenemedi
                  </p>
                )}
              </div>

              {/* PDF İndir Butonu */}
              <div className="flex justify-end">
                <Button onClick={() => downloadPersonPDF(selectedPerson)}>
                  <FileDown className="h-4 w-4 mr-2" />
                  PDF Olarak Indir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
