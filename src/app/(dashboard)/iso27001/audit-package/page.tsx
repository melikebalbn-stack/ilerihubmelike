"use client"

import { useState, useEffect } from "react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Shield,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ClipboardCheck,
  Scale,
  GraduationCap,
  Users,
  AlertTriangle,
  Calendar,
  Package,
  FileJson,
  Printer,
} from "lucide-react"
import { toast } from "sonner"

interface AuditPackage {
  meta: {
    title: string
    organization: string
    generatedAt: string
    generatedBy: string
    standard: string
    scope: string
  }
  summary: {
    overallCompliance: number
    stats: {
      documents: { total: number; approved: number; pending: number; signatures: number }
      controls: { total: number; applicable: number; implemented: number; complianceRate: number }
      risks: { total: number; high: number; medium: number; low: number; treated: number }
      audits: { total: number; completed: number; totalFindings: number; openFindings: number }
      trainings: { total: number; completed: number; totalParticipants: number; digitalSignatures: number }
      managementReviews: { total: number; lastReviewDate: string | null }
      incidents: { total: number; open: number; resolved: number; thisYear: number }
    }
  }
  complianceChecklist: {
    items: { requirement: string; status: string }[]
  }
}

export default function AuditPackagePage() {
  const [data, setData] = useState<AuditPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/iso27001/audit-package")
      if (res.ok) {
        const packageData = await res.json()
        setData(packageData)
      }
    } catch (error) {
      console.error("Paket alinamadi:", error)
      toast.error("Veriler yuklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch("/api/iso27001/audit-package")
      if (res.ok) {
        const packageData = await res.json()
        const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: "application/json" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `ISO27001-Denetim-Paketi-${new Date().toISOString().split("T")[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
        toast.success("Denetim paketi indirildi")
      }
    } catch (error) {
      toast.error("Indirme hatasi")
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Veriler yuklenemedi
      </div>
    )
  }

  const { summary, complianceChecklist } = data
  const { stats } = summary

  return (
    <div className="space-y-6 p-6 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Denetci Rapor Paketi
          </h1>
          <p className="text-muted-foreground">
            ISO 27001:2022 denetimi icin hazir rapor paketi
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Yazdir
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Paketi Indir (JSON)
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold">ISO 27001:2022 Denetim Rapor Paketi</h1>
        <p className="text-muted-foreground">ILERI Group - Bilgi Guvenligi Yonetim Sistemi</p>
        <p className="text-sm text-muted-foreground mt-2">
          Olusturma: {new Date().toLocaleDateString("tr-TR")}
        </p>
      </div>

      {/* Genel Uyumluluk */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Genel BGYS Uyumluluk Durumu
          </CardTitle>
          <CardDescription>
            ISO 27001:2022 Annex A kontrollerine genel uyumluluk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Uyumluluk Orani</span>
                <span className="text-2xl font-bold">{summary.overallCompliance}%</span>
              </div>
              <Progress value={summary.overallCompliance} className="h-4" />
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Uygulanan Kontrol</div>
              <div className="text-xl font-bold">
                {stats.controls.implemented} / {stats.controls.applicable}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* İstatistik Özeti */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Dokumanlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.documents.total}</div>
            <div className="text-xs text-muted-foreground">
              {stats.documents.approved} onayli, {stats.documents.signatures} imza
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-green-500" />
              Kontroller
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.controls.implemented}/{stats.controls.applicable}</div>
            <div className="text-xs text-muted-foreground">
              %{stats.controls.complianceRate} uyumluluk
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4 text-orange-500" />
              Riskler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.risks.total}</div>
            <div className="text-xs text-muted-foreground">
              {stats.risks.high} yuksek, {stats.risks.treated} islenmis
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-purple-500" />
              Egitimler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trainings.total}</div>
            <div className="text-xs text-muted-foreground">
              {stats.trainings.digitalSignatures} dijital imza
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detaylı İstatistikler */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Denetim ve Bulgular
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Toplam Denetim</span>
                <Badge variant="outline">{stats.audits.total}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Tamamlanan</span>
                <Badge className="bg-green-100 text-green-700">{stats.audits.completed}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Toplam Bulgu</span>
                <Badge variant="secondary">{stats.audits.totalFindings}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Acik Bulgu</span>
                <Badge className={stats.audits.openFindings > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}>
                  {stats.audits.openFindings}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Guvenlik Olaylari
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Toplam Olay</span>
                <Badge variant="outline">{stats.incidents.total}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Bu Yil</span>
                <Badge variant="secondary">{stats.incidents.thisYear}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Acik Olay</span>
                <Badge className={stats.incidents.open > 0 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}>
                  {stats.incidents.open}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Cozulen</span>
                <Badge className="bg-green-100 text-green-700">{stats.incidents.resolved}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Uyumluluk Kontrol Listesi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ISO 27001:2022 Gereksinim Kontrol Listesi</CardTitle>
          <CardDescription>
            Temel maddelere uyumluluk durumu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Madde</TableHead>
                  <TableHead>Gereksinim</TableHead>
                  <TableHead className="w-[120px]">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complianceChecklist.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">
                      {item.requirement.split(" ")[0]}
                    </TableCell>
                    <TableCell>{item.requirement.split(" ").slice(1).join(" ")}</TableCell>
                    <TableCell>
                      {item.status === "EVET" ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Evet
                        </Badge>
                      ) : item.status === "HAYIR" ? (
                        <Badge className="bg-red-100 text-red-700">
                          <XCircle className="h-3 w-3 mr-1" />
                          Hayir
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Kontrol Et
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Yönetim Gözden Geçirme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Yonetim Gozden Gecirme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Toplam Toplanti</div>
              <div className="text-2xl font-bold">{stats.managementReviews.total}</div>
            </div>
            <div className="border-l pl-4">
              <div className="text-sm text-muted-foreground">Son Toplanti</div>
              <div className="text-lg font-medium">
                {stats.managementReviews.lastReviewDate
                  ? new Date(stats.managementReviews.lastReviewDate).toLocaleDateString("tr-TR")
                  : "Henuz yapilmadi"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bilgi Notu */}
      <Card className="bg-blue-50 border-blue-200 print:hidden">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <FileJson className="h-6 w-6 text-blue-500 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900">Denetim Paketi Hakkinda</h3>
              <p className="text-sm text-blue-700 mt-1">
                Bu rapor paketi, ISO 27001 denetimi icin gerekli tum verileri icerir.
                JSON formatinda indirdiginizde Statement of Applicability (SoA), dokuman listesi,
                risk degerlendirmesi, denetim kayitlari, egitim kayitlari ve daha fazlasi yer alir.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
