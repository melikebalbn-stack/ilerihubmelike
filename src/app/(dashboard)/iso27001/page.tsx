"use client"

import { useState, useEffect, useMemo } from "react"
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
import { Progress } from "@/components/ui/progress"
import {
  Shield,
  FileCheck,
  ClipboardCheck,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Calendar,
  TrendingUp,
  PenTool,
  Download,
  Loader2,
  Package,
  GraduationCap,
  AlertCircle,
  XCircle,
  Users,
  Server,
} from "lucide-react"
import Link from "next/link"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

// Dashboard istatistikleri için interface
interface DashboardStats {
  documents: {
    total: number
    approved: number
    pendingApproval: number
    needsReview: number
  }
  controls: {
    total: number
    implemented: number
    partiallyImplemented: number
    notImplemented: number
    notApplicable: number
    byCategory?: {
      organizational: { total: number; implemented: number }
      people: { total: number; implemented: number }
      physical: { total: number; implemented: number }
      technological: { total: number; implemented: number }
    }
  }
  signatures: {
    pending: number
    completed: number
  }
  audits: {
    planned: number
    inProgress: number
    openFindings: number
  }
  risks: {
    total: number
    high: number
    medium: number
    low: number
  }
  trainings?: {
    total: number
    completed: number
    digitalSignatures: number
  }
  incidents?: {
    total: number
    open: number
    resolved: number
  }
  managementReview?: {
    total: number
    lastReviewDate: string | null
  }
}

// Grafik renkleri
const CONTROL_COLORS = {
  implemented: "#22c55e",
  partial: "#eab308",
  notImplemented: "#ef4444",
  notApplicable: "#94a3b8",
}

const RISK_COLORS = {
  high: "#ef4444",
  medium: "#f97316",
  low: "#22c55e",
}

