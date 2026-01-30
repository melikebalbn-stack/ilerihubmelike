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
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

interface BlueCollarUser {
  id: string
  email: string
  name: string | null
  employeeId: string | null
  tcLastFour: string | null
  department: string | null
  jobTitle: string | null
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
  const [searchInput, setSearchInput] = useState("")

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<BlueCollarUser | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    employeeId: "",
    tcLastFour: "",
    name: "",
    email: "",
    department: "",
    jobTitle: "",
  })

  useEffect(() => {
    fetchUsers()
  }, [pagination.page, search])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
      })

      const res = await fetch(`/api/bluecollar-users?${params}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setPagination(data.pagination)
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPagination((prev) => ({ ...prev, page: 1 }))
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

  const openEditDialog = (user: BlueCollarUser) => {
    setSelectedUser(user)
    setFormData({
      employeeId: user.employeeId || "",
      tcLastFour: user.tcLastFour || "",
      name: user.name || "",
      email: user.email || "",
      department: user.department || "",
      jobTitle: user.jobTitle || "",
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
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kullanıcı
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Sicil no, ad soyad, email veya departman ara..."
                className="pl-9"
              />
            </div>
            <Button type="submit">Ara</Button>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Kullanıcı Listesi ({pagination.total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                  <TableHead>Sicil No</TableHead>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>TC Son 4</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>Pozisyon</TableHead>
                  <TableHead>Son Giriş</TableHead>
                  <TableHead>Durum</TableHead>
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
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(user)}
                        >
                          {user.isActive ? (
                            <UserX className="h-4 w-4 text-red-500" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-emerald-500" />
                          )}
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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

      {/* Delete/Toggle Active Dialog */}
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
    </div>
  )
}
