"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Users,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type Customer = {
  id: string
  code: string
  name: string
  contactPerson: string | null
  contact: string | null
  email: string | null
  phone: string | null
  isActive: boolean
  _count: { analyses: number }
}

export default function CustomersSettingsPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
  })

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/cost-analysis/customers")
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error("Müşteriler yüklenirken hata:", error)
      toast.error("Müşteriler yüklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  // Otomatik kod getir
  const getNextCode = async () => {
    try {
      const res = await fetch("/api/cost-analysis/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ getNextCode: true }),
      })
      if (res.ok) {
        const data = await res.json()
        return data.nextCode
      }
    } catch (error) {
      console.error("Kod üretilirken hata:", error)
    }
    return ""
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Müşteri adı zorunludur")
      return
    }

    try {
      const url = "/api/cost-analysis/customers"
      const method = editingCustomer ? "PUT" : "POST"
      const body = editingCustomer
        ? { ...formData, id: editingCustomer.id }
        : formData

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingCustomer ? "Müşteri güncellendi" : "Müşteri oluşturuldu")
        setDialogOpen(false)
        setEditingCustomer(null)
        setFormData({ code: "", name: "", contactPerson: "", email: "", phone: "" })
        await loadCustomers()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    }
  }

  const handleDelete = async () => {
    if (!deletingCustomer) return

    try {
      const res = await fetch(`/api/cost-analysis/customers?id=${deletingCustomer.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Müşteri silindi")
        setDeleteDialogOpen(false)
        setDeletingCustomer(null)
        await loadCustomers()
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
            <span className="text-gray-600">Müşteriler</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Müşteriler</h1>
          <p className="text-gray-500 mt-1">Müşteri listesini yönetin</p>
        </div>
        <div className="flex space-x-2">
          <Link href="/cost-analysis/settings">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Button>
          </Link>
          <Button onClick={async () => {
            setEditingCustomer(null)
            const nextCode = await getNextCode()
            setFormData({ code: nextCode, name: "", contactPerson: "", email: "", phone: "" })
            setDialogOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Müşteri
          </Button>
        </div>
      </div>

      {/* Guide Box */}
      <div className="bg-[#E8F4FD] rounded-lg p-5 border-l-4 border-blue-500">
        <h3 className="font-semibold text-blue-800 mb-2">Müşteri Yönetimi</h3>
        <p className="text-blue-700 text-sm">
          Müşteriler, maliyet analizlerini ilişkilendirmek ve müşteri bazlı raporlama yapmak için kullanılır.
          Her analize bir müşteri atayarak hangi müşteri için hangi ürünlerin üretildiğini takip edebilirsiniz.
        </p>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Müşteri Listesi</CardTitle>
                <CardDescription>{customers.length} müşteri</CardDescription>
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
                  <TableHead>Müşteri Adı</TableHead>
                  <TableHead>İletişim Kişisi</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead className="text-center">Kullanım</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                  <TableHead className="text-center w-24">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-mono font-medium">{customer.code}</TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-gray-600">{customer.contact || "-"}</TableCell>
                    <TableCell className="text-gray-600">{customer.email || "-"}</TableCell>
                    <TableCell className="text-gray-600">{customer.phone || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{customer._count.analyses} analiz</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={customer.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                        {customer.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCustomer(customer)
                          setFormData({
                            code: customer.code,
                            name: customer.name,
                            contactPerson: customer.contact || "",
                            email: customer.email || "",
                            phone: customer.phone || "",
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
                          setDeletingCustomer(customer)
                          setDeleteDialogOpen(true)
                        }}
                        disabled={customer._count.analyses > 0}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Henüz müşteri eklenmemiş
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
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Müşteri Düzenle" : "Yeni Müşteri"}</DialogTitle>
            <DialogDescription>
              Müşteri bilgilerini girin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kod <span className="text-gray-400 text-xs">(otomatik)</span></Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="MUS-001"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Müşteri Adı *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Roketsan"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>İletişim Kişisi</Label>
              <Input
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Ad Soyad"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {editingCustomer ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Müşteri Sil</DialogTitle>
            <DialogDescription>
              "{deletingCustomer?.name}" müşterisini silmek istediğinize emin misiniz?
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
