"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  HardHat,
  Plus,
  Search,
  Edit2,
  UserX,
  UserCheck,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
} from "lucide-react"
import * as XLSX from "xlsx"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

const SERVICE_ROUTES = [
  "Arapçeşme",
  "Aydos-Kurtköy",
  "Beykoz Kavacık",
  "Beylikbağı Güzeltepe",
  "Beylikbağı Ulaştepe",
  "Darica",
  "Gebze Develi",
  "Kaynarca Pendik",
  "Üsküdar",
]

interface BlueCollarUser {
  id: string
  email: string
  name: string | null
  employeeId: string | null
  tcLastFour: string | null
  department: string | null
  jobTitle: string | null
  duty: string | null
  section: string | null
  serviceRoute: string | null
  serviceStop: string | null
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export default function BlueCollarUsersPage() {
  const [users, setUsers] = useState<BlueCollarUser[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Sıralama state
  const [sortBy, setSortBy] = useState("employeeId")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  // Filtre state
  const [filterDepartment, setFilterDepartment] = useState("")
  const [filterServiceRoute, setFilterServiceRoute] = useState("")
  const [filterIsActive, setFilterIsActive] = useState("")
  const [departments, setDepartments] = useState<string[]>([])
  const [serviceRoutes, setServiceRoutes] = useState<string[]>([])

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [hardDeleteDialogOpen, setHardDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<BlueCollarUser | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    employeeId: "",
    tcLastFour: "",
    name: "",
    email: "",
    department: "",
    jobTitle: "",
    duty: "",
    section: "",
    serviceRoute: "",
    serviceStop: "",
  })

  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPagination((prev) => prev.page === 1 ? prev : { ...prev, page: 1 })
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetchUsers()
  }, [pagination.page, debouncedSearch, sortBy, sortOrder, filterDepartment, filterServiceRoute, filterIsActive])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filterDepartment && { department: filterDepartment }),
        ...(filterServiceRoute && { serviceRoute: filterServiceRoute }),
        ...(filterIsActive && { isActive: filterIsActive }),
      })

      const res = await fetch(`/api/bluecollar-users?${params}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setPagination(data.pagination)
        if (data.filters) {
          setDepartments(data.filters.departments || [])
          setServiceRoutes(data.filters.serviceRoutes || [])
        }
      } else if (res.status === 403) {
        toast.error("Bu sayfaya erişim yetkiniz yok")
      }
    } catch (error) {
      console.error("Kullanıcılar yüklenirken hata:", error)
      toast.error("Kullanıcılar yüklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortOrder === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }


  const handleCreate = async () => {
    if (!formData.employeeId || !formData.tcLastFour || !formData.name) {
      toast.error("Sicil no, TC son 4 hane ve ad soyad zorunludur")
      return
    }

    if (!/^\d{4}$/.test(formData.tcLastFour)) {
      toast.error("TC son 4 hane 4 rakamdan oluşmalıdır")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/bluecollar-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Kullanıcı oluşturuldu")
        setCreateDialogOpen(false)
        resetForm()
        fetchUsers()
      } else {
        const error = await res.json()
        toast.error(error.error || "Kullanıcı oluşturulamadı")
      }
    } catch (error) {
      toast.error("Kullanıcı oluşturulurken hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedUser) return

    if (formData.tcLastFour && !/^\d{4}$/.test(formData.tcLastFour)) {
      toast.error("TC son 4 hane 4 rakamdan oluşmalıdır")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/bluecollar-users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Kullanıcı güncellendi")
        setEditDialogOpen(false)
        resetForm()
        fetchUsers()
      } else {
        const error = await res.json()
        toast.error(error.error || "Kullanıcı güncellenemedi")
      }
    } catch (error) {
      toast.error("Kullanıcı güncellenirken hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!selectedUser) return

    setSaving(true)
    try {
      const res = await fetch(`/api/bluecollar-users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !selectedUser.isActive }),
      })

      if (res.ok) {
        toast.success(
          selectedUser.isActive
            ? "Kullanıcı deaktif edildi"
            : "Kullanıcı aktif edildi"
        )
        setDeleteDialogOpen(false)
        setSelectedUser(null)
        fetchUsers()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const handleHardDelete = async () => {
    if (!selectedUser) return

    setSaving(true)
    try {
      const res = await fetch(`/api/bluecollar-users/${selectedUser.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Kullanıcı kalıcı olarak silindi")
        setHardDeleteDialogOpen(false)
        setSelectedUser(null)
        fetchUsers()
      } else {
        const error = await res.json()
        toast.error(error.error || "Kullanıcı silinemedi")
      }
    } catch (error) {
      toast.error("Silme işlemi sırasında hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const handleExcelDownload = async () => {
    try {
      // Tüm kullanıcıları çek (sayfalama olmadan)
      const res = await fetch(`/api/bluecollar-users?limit=10000&sortBy=employeeId&sortOrder=asc`)
      if (!res.ok) {
        toast.error("Kullanıcılar alınamadı")
        return
      }
      const { users: allUsers } = await res.json()
      const data = allUsers.map((u: BlueCollarUser) => ({
        "Sicil No": u.employeeId || "",
        "Ad Soyad": u.name || "",
        "TC Son 4": u.tcLastFour || "",
        Departman: u.department || "",
        Pozisyon: u.jobTitle || "",
        "Görev": u.duty || "",
        "Bölüm": u.section || "",
        Servis: u.serviceRoute || "",
        "Servis Durak": u.serviceStop || "",
        Durum: u.isActive ? "Aktif" : "Pasif",
      }))
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Mavi Yaka Kullanıcılar")
      ws["!cols"] = [
        { wch: 10 }, { wch: 25 }, { wch: 8 }, { wch: 20 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 8 },
      ]
      XLSX.writeFile(wb, `mavi-yaka-kullanicilar-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success(`${allUsers.length} kullanıcı Excel'e aktarıldı`)
    } catch {
      toast.error("Excel indirme sırasında hata oluştu")
    }
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    setUploading(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" })

      if (rows.length === 0) {
        toast.error("Excel dosyası boş")
        setUploading(false)
        return
      }

      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const row of rows) {
        const employeeId = String(
          row["Sicil No"] || row["sicil_no"] || row["SICIL NO"] || row["Sicil Numarası"] || ""
        ).trim()
        const tcLastFour = String(
          row["TC Son 4"] || row["tc_son_4"] || row["TC SON 4"] || row["TC Son 4 Hane"] || ""
        ).trim()
        const name = String(
          row["Ad Soyad"] || row["ad_soyad"] || row["AD SOYAD"] || row["İsim"] || ""
        ).trim()
        const department = String(row["Departman"] || row["departman"] || row["DEPARTMAN"] || "").trim()
        const jobTitle = String(row["Pozisyon"] || row["pozisyon"] || row["POZISYON"] || "").trim()
        const duty = String(row["Görev"] || row["gorev"] || row["GÖREV"] || "").trim()
        const section = String(row["Bölüm"] || row["bolum"] || row["BÖLÜM"] || "").trim()
        const serviceRoute = String(row["Servis"] || row["servis"] || row["SERVIS"] || "").trim()
        const serviceStop = String(row["Servis Durak"] || row["servis_durak"] || row["SERVIS DURAK"] || "").trim()

        if (!employeeId || !tcLastFour || !name) {
          errorCount++
          errors.push(`Satır ${successCount + errorCount}: Sicil no, TC son 4, Ad soyad eksik`)
          continue
        }

        try {
          const res = await fetch("/api/bluecollar-users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId, tcLastFour, name, department, jobTitle,
              duty, section, serviceRoute, serviceStop,
            }),
          })
          if (res.ok) {
            successCount++
          } else {
            const err = await res.json()
            errorCount++
            errors.push(`${employeeId} - ${name}: ${err.error}`)
          }
        } catch {
          errorCount++
          errors.push(`${employeeId} - ${name}: Bağlantı hatası`)
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} kullanıcı başarıyla eklendi`)
        fetchUsers()
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} satır eklenemedi: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`)
      }
    } catch (error) {
      toast.error("Excel dosyası okunurken hata oluştu")
    } finally {
      setUploading(false)
    }
  }

  const openEditDialog = (user: BlueCollarUser) => {
    setSelectedUser(user)
    setFormData({
      employeeId: user.employeeId || "",
      tcLastFour: user.tcLastFour || "",
      name: user.name || "",
      email: user.email || "",
      department: user.department || "",
      jobTitle: user.jobTitle || "",
      duty: user.duty || "",
      section: user.section || "",
      serviceRoute: user.serviceRoute || "",
      serviceStop: user.serviceStop || "",
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (user: BlueCollarUser) => {
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      employeeId: "",
      tcLastFour: "",
      name: "",
      email: "",
      department: "",
      jobTitle: "",
      duty: "",
      section: "",
      serviceRoute: "",
      serviceStop: "",
    })
    setSelectedUser(null)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HardHat className="h-5 w-5 text-amber-600" />
          <div>
            <h1 className="text-lg font-bold">Mavi Yaka Kullanıcı Yönetimi</h1>
            <p className="text-xs text-muted-foreground">
              Sicil No + TC Son 4 Hane ile giriş yapan kullanıcılar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExcelDownload} disabled={users.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Excel İndir
          </Button>
          <Button variant="outline" disabled={uploading} onClick={() => document.getElementById("excel-upload-input")?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Excel Yükle
          </Button>
          <input id="excel-upload-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Kullanıcı
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sicil no, ad soyad, email veya departman ara..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterDepartment}
              onChange={(e) => {
                setFilterDepartment(e.target.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Tüm Departmanlar</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={filterServiceRoute}
              onChange={(e) => {
                setFilterServiceRoute(e.target.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Tüm Servisler</option>
              {SERVICE_ROUTES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={filterIsActive}
              onChange={(e) => {
                setFilterIsActive(e.target.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Tüm Durumlar</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
            {(filterDepartment || filterServiceRoute || filterIsActive) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterDepartment("")
                  setFilterServiceRoute("")
                  setFilterIsActive("")
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
                className="text-muted-foreground"
              >
                Filtreleri Temizle
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Kullanıcı Listesi ({pagination.total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search
                ? "Arama kriterlerine uygun kullanıcı bulunamadı"
                : "Henüz mavi yaka kullanıcı eklenmemiş"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("employeeId")}>
                    <span className="flex items-center">Sicil No<SortIcon field="employeeId" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("name")}>
                    <span className="flex items-center">Ad Soyad<SortIcon field="name" /></span>
                  </TableHead>
                  <TableHead>TC Son 4</TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("department")}>
                    <span className="flex items-center">Departman<SortIcon field="department" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("jobTitle")}>
                    <span className="flex items-center">Pozisyon<SortIcon field="jobTitle" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("duty")}>
                    <span className="flex items-center">Görev<SortIcon field="duty" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("section")}>
                    <span className="flex items-center">Bölüm<SortIcon field="section" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("serviceRoute")}>
                    <span className="flex items-center">Servis<SortIcon field="serviceRoute" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("serviceStop")}>
                    <span className="flex items-center">Servis Durak<SortIcon field="serviceStop" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("lastLoginAt")}>
                    <span className="flex items-center">Son Giriş<SortIcon field="lastLoginAt" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("isActive")}>
                    <span className="flex items-center">Durum<SortIcon field="isActive" /></span>
                  </TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.employeeId}
                    </TableCell>
                    <TableCell>{user.name || "-"}</TableCell>
                    <TableCell className="font-mono">
                      {user.tcLastFour ? "****" : "-"}
                    </TableCell>
                    <TableCell>{user.department || "-"}</TableCell>
                    <TableCell>{user.jobTitle || "-"}</TableCell>
                    <TableCell>{user.duty || "-"}</TableCell>
                    <TableCell>{user.section || "-"}</TableCell>
                    <TableCell>{user.serviceRoute || "-"}</TableCell>
                    <TableCell>{user.serviceStop || "-"}</TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? format(new Date(user.lastLoginAt), "dd MMM yyyy HH:mm", {
                            locale: tr,
                          })
                        : "Hiç giriş yapmadı"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.isActive ? "default" : "secondary"}
                        className={
                          user.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }
                      >
                        {user.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                          title="Düzenle"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(user)}
                          title={user.isActive ? "Deaktif Et" : "Aktif Et"}
                        >
                          {user.isActive ? (
                            <UserX className="h-4 w-4 text-red-500" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-emerald-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setHardDeleteDialogOpen(true)
                          }}
                          title="Kalıcı Sil"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Sayfa {pagination.page} / {pagination.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Mavi Yaka Kullanıcı</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Sicil Numarası *</Label>
                <Input
                  id="employeeId"
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeId: e.target.value })
                  }
                  placeholder="12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tcLastFour">TC Son 4 Hane *</Label>
                <Input
                  id="tcLastFour"
                  value={formData.tcLastFour}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 4)
                    setFormData({ ...formData, tcLastFour: value })
                  }}
                  placeholder="1234"
                  maxLength={4}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Ad Soyad *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ahmet Yılmaz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (Opsiyonel)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="Boş bırakılırsa otomatik oluşturulur"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Departman</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  placeholder="Üretim"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Pozisyon</Label>
                <Input
                  id="jobTitle"
                  value={formData.jobTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, jobTitle: e.target.value })
                  }
                  placeholder="Operatör"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duty">Görev</Label>
                <Input
                  id="duty"
                  value={formData.duty}
                  onChange={(e) =>
                    setFormData({ ...formData, duty: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Bölüm</Label>
                <Input
                  id="section"
                  value={formData.section}
                  onChange={(e) =>
                    setFormData({ ...formData, section: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceRoute">Servis</Label>
                <select
                  id="serviceRoute"
                  value={formData.serviceRoute}
                  onChange={(e) =>
                    setFormData({ ...formData, serviceRoute: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Seçiniz</option>
                  {SERVICE_ROUTES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceStop">Servis Durak</Label>
                <Input
                  id="serviceStop"
                  value={formData.serviceStop}
                  onChange={(e) =>
                    setFormData({ ...formData, serviceStop: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false)
                resetForm()
              }}
            >
              İptal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcı Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-employeeId">Sicil Numarası</Label>
                <Input
                  id="edit-employeeId"
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeId: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tcLastFour">TC Son 4 Hane</Label>
                <Input
                  id="edit-tcLastFour"
                  value={formData.tcLastFour}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 4)
                    setFormData({ ...formData, tcLastFour: value })
                  }}
                  maxLength={4}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Ad Soyad</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-department">Departman</Label>
                <Input
                  id="edit-department"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-jobTitle">Pozisyon</Label>
                <Input
                  id="edit-jobTitle"
                  value={formData.jobTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, jobTitle: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-duty">Görev</Label>
                <Input
                  id="edit-duty"
                  value={formData.duty}
                  onChange={(e) =>
                    setFormData({ ...formData, duty: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-section">Bölüm</Label>
                <Input
                  id="edit-section"
                  value={formData.section}
                  onChange={(e) =>
                    setFormData({ ...formData, section: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-serviceRoute">Servis</Label>
                <select
                  id="edit-serviceRoute"
                  value={formData.serviceRoute}
                  onChange={(e) =>
                    setFormData({ ...formData, serviceRoute: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Seçiniz</option>
                  {SERVICE_ROUTES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-serviceStop">Servis Durak</Label>
                <Input
                  id="edit-serviceStop"
                  value={formData.serviceStop}
                  onChange={(e) =>
                    setFormData({ ...formData, serviceStop: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                resetForm()
              }}
            >
              İptal
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Active Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedUser?.isActive
                ? "Kullanıcıyı Deaktif Et"
                : "Kullanıcıyı Aktif Et"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser?.isActive
                ? `${selectedUser?.name || selectedUser?.employeeId} kullanıcısını deaktif etmek istediğinizden emin misiniz? Kullanıcı sisteme giriş yapamayacak.`
                : `${selectedUser?.name || selectedUser?.employeeId} kullanıcısını aktif etmek istediğinizden emin misiniz?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              className={
                selectedUser?.isActive
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedUser?.isActive ? "Deaktif Et" : "Aktif Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hard Delete Dialog */}
      <AlertDialog open={hardDeleteDialogOpen} onOpenChange={setHardDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı Kalıcı Olarak Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedUser?.name || selectedUser?.employeeId}</strong> kullanıcısını kalıcı olarak silmek istediğinizden emin misiniz?
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kalıcı Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
