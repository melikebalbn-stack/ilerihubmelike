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
  Factory,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type Machine = {
  id: string
  code: string
  name: string
  description: string | null
  hourlyRate: number
  currency: string
  isActive: boolean
  _count: { laborItems: number }
}

const formatCurrency = (value: number, currency: string = "EUR") => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

export default function MachinesSettingsPage() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null)

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    hourlyRate: "",
    currency: "EUR",
  })

  const loadMachines = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/cost-analysis/machines")
      if (res.ok) {
        const data = await res.json()
        setMachines(data)
      }
    } catch (error) {
      console.error("Makineler yüklenirken hata:", error)
      toast.error("Makineler yüklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMachines()
  }, [])

  const handleSubmit = async () => {
    if (!formData.code || !formData.name || !formData.hourlyRate) {
      toast.error("Kod, isim ve saat ücreti zorunludur")
      return
    }

    try {
      const url = "/api/cost-analysis/machines"
      const method = editingMachine ? "PUT" : "POST"
      const body = editingMachine
        ? { ...formData, id: editingMachine.id }
        : formData

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingMachine ? "Makine güncellendi" : "Makine oluşturuldu")
        setDialogOpen(false)
        setEditingMachine(null)
        setFormData({ code: "", name: "", description: "", hourlyRate: "", currency: "EUR" })
        await loadMachines()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    }
  }

  const handleDelete = async () => {
    if (!deletingMachine) return

    try {
      const res = await fetch(`/api/cost-analysis/machines?id=${deletingMachine.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Makine silindi")
        setDeleteDialogOpen(false)
        setDeletingMachine(null)
        await loadMachines()
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
            <span className="text-gray-600">Makineler</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Makineler / İş Merkezleri</h1>
          <p className="text-gray-500 mt-1">Makine ve iş merkezlerini, saat ücretlerini yönetin</p>
        </div>
        <div className="flex space-x-2">
          <Link href="/cost-analysis/settings">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Button>
          </Link>
          <Button onClick={() => {
            setEditingMachine(null)
            setFormData({ code: "", name: "", description: "", hourlyRate: "", currency: "EUR" })
            setDialogOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Makine
          </Button>
        </div>
      </div>

      {/* Guide Box */}
      <div className="bg-[#E8F5E9] rounded-lg p-5 border-l-4 border-green-500">
        <h3 className="font-semibold text-green-800 mb-2">Makine / İş Merkezi Yönetimi</h3>
        <p className="text-green-700 text-sm">
          Makineler, işçilik hesaplamalarında kullanılır. Her makineye bir saat ücreti tanımlanır
          ve işçilik kaydı oluşturulurken otomatik olarak bu ücret uygulanır.
        </p>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Factory className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>Makine Listesi</CardTitle>
                <CardDescription>{machines.length} makine</CardDescription>
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
                  <TableHead>Makine Adı</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right">Saat Ücreti</TableHead>
                  <TableHead className="text-center">Kullanım</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                  <TableHead className="text-center w-24">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {machines.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell className="font-mono font-medium">{machine.code}</TableCell>
                    <TableCell className="font-medium">{machine.name}</TableCell>
                    <TableCell className="text-gray-600">{machine.description || "-"}</TableCell>
                    <TableCell className="text-right font-medium text-teal-600">
                      {formatCurrency(machine.hourlyRate, machine.currency)}/sa
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{machine._count.laborItems} işçilik</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={machine.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                        {machine.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingMachine(machine)
                          setFormData({
                            code: machine.code,
                            name: machine.name,
                            description: machine.description || "",
                            hourlyRate: machine.hourlyRate.toString(),
                            currency: machine.currency,
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
                          setDeletingMachine(machine)
                          setDeleteDialogOpen(true)
                        }}
                        disabled={machine._count.laborItems > 0}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {machines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Henüz makine eklenmemiş
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMachine ? "Makine Düzenle" : "Yeni Makine"}</DialogTitle>
            <DialogDescription>
              Makine / iş merkezi bilgilerini girin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kod *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="CNC-01"
                />
              </div>
              <div className="space-y-2">
                <Label>Makine Adı *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="CNC İşleme Merkezi"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Makine açıklaması"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Saat Ücreti *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  placeholder="45.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Para Birimi</Label>
                <Select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="TRY">TRY (₺)</option>
                  <option value="GBP">GBP (£)</option>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmit}>
              {editingMachine ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Makine Sil</DialogTitle>
            <DialogDescription>
              "{deletingMachine?.name}" makinesini silmek istediğinize emin misiniz?
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
