"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect as Select } from "@/components/ui/select"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface Category {
  id: string
  name: string
}

interface Customer {
  id: string
  name: string
}

export default function EditCostAnalysisPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    revision: "",
    finishedWeight: "",
    currency: "EUR",
    categoryId: "",
    customerId: "",
    overheadRate: "",
    profitRate: "",
    status: "DRAFT",
  })

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    try {
      const [analysisRes, categoriesRes, customersRes] = await Promise.all([
        fetch(`/api/cost-analysis/${id}`),
        fetch("/api/cost-analysis/categories?activeOnly=true"),
        fetch("/api/cost-analysis/customers?activeOnly=true"),
      ])

      if (categoriesRes.ok) {
        const catData = await categoriesRes.json()
        setCategories(catData)
      }

      if (customersRes.ok) {
        const custData = await customersRes.json()
        setCustomers(custData)
      }

      if (analysisRes.ok) {
        const data = await analysisRes.json()
        setFormData({
          code: data.code || "",
          name: data.name || "",
          description: data.description || "",
          revision: data.revision || "",
          finishedWeight: data.finishedWeight ? String(Number(data.finishedWeight)) : "",
          currency: data.currency || "EUR",
          categoryId: data.category?.id || "",
          customerId: data.customer?.id || "",
          overheadRate: data.overheadRate ? String(Number(data.overheadRate)) : "",
          profitRate: data.profitRate ? String(Number(data.profitRate)) : "",
          status: data.status || "DRAFT",
        })
      } else {
        toast.error("Analiz bulunamadı")
        router.push("/cost-analysis")
      }
    } catch {
      toast.error("Veriler yüklenemedi")
      router.push("/cost-analysis")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.code || !formData.name) {
      toast.error("Ürün kodu ve adı zorunludur")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/cost-analysis/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          description: formData.description || null,
          revision: formData.revision || "A",
          finishedWeight: formData.finishedWeight ? parseFloat(formData.finishedWeight) : 0,
          currency: formData.currency,
          categoryId: formData.categoryId || null,
          customerId: formData.customerId || null,
          overheadRate: formData.overheadRate ? parseFloat(formData.overheadRate) : 0,
          profitRate: formData.profitRate ? parseFloat(formData.profitRate) : 0,
          status: formData.status,
        }),
      })

      if (res.ok) {
        toast.success("Analiz güncellendi")
        router.push(`/cost-analysis/${id}`)
      } else {
        const data = await res.json()
        toast.error(data.error || "Güncelleme başarısız")
      }
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/cost-analysis/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analiz Düzenle</h1>
          <p className="text-gray-500 mt-1">
            {formData.code} - {formData.name}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Temel Bilgiler */}
        <Card>
          <CardHeader>
            <CardTitle>Temel Bilgiler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Ürün Kodu *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="2910"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revision">Revizyon</Label>
                <Input
                  id="revision"
                  value={formData.revision}
                  onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
                  placeholder="A"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Ürün Adı *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ürün adı"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ürün açıklaması..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="finishedWeight">Bitmiş Ağırlık (kg)</Label>
                <Input
                  id="finishedWeight"
                  type="number"
                  step="0.01"
                  value={formData.finishedWeight}
                  onChange={(e) => setFormData({ ...formData, finishedWeight: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Para Birimi</Label>
                <Select
                  id="currency"
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoryId">Kategori</Label>
                <Select
                  id="categoryId"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                >
                  <option value="">Seçiniz</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerId">Müşteri</Label>
                <Select
                  id="customerId"
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                >
                  <option value="">Seçiniz</option>
                  {customers.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="overheadRate">İşletme Gideri (%)</Label>
                <Input
                  id="overheadRate"
                  type="number"
                  step="0.1"
                  value={formData.overheadRate}
                  onChange={(e) => setFormData({ ...formData, overheadRate: e.target.value })}
                  placeholder="25"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profitRate">Kar Oranı (%)</Label>
                <Input
                  id="profitRate"
                  type="number"
                  step="0.1"
                  value={formData.profitRate}
                  onChange={(e) => setFormData({ ...formData, profitRate: e.target.value })}
                  placeholder="20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Durum</Label>
              <Select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="DRAFT">Taslak</option>
                <option value="IN_REVIEW">İncelemede</option>
                <option value="APPROVED">Onaylı</option>
                <option value="REJECTED">Reddedildi</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Butonlar */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href={`/cost-analysis/${id}`}>
            <Button variant="outline" type="button">
              İptal
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Kaydet
          </Button>
        </div>
      </form>
    </div>
  )
}
