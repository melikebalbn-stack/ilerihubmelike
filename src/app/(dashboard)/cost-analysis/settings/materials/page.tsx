"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { NativeSelect as Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, ArrowLeft, Edit, Trash2, Package, Info } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type MaterialCostCategory =
  | "RAW_MATERIAL"
  | "SEMI_FINISHED"
  | "PURCHASED_PART"
  | "STANDARD_PART"
  | "CONSUMABLE"

type CostCurrency = "EUR" | "USD" | "TRY" | "GBP"

type MaterialCatalog = {
  id: string
  code: string
  name: string
  specification: string | null
  category: MaterialCostCategory
  unit: string
  currency: CostCurrency
  unitPrice: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const categoryLabels: Record<MaterialCostCategory, string> = {
  RAW_MATERIAL: "Hammadde",
  SEMI_FINISHED: "Yarı Mamul",
  PURCHASED_PART: "Satın Alınan",
  STANDARD_PART: "Standart",
  CONSUMABLE: "Sarf Malzeme",
}

const categoryColors: Record<MaterialCostCategory, string> = {
  RAW_MATERIAL: "bg-orange-100 text-orange-700",
  SEMI_FINISHED: "bg-purple-100 text-purple-700",
  PURCHASED_PART: "bg-blue-100 text-blue-700",
  STANDARD_PART: "bg-gray-100 text-gray-700",
  CONSUMABLE: "bg-yellow-100 text-yellow-700",
}

const currencySymbols: Record<CostCurrency, string> = {
  EUR: "\u20ac",
  USD: "$",
  TRY: "\u20ba",
  GBP: "\u00a3",
}

export default function MaterialCatalogSettingsPage() {
  const [materials, setMaterials] = useState<MaterialCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<MaterialCatalog | null>(null)
  const [deletingMaterial, setDeletingMaterial] = useState<MaterialCatalog | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL")

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    specification: "",
    category: "RAW_MATERIAL" as MaterialCostCategory,
    unit: "kg",
    currency: "EUR" as CostCurrency,
    unitPrice: "",
  })

  const loadMaterials = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (categoryFilter !== "ALL") {
        params.set("category", categoryFilter)
      }
      const res = await fetch(`/api/cost-analysis/material-catalog?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMaterials(data)
      }
    } catch (error) {
      console.error("Malzemeler yüklenirken hata:", error)
      toast.error("Malzemeler yüklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const getNextCode = async (category: MaterialCostCategory) => {
    try {
      const res = await fetch("/api/cost-analysis/material-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ getNextCode: true, category }),
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
    loadMaterials()
  }, [categoryFilter])

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Malzeme adı zorunludur")
      return
    }
    if (!formData.unitPrice) {
      toast.error("Birim fiyat zorunludur")
      return
    }

    try {
      const url = "/api/cost-analysis/material-catalog"
      const method = editingMaterial ? "PUT" : "POST"
      const body = editingMaterial
        ? { ...formData, id: editingMaterial.id, unitPrice: parseFloat(formData.unitPrice) }
        : { ...formData, unitPrice: parseFloat(formData.unitPrice) }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingMaterial ? "Malzeme güncellendi" : "Malzeme oluşturuldu")
        setDialogOpen(false)
        setEditingMaterial(null)
        setFormData({
          code: "",
          name: "",
          specification: "",
          category: "RAW_MATERIAL",
          unit: "kg",
          currency: "EUR",
          unitPrice: "",
        })
        await loadMaterials()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    }
  }

  const handleDelete = async () => {
    if (!deletingMaterial) return

    try {
      const res = await fetch(`/api/cost-analysis/material-catalog?id=${deletingMaterial.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Malzeme silindi")
        setDeleteDialogOpen(false)
        setDeletingMaterial(null)
        await loadMaterials()
      } else {
        const error = await res.json()
        toast.error(error.error || "Silme başarısız")
      }
    } catch (error) {
      toast.error("Silme sırasında hata oluştu")
    }
  }

  const filteredMaterials = materials

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-sm mb-2">
            <Link href="/cost-analysis" className="text-teal-600 hover:underline">
              Maliyet Analizi
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/cost-analysis/settings" className="text-teal-600 hover:underline">
              Ayarlar
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">Malzeme Kataloğu</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Malzeme Kataloğu</h1>
          <p className="text-gray-500 mt-1">Malzeme kataloğunu yönetin</p>
        </div>
        <div className="flex space-x-2">
          <Link href="/cost-analysis/settings">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Button>
          </Link>
          <Button onClick={async () => {
            setEditingMaterial(null)
            const nextCode = await getNextCode("RAW_MATERIAL")
            setFormData({
              code: nextCode,
              name: "",
              specification: "",
              category: "RAW_MATERIAL",
              unit: "kg",
              currency: "EUR",
              unitPrice: "",
            })
            setDialogOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Malzeme
          </Button>
        </div>
      </div>

      {/* Guide Box */}
      <div className="bg-[#E8F4FD] rounded-lg p-5 border-l-4 border-blue-500">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-800 mb-2">Malzeme Kataloğu</h3>
            <p className="text-blue-700 text-sm">
              Malzeme kataloğu, maliyet analizlerinde kullanılan malzemelerin merkezi kütüphanesidir.
              Buraya eklediğiniz malzemeler, yeni analiz oluştururken hızlıca seçilebilir.
              Fiyat, birim ve spesifikasyon bilgilerini burada tanımlayarak tutarlı maliyet hesaplamaları yapabilirsiniz.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Package className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <CardTitle>Malzeme Listesi</CardTitle>
                <CardDescription>{filteredMaterials.length} malzeme</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Label className="text-sm text-gray-500 whitespace-nowrap">Tür Filtresi:</Label>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-44"
              >
                <option value="ALL">Tüm Türler</option>
                <option value="RAW_MATERIAL">Hammadde</option>
                <option value="SEMI_FINISHED">Yarı Mamul</option>
                <option value="PURCHASED_PART">Satın Alınan</option>
                <option value="STANDARD_PART">Standart</option>
                <option value="CONSUMABLE">Sarf</option>
              </Select>
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
                  <TableHead>Malzeme Adı</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Spesifikasyon</TableHead>
                  <TableHead>Birim</TableHead>
                  <TableHead className="text-right">Birim Fiyat</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                  <TableHead className="text-center w-24">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="font-mono font-medium text-teal-700">
                      {material.code}
                    </TableCell>
                    <TableCell className="font-medium">{material.name}</TableCell>
                    <TableCell>
                      <Badge className={categoryColors[material.category]}>
                        {categoryLabels[material.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {material.specification || "-"}
                    </TableCell>
                    <TableCell className="text-gray-600">{material.unit}</TableCell>
                    <TableCell className="text-right font-medium">
                      {currencySymbols[material.currency]}{" "}
                      {Number(material.unitPrice).toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={
                          material.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }
                      >
                        {material.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingMaterial(material)
                          setFormData({
                            code: material.code,
                            name: material.name,
                            specification: material.specification || "",
                            category: material.category,
                            unit: material.unit,
                            currency: material.currency,
                            unitPrice: String(material.unitPrice),
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
                          setDeletingMaterial(material)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMaterials.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Henüz malzeme eklenmemiş
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
            <DialogTitle>
              {editingMaterial ? "Malzeme Düzenle" : "Yeni Malzeme"}
            </DialogTitle>
            <DialogDescription>Malzeme bilgilerini girin</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Malzeme Adı *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="St37 Sac Levha"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Malzeme Kodu <span className="text-gray-400 text-xs">(otomatik)</span>
                </Label>
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="HMD-001"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Spesifikasyon</Label>
              <Input
                value={formData.specification}
                onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                placeholder="3mm x 1500mm x 3000mm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tür *</Label>
                <Select
                  value={formData.category}
                  onChange={async (e) => {
                    const newCategory = e.target.value as MaterialCostCategory
                    setFormData({ ...formData, category: newCategory })
                    if (!editingMaterial) {
                      const nextCode = await getNextCode(newCategory)
                      setFormData((prev) => ({ ...prev, category: newCategory, code: nextCode }))
                    }
                  }}
                >
                  <option value="RAW_MATERIAL">Hammadde</option>
                  <option value="SEMI_FINISHED">Yarı Mamul</option>
                  <option value="PURCHASED_PART">Satın Alınan</option>
                  <option value="STANDARD_PART">Standart</option>
                  <option value="CONSUMABLE">Sarf Malzeme</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Birim</Label>
                <Select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                >
                  <option value="kg">kg</option>
                  <option value="adet">adet</option>
                  <option value="set">set</option>
                  <option value="mt">mt</option>
                  <option value="m²">m²</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Para Birimi</Label>
                <Select
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value as CostCurrency })
                  }
                >
                  <option value="EUR">{"\u20ac"} EUR</option>
                  <option value="USD">$ USD</option>
                  <option value="TRY">{"\u20ba"} TRY</option>
                  <option value="GBP">{"\u00a3"} GBP</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Birim Fiyat *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmit}>
              {editingMaterial ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Malzeme Sil</DialogTitle>
            <DialogDescription>
              &quot;{deletingMaterial?.name}&quot; malzemesini silmek istediğinize emin misiniz?
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