export default function Iso27001DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats>({
    documents: { total: 0, approved: 0, pendingApproval: 0, needsReview: 0 },
    controls: { total: 93, implemented: 0, partiallyImplemented: 0, notImplemented: 0, notApplicable: 0 },
    signatures: { pending: 0, completed: 0 },
    audits: { planned: 0, inProgress: 0, openFindings: 0 },
    risks: { total: 0, high: 0, medium: 0, low: 0 },
    trainings: { total: 0, completed: 0, digitalSignatures: 0 },
    incidents: { total: 0, open: 0, resolved: 0 },
    managementReview: { total: 0, lastReviewDate: null },
  })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/iso27001/stats")
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error("Stats alinamadi:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  // Kontrol uyumluluk yüzdesi (N/A hariç)
  const compliancePercentage = useMemo(() => {
    const applicable = stats.controls.total - stats.controls.notApplicable
    if (applicable <= 0) return 0
    return Math.round((stats.controls.implemented / applicable) * 100)
  }, [stats.controls])

  // Kontrol dağılımı pie chart verisi
  const controlPieData = useMemo(() => [
    { name: "Uygulanmis", value: stats.controls.implemented, color: CONTROL_COLORS.implemented },
    { name: "Kismen", value: stats.controls.partiallyImplemented, color: CONTROL_COLORS.partial },
    { name: "Uygulanmamis", value: stats.controls.notImplemented, color: CONTROL_COLORS.notImplemented },
    { name: "Uygulanamaz", value: stats.controls.notApplicable, color: CONTROL_COLORS.notApplicable },
  ].filter(d => d.value > 0), [stats.controls])

  // Risk dağılımı pie chart verisi
  const riskPieData = useMemo(() => [
    { name: "Yuksek", value: stats.risks.high, color: RISK_COLORS.high },
    { name: "Orta", value: stats.risks.medium, color: RISK_COLORS.medium },
    { name: "Dusuk", value: stats.risks.low, color: RISK_COLORS.low },
  ].filter(d => d.value > 0), [stats.risks])

  // Kategori bazlı kontrol verisi (API'den gelen gerçek veriler)
  const categoryBarData = useMemo(() => {
    const cat = stats.controls.byCategory
    if (cat) {
      return [
        { name: "Organizasyonel", total: cat.organizational.total, implemented: cat.organizational.implemented },
        { name: "Insan", total: cat.people.total, implemented: cat.people.implemented },
        { name: "Fiziksel", total: cat.physical.total, implemented: cat.physical.implemented },
        { name: "Teknolojik", total: cat.technological.total, implemented: cat.technological.implemented },
      ]
    }
    // Fallback veriler
    return [
      { name: "Organizasyonel", total: 37, implemented: 0 },
      { name: "Insan", total: 8, implemented: 0 },
      { name: "Fiziksel", total: 14, implemented: 0 },
      { name: "Teknolojik", total: 34, implemented: 0 },
    ]
  }, [stats.controls.byCategory])

  // Denetçi paketi indirme
  const handleExportAuditPackage = async () => {
    setExporting(true)
    try {
      const res = await fetch("/api/iso27001/audit-package")
      if (res.ok) {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `ISO27001-Denetim-Paketi-${new Date().toISOString().split("T")[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      }
    } catch (error) {
      console.error("Paket indirilemedi:", error)
    } finally {
      setExporting(false)
    }
  }

  // Denetim hazırlık durumu
  const auditReadiness = useMemo(() => {
    // SoA kontrolü: Kontrollerin yarısından fazlası değerlendirilmiş olmalı (implemented + partial + N/A)
    const controlsReviewed = stats.controls.implemented + stats.controls.partiallyImplemented + stats.controls.notApplicable
    const soaCompleted = controlsReviewed > (stats.controls.total / 2)

    const checks = [
      { name: "Bilgi Guvenligi Politikasi", status: stats.documents.approved > 0 },
      { name: "Risk Degerlendirmesi", status: stats.risks.total >= 5 }, // En az 5 risk kaydı
      { name: "SoA (Uygulanabilirlik Beyani)", status: soaCompleted },
      { name: "Ic Denetim", status: stats.audits.planned > 0 || stats.audits.inProgress > 0 },
      { name: "Yonetim Gozden Gecirme", status: (stats.managementReview?.total || 0) > 0 },
      { name: "Farkindalik Egitimleri", status: (stats.trainings?.digitalSignatures || 0) > 0 },
      { name: "Olay Yonetimi", status: true }, // Modül mevcut
      { name: "Dokumante Bilgi", status: stats.documents.total >= 3 }, // En az 3 doküman
    ]
    const completed = checks.filter(c => c.status).length
    return { checks, completed, total: checks.length, percentage: Math.round((completed / checks.length) * 100) }
  }, [stats])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            ISO 27001 Bilgi Guvenligi Yonetim Sistemi
          </h1>
          <p className="text-muted-foreground">
            Bilgi guvenligi dokumanlari, kontroller ve denetim yonetimi
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/iso27001/audit-package">
              <Package className="h-4 w-4 mr-2" />
              Denetci Paketi
            </Link>
          </Button>
          <Button onClick={handleExportAuditPackage} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Paketi Indir
          </Button>
        </div>
      </div>

      {/* Denetim Hazırlık Durumu */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            Denetim Hazirlik Durumu
          </CardTitle>
          <CardDescription>ISO 27001:2022 sertifikasyon denetimi icin hazirlik</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Genel Hazirlik</span>
                <span className="text-2xl font-bold text-blue-600">{auditReadiness.percentage}%</span>
              </div>
              <Progress value={auditReadiness.percentage} className="h-3" />
              <p className="text-xs text-muted-foreground mt-2">
                {auditReadiness.completed} / {auditReadiness.total} gereksinim karsilandi
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {auditReadiness.checks.map((check, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {check.status ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span className={check.status ? "text-green-700" : "text-red-600"}>{check.name}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ana İstatistik Kartları */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Uyumluluk Durumu */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uyumluluk</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{compliancePercentage}%</div>
            <Progress value={compliancePercentage} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.controls.implemented} / {stats.controls.total - stats.controls.notApplicable} kontrol
            </p>
          </CardContent>
        </Card>

        {/* Dokümanlar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dokumanlar</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.documents.total}</div>
            <div className="flex gap-1 mt-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {stats.documents.approved} Onayli
              </Badge>
              {stats.documents.pendingApproval > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {stats.documents.pendingApproval} Bekliyor
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Riskler */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Riskler</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.risks.total}</div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {stats.risks.high > 0 && (
                <Badge className="bg-red-100 text-red-700 text-xs">{stats.risks.high} Yuksek</Badge>
              )}
              {stats.risks.medium > 0 && (
                <Badge className="bg-orange-100 text-orange-700 text-xs">{stats.risks.medium} Orta</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Eğitimler */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egitimler</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trainings?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.trainings?.digitalSignatures || 0} dijital imza
            </p>
          </CardContent>
        </Card>

        {/* Olaylar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Olaylar</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.incidents?.total || 0}</div>
            <div className="flex gap-1 mt-2">
              {(stats.incidents?.open || 0) > 0 && (
                <Badge className="bg-orange-100 text-orange-700 text-xs">{stats.incidents?.open} Acik</Badge>
              )}
              <Badge className="bg-green-100 text-green-700 text-xs">{stats.incidents?.resolved || 0} Cozuldu</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grafikler */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Kontrol Dağılımı */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kontrol Uygulama Durumu</CardTitle>
            <CardDescription>93 Annex A kontrolunun dagilimi</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : controlPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={controlPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {controlPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} kontrol`, ""]}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                Henuz veri yok
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kategori Bazlı Uygulama */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kategori Bazli Uyumluluk</CardTitle>
            <CardDescription>4 ana kategori icin uygulama durumu</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryBarData} layout="vertical">
                  <XAxis type="number" domain={[0, 40]} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#e2e8f0" name="Toplam" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="implemented" fill="#22c55e" name="Uygulanan" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk ve Denetim */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Risk Dağılımı */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-orange-500" />
              Risk Dagilimi
            </CardTitle>
            <CardDescription>Acik risklerin seviye dagilimi</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.risks.total > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={riskPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {riskPieData.map((entry, index) => (
                        <Cell key={`risk-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded bg-red-50">
                    <div className="text-xl font-bold text-red-600">{stats.risks.high}</div>
                    <div className="text-xs text-red-600">Yuksek</div>
                  </div>
                  <div className="p-2 rounded bg-orange-50">
                    <div className="text-xl font-bold text-orange-600">{stats.risks.medium}</div>
                    <div className="text-xs text-orange-600">Orta</div>
                  </div>
                  <div className="p-2 rounded bg-green-50">
                    <div className="text-xl font-bold text-green-600">{stats.risks.low}</div>
                    <div className="text-xs text-green-600">Dusuk</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <Scale className="h-12 w-12 mb-2 opacity-20" />
                <p>Henuz risk kaydedilmemis</p>
              </div>
            )}
            <Button asChild className="w-full mt-4" variant="outline">
              <Link href="/iso27001/risks">Risk Analizine Git</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Denetim Özeti */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-blue-500" />
              Denetim Ozeti
            </CardTitle>
            <CardDescription>Ic denetim durumu ve bulgular</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border">
                  <div className="text-2xl font-bold text-blue-600">{stats.audits.planned}</div>
                  <div className="text-xs text-muted-foreground">Planlanan</div>
                </div>
                <div className="p-3 rounded-lg border">
                  <div className="text-2xl font-bold text-yellow-600">{stats.audits.inProgress}</div>
                  <div className="text-xs text-muted-foreground">Devam Eden</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-red-600">{stats.audits.openFindings}</div>
                    <div className="text-xs text-red-600">Acik Bulgu</div>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
              </div>
            </div>
            <Button asChild className="w-full mt-4" variant="outline">
              <Link href="/iso27001/audits">Denetimlere Git</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Hızlı Erişim Kartları */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* SoA */}
        <Card className="hover:shadow-md transition-shadow border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileCheck className="h-4 w-4 text-blue-600" />
              SoA (Uygulanabilirlik)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Toplam Kontrol</span>
                <Badge variant="outline">93</Badge>
              </div>
              <div className="flex justify-between">
                <span>Uygulanan</span>
                <Badge className="bg-green-100 text-green-700">{stats.controls.implemented}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Uygulanamaz</span>
                <Badge variant="secondary">{stats.controls.notApplicable}</Badge>
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/iso27001/soa">SoA Tablosuna Git</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Olay Yönetimi */}
        <Card className="hover:shadow-md transition-shadow border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              Olay Yonetimi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Toplam Olay</span>
                <Badge variant="outline">{stats.incidents?.total || 0}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Acik</span>
                <Badge className="bg-orange-100 text-orange-700">{stats.incidents?.open || 0}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Cozulen</span>
                <Badge className="bg-green-100 text-green-700">{stats.incidents?.resolved || 0}</Badge>
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/iso27001/incidents">Olay Yonetimine Git</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Eğitimler */}
        <Card className="hover:shadow-md transition-shadow border-purple-200 bg-purple-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <GraduationCap className="h-4 w-4 text-purple-600" />
              Farkindalik Egitimleri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Toplam Egitim</span>
                <Badge variant="outline">{stats.trainings?.total || 0}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Tamamlanan</span>
                <Badge className="bg-green-100 text-green-700">{stats.trainings?.completed || 0}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Dijital Imza</span>
                <Badge variant="secondary">{stats.trainings?.digitalSignatures || 0}</Badge>
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/iso27001/trainings">Egitimlere Git</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Yönetim Gözden Geçirme */}
        <Card className="hover:shadow-md transition-shadow border-cyan-200 bg-cyan-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-cyan-600" />
              Yonetim Toplantisi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Toplam</span>
                <Badge variant="outline">{stats.managementReview?.total || 0}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Son Toplanti</span>
                <span className="text-muted-foreground text-xs">
                  {stats.managementReview?.lastReviewDate
                    ? new Date(stats.managementReview.lastReviewDate).toLocaleDateString("tr-TR")
                    : "Henuz yok"}
                </span>
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm">
              <Link href="/iso27001/management-review">Toplantilara Git</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Diğer Modüller */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Dokümanlar */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-blue-500" />
              Dokuman Yonetimi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Toplam</span>
                <Badge variant="outline">{stats.documents.total}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Onayli</span>
                <Badge className="bg-green-100 text-green-700">{stats.documents.approved}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Onay Bekliyor</span>
                <Badge variant="secondary">{stats.documents.pendingApproval}</Badge>
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm" variant="outline">
              <Link href="/iso27001/documents">Dokumanlara Git</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Kontroller */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardCheck className="h-4 w-4 text-green-500" />
              Kontrol Listesi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Uygulanan
                </span>
                <span className="font-medium">{stats.controls.implemented}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-yellow-500" />
                  Kismen
                </span>
                <span className="font-medium">{stats.controls.partiallyImplemented}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  Bekleyen
                </span>
                <span className="font-medium">{stats.controls.notImplemented}</span>
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm" variant="outline">
              <Link href="/iso27001/controls">Kontrolleri Gor</Link>
            </Button>
          </CardContent>
        </Card>

        {/* İç Denetim */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardCheck className="h-4 w-4 text-purple-500" />
              Ic Denetim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Planlanan</span>
                <Badge>{stats.audits.planned}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Devam Eden</span>
                <Badge variant="secondary">{stats.audits.inProgress}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Acik Bulgu</span>
                <Badge variant="destructive">{stats.audits.openFindings}</Badge>
              </div>
            </div>
            <Button asChild className="w-full mt-3" size="sm" variant="outline">
              <Link href="/iso27001/audits">Denetimlere Git</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Denetçi Paketi Bilgi Notu */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Package className="h-8 w-8 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-green-900">Denetim Icin Hazir</h3>
              <p className="text-sm text-green-700 mt-1">
                Denetci Rapor Paketi sayesinde tum BGYS verilerinizi tek bir JSON dosyasinda indirebilirsiniz.
                Bu paket; Statement of Applicability (SoA), risk degerlendirmesi, dokuman listesi,
                egitim kayitlari, denetim bulgulari ve tum kanit kayitlarini icerir.
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Badge className="bg-green-100 text-green-700">SoA Raporu</Badge>
                <Badge className="bg-green-100 text-green-700">Risk Analizi</Badge>
                <Badge className="bg-green-100 text-green-700">Egitim Kayitlari</Badge>
                <Badge className="bg-green-100 text-green-700">Denetim Bulgulari</Badge>
                <Badge className="bg-green-100 text-green-700">Olay Kayitlari</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
