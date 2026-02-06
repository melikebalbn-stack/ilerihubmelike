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
  FolderOpen,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type Category = {
  id: string
  code: string
  name: string
  description: string | null
  color: string
  isActive: boolean
  _count: { analyses: number }
}

export default function CategoriesSettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    color: "#9333ea",
  })

  const loadCategories = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/cost-analysis/categories")
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error("Kategoriler yüklenirken hata:", error)
      toast.error("Kategoriler yüklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleSubmit = async () => {
    if (!formData.code || !formData.name) {
      toast.error("Kod ve isim zorunludur")
      return
    }

    try {
      const url = "/api/cost-analysis/categories"
      const method = editingCategory ? "PUT" : "POST"
      const body = editingCategory
        ? { ...formData, id: editingCategory.id }
        : formData

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingCategory ? "Kategori güncellendi" : "Kategori oluşturuldu")
        setDialogOpen(false)
        setEditingCategory(null)
        setFormData({ code: "", name: "", description: "", color: "#9333ea" })
        await loadCategories()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    }
  }

  const handleDelete = async () => {
    if (!deletingCategory) return

    try {
      const res = await fetch(`/api/cost-analysis/categories?id=${deletingCategory.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Kategori silindi")
        setDeleteDialogOpen(false)
        setDeletingCategory(null)
        await loadCategories()
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
            <span className="text-gray-600">Kategoriler</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Kategoriler</h1>
          <p className="text-gray-500 mt-1">Ürün kategorilerini yönetin</p>
        </div>
        <div className="flex space-x-2">
          <Link href="/cost-analysis/settings">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Button>
          </Link>
          <Button onClick={() => {
            setEditingCategory(null)
            setFormData({ code: "", name: "", description: "", color: "#9333ea" })
            setDialogOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Kategori
          </Button>
        </div>
      </div>

      {/* Guide Box */}
      <div className="bg-[#F3E5F5] rounded-lg p-5 border-l-4 border-purple-500">
        <h3 className="font-semibold text-purple-800 mb-2">Kategori Yönetimi</h3>
        <p className="text-purple-700 text-sm">
          Ürün kategorileri, maliyet analizlerini gruplamak ve raporlamak için kullanılır.
          Her kategoriye bir renk atayarak görsel olarak ayırt edilmelerini sağlayabilirsiniz.
        </p>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FolderOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Kategori Listesi</CardTitle>
                <CardDescription>{categories.length} kategori</CardDescription>
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
                  <TableHead className="w-16">Renk</TableHead>
                  <TableHead>Kod</TableHead>
                  <TableHead>İsim</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-center">Kullanım</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                  <TableHead className="text-center w-24">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: category.color }}
                      ></div>
                    </TableCell>
                    <TableCell className="font-mono font-medium">{category.code}</TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-gray-600">{category.description || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{category._count.analyses} analiz</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={category.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                        {category.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCategory(category)
                          setFormData({
                            code: category.code,
                            name: category.name,
                            description: category.description || "",
                            color: category.color,
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
                          setDeletingCategory(category)
                          setDeleteDialogOpen(true)
                        }}
                        disabled={category._count.analyses > 0}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Henüz kategori eklenmemiş
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
            <DialogTitle>{editingCategory ? "Kategori Düzenle" : "Yeni Kategori"}</DialogTitle>
            <DialogDescription>
              Kategori bilgilerini girin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kod *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="KAT-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Renk</Label>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 p-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>İsim *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Platform"
              />
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Kategori açıklaması"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmit}>
              {editingCategory ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategori Sil</DialogTitle>
            <DialogDescription>
              "{deletingCategory?.name}" kategorisini silmek istediğinize emin misiniz?
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
