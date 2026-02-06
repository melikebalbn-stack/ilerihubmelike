"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { NativeSelect as Select } from "@/components/ui/select"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ArrowLeft,
  Truck,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type Supplier = {
  id: string
  code: string
  name: string
  type: string
  country: string | null
  contact: string | null
  email: string | null
  phone: string | null
  isActive: boolean
  _count: { materials: number; services: number }
}

const supplierTypes: Record<string, string> = {
  MATERIAL: "Malzeme",
  SERVICE: "Hizmet",
  BOTH: "Her İkisi",
}

export default function SuppliersSettingsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "MATERIAL",
    country: "",
    contact: "",
    email: "",
    phone: "",
  })

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/cost-analysis/suppliers")
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data)
      }
    } catch (error) {
      console.error("Tedarikçiler yüklenirken hata:", error)
      toast.error("Tedarikçiler yüklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  const handleSubmit = async () => {
    if (!formData.code || !formData.name) {
      toast.error("Kod ve isim zorunludur")
      return
    }

    try {
      const url = "/api/cost-analysis/suppliers"
      const method = editingSupplier ? "PUT" : "POST"
      const body = editingSupplier
        ? { ...formData, id: editingSupplier.id }
        : formData

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingSupplier ? "Tedarikçi güncellendi" : "Tedarikçi oluşturuldu")
        setDialogOpen(false)
        setEditingSupplier(null)
        setFormData({ code: "", name: "", type: "MATERIAL", country: "", contact: "", email: "", phone: "" })
        await loadSuppliers()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    }
  }

  const handleDelete = async () => {
    if (!deletingSupplier) return

    try {
      const res = await fetch(`/api/cost-analysis/suppliers?id=${deletingSupplier.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Tedarikçi silindi")
        setDeleteDialogOpen(false)
        setDeletingSupplier(null)
        await loadSuppliers()
      } else {
        const error = await res.json()
        toast.error(error.error || "Silme başarısız")
      }
    } catch (error) {
      toast.error("Silme sırasında hata oluştu")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-sm mb-2">
            <Link href="/cost-analysis" className="text-teal-600 hover:underline">
              Maliyet Analizleri
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <Link href="/cost-analysis/settings" className="text-teal-600 hover:underline">
              Ayarlar
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">Tedarikçiler</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tedarikçiler</h1>
          <p className="text-gray-500 mt-1">Malzeme ve hizmet tedarikçilerini yönetin</p>
        </div>
        <div className="flex space-x-2">
          <Link href="/cost-analysis/settings">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Button>
          </Link>
          <Button onClick={() => {
            setEditingSupplier(null)
            setFormData({ code: "", name: "", type: "MATERIAL", country: "", contact: "", email: "", phone: "" })
            setDialogOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Tedarikçi
          </Button>
        </div>
      </div>

      {/* Guide Box */}
      <div className="bg-[#FFF3E0] rounded-lg p-5 border-l-4 border-orange-500">
        <h3 className="font-semibold text-orange-800 mb-2">Tedarikçi Yönetimi</h3>
        <p className="text-orange-700 text-sm">
          Tedarikçiler, malzeme ve dış hizmet kayıtlarında kullanılır. Her tedarikçiye bir tip
          atayarak (Malzeme, Hizmet veya Her İkisi) takip kolaylığı sağlayabilirsiniz.
        </p>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Truck className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>Tedarikçi Listesi</CardTitle>
                <CardDescription>{suppliers.length} tedarikçi</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Kod</TableHead>
                  <TableHead>Tedarikçi Adı</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Ülke</TableHead>
                  <TableHead>İletişim</TableHead>
                  <TableHead className="text-center">Kullanım</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                  <TableHead className="text-center w-24">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-mono font-medium">{supplier.code}</TableCell>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {supplierTypes[supplier.type] || supplier.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">{supplier.country || "-"}</TableCell>
                    <TableCell className="text-gray-600">{supplier.contact || "-"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Badge variant="outline">{supplier._count.materials} malz.</Badge>
                        <Badge variant="outline">{supplier._count.services} hiz.</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={supplier.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                        {supplier.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingSupplier(supplier)
                          setFormData({
                            code: supplier.code,
                            name: supplier.name,
                            type: supplier.type,
                            country: supplier.country || "",
                            contact: supplier.contact || "",
                            email: supplier.email || "",
                            phone: supplier.phone || "",
                          })
                          setDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingSupplier(supplier)
                          setDeleteDialogOpen(true)
                        }}
                        disabled={supplier._count.materials > 0 || supplier._count.services > 0}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {suppliers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Henüz tedarikçi eklenmemiş
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Tedarikçi Düzenle" : "Yeni Tedarikçi"}</DialogTitle>
            <DialogDescription>
              Tedarikçi bilgilerini girin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kod *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="TED-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Tip</Label>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="MATERIAL">Malzeme</option>
                  <option value="SERVICE">Hizmet</option>
                  <option value="BOTH">Her İkisi</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tedarikçi Adı *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Çelik A.Ş."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ülke</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Türkiye"
                />
              </div>
              <div className="space-y-2">
                <Label>İletişim Kişisi</Label>
                <Input
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  placeholder="Ad Soyad"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>E-posta</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@firma.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+90 312 123 4567"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmit}>
              {editingSupplier ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tedarikçi Sil</DialogTitle>
            <DialogDescription>
              "{deletingSupplier?.name}" tedarikçisini silmek istediğinize emin misiniz?
              Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
