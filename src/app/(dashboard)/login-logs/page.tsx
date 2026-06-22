"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Users,
  LogIn,
  Search,
  RefreshCw,
  Calendar,
} from "lucide-react"

interface LoginLog {
  id: string
  email: string
  username: string | null
  name: string | null
  department: string | null
  role: string | null
  status: string
  errorMessage: string | null
  ipAddress: string | null
  createdAt: string
}

interface Stats {
  todaySuccess: number
  todayFailed: number
  todayUniqueUsers: number
}

const statusColors: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  LOCKED: "bg-yellow-100 text-yellow-800",
  EXPIRED: "bg-gray-100 text-gray-800",
}

const statusLabels: Record<string, string> = {
  SUCCESS: "Başarılı",
  FAILED: "Başarısız",
  LOCKED: "Kilitli",
  EXPIRED: "Süresi Dolmuş",
}

export default function LoginLogsPage() {
  const { data: session } = useSession()
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filtreler
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [emailFilter, setEmailFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      })

      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (emailFilter) {
        params.append("email", emailFilter)
      }
      if (dateFrom) {
        params.append("dateFrom", dateFrom)
      }
      if (dateTo) {
        params.append("dateTo", dateTo)
      }

      const res = await fetch(`/api/login-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setStats(data.stats)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error("Login logları yüklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, statusFilter])

  const handleSearch = () => {
    setPage(1)
    fetchLogs()
  }

  const handleReset = () => {
    setStatusFilter("all")
    setEmailFilter("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
    fetchLogs()
  }

  // PR-Y13: enum check yerine RBAC permission.
  // admin.audit.view → admin, bgys-sorumlusu, it-admin, super-admin
  const canView = session?.user?.permissions?.includes("admin.audit.view") ?? false

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Login Aktiviteleri</h1>
        <p className="text-muted-foreground">Kullanıcı giriş işlemlerini takip edin</p>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bugün Başarılı Giriş</p>
                <p className="text-xl sm:text-3xl font-bold text-green-600">{stats?.todaySuccess || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bugün Başarısız Giriş</p>
                <p className="text-xl sm:text-3xl font-bold text-red-600">{stats?.todayFailed || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bugün Giriş Yapan Kullanıcı</p>
                <p className="text-xl lg:text-3xl font-bold">{stats?.todayUniqueUsers || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtreler */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtreler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Durum</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="SUCCESS">Başarılı</SelectItem>
                  <SelectItem value="FAILED">Başarısız</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">E-posta</label>
              <Input
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                placeholder="E-posta ara..."
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Başlangıç Tarihi</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Bitiş Tarihi</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                Ara
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sıfırla
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tablo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Login Kayıtları</CardTitle>
              <CardDescription>{total} kayıt bulundu</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yenile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <LogIn className="h-12 w-12 mb-4" />
              <p>Henüz login kaydı bulunmuyor</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih/Saat</TableHead>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Hata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(log.createdAt).toLocaleString("tr-TR")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{log.name || "-"}</p>
                          <p className="text-sm text-muted-foreground">{log.username}</p>
                        </div>
                      </TableCell>
                      <TableCell>{log.email}</TableCell>
                      <TableCell>{log.department || "-"}</TableCell>
                      <TableCell>
                        {log.role ? (
                          <Badge variant="outline">{log.role}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[log.status]}>
                          {statusLabels[log.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {log.errorMessage || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Toplam {total} kayıttan {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} arası gösteriliyor
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      İlk
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Önceki
                    </Button>

                    {/* Sayfa numaraları */}
                    <div className="flex items-center gap-1 mx-2">
                      {(() => {
                        const pages: (number | string)[] = []
                        const showPages = 5
                        let startPage = Math.max(1, page - Math.floor(showPages / 2))
                        const endPage = Math.min(totalPages, startPage + showPages - 1)

                        if (endPage - startPage + 1 < showPages) {
                          startPage = Math.max(1, endPage - showPages + 1)
                        }

                        if (startPage > 1) {
                          pages.push(1)
                          if (startPage > 2) pages.push("...")
                        }

                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(i)
                        }

                        if (endPage < totalPages) {
                          if (endPage < totalPages - 1) pages.push("...")
                          pages.push(totalPages)
                        }

                        return pages.map((p, idx) => (
                          typeof p === "number" ? (
                            <Button
                              key={idx}
                              variant={p === page ? "default" : "outline"}
                              size="sm"
                              className="min-w-[36px]"
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </Button>
                          ) : (
                            <span key={idx} className="px-2 text-muted-foreground">...</span>
                          )
                        ))
                      })()}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Sonraki
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                    >
                      Son
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
