"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, FileText, Eye, Pencil, Trash2, Building2, Calendar, Users } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

interface Participant {
  id: string
  name: string
  title: string | null
  company: string
}

interface ActionItem {
  id: string
  description: string
  responsible: string
  dueDate: string | null
  status: string
}

interface VisitReport {
  id: string
  reportNumber: string
  visitDate: string
  companyName: string
  visitType: string
  location: string | null
  project: string | null
  status: string
  createdBy: { id: string; name: string; email: string }
  participants: Participant[]
  actionItems: ActionItem[]
  _count: { attachments: number }
  createdAt: string
}

const visitTypeLabels: Record<string, string> = {
  CUSTOMER: "Müşteri",
  SUPPLIER: "Tedarikçi",
  FAIR: "Fuar/Etkinlik",
  TECHNICAL: "Teknik Görüşme",
  AUDIT: "Denetim",
  TRAINING: "Eğitim",
  OTHER: "Diğer"
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Taslak", variant: "secondary" },
  PENDING: { label: "Onay Bekliyor", variant: "outline" },
  APPROVED: { label: "Onaylandı", variant: "default" },
  REJECTED: { label: "Reddedildi", variant: "destructive" }
}

export default function VisitReportsPage() {
  const [reports, setReports] = useState<VisitReport[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    fetchReports()
  }, [statusFilter])

  async function fetchReports() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      const res = await fetch(`/api/forms/visit-reports?${params}`)
      const data = await res.json()
      setReports(data.reports || [])
    } catch {
      console.error("Raporlar yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = reports.filter(report =>
    report.companyName.toLowerCase().includes(search.toLowerCase()) ||
    report.reportNumber.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(id: string) {
    if (!confirm("Bu raporu silmek istediğinize emin misiniz?")) return

    try {
      const res = await fetch(`/api/forms/visit-reports/${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchReports()
      } else {
        const data = await res.json()
        alert(data.error || "Silme işlemi başarısız")
      }
    } catch {
      alert("Bir hata oluştu")
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold">Ziyaret Raporları</h1>
          <p className="text-muted-foreground">
            Müşteri ve tedarikçi ziyaret raporlarını yönetin
          </p>
        </div>
        <Link href="/forms/visit-reports/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Rapor
          </Button>
        </Link>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Rapor</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onay Bekleyen</CardTitle>
            <FileText className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.status === "PENDING").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onaylanan</CardTitle>
            <FileText className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.status === "APPROVED").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Açık Aksiyonlar</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.reduce((sum, r) => sum + r.actionItems.filter(a => a.status !== "COMPLETED").length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtreler */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rapor no veya firma adı ile ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="DRAFT">Taslak</SelectItem>
                <SelectItem value="PENDING">Onay Bekliyor</SelectItem>
                <SelectItem value="APPROVED">Onaylandı</SelectItem>
                <SelectItem value="REJECTED">Reddedildi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tablo */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rapor No</TableHead>
                <TableHead>Ziyaret Tarihi</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Katılımcı</TableHead>
                <TableHead>Aksiyon</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Oluşturan</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              ) : filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Rapor bulunamadı
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.reportNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(report.visitDate), "dd MMM yyyy", { locale: tr })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {report.companyName}
                      </div>
                    </TableCell>
                    <TableCell>{visitTypeLabels[report.visitType] || report.visitType}</TableCell>
                    <TableCell>{report.participants.length} kişi</TableCell>
                    <TableCell>
                      {report.actionItems.filter(a => a.status !== "COMPLETED").length} açık
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusLabels[report.status]?.variant || "secondary"}>
                        {statusLabels[report.status]?.label || report.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{report.createdBy.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/forms/visit-reports/${report.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {report.status !== "APPROVED" && (
                          <>
                            <Link href={`/forms/visit-reports/${report.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(report.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
