"use client"

// TODO: Alanlar netlesince genisletilecek

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { NativeSelect as Select } from "@/components/ui/select"
import { ArrowLeft, Save, Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"
import { BOLUMLER } from "@/lib/personnel-constants"

type InternForm = {
  adSoyad: string
  telefon: string
  bolum: string
  stajSorumlusu: string
  baslangicTarihi: string
  bitisTarihi: string
  okul: string
  aktif: boolean
}

const initialForm: InternForm = {
  adSoyad: "",
  telefon: "",
  bolum: "",
  stajSorumlusu: "",
  baslangicTarihi: "",
  bitisTarihi: "",
  okul: "",
  aktif: true,
}

function formatDate(val: string | null | undefined): string {
  if (!val) return ""
  return val.substring(0, 10)
}

export default function InternDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState<InternForm>(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const set = (field: keyof InternForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    async function fetchIntern() {
      try {
        const res = await fetch(`/api/interns/${id}`)
        if (!res.ok) throw new Error("Stajyer bulunamadi")
        const data = await res.json()
        setForm({
          adSoyad: data.adSoyad || "",
          telefon: data.telefon || "",
          bolum: data.bolum || "",
          stajSorumlusu: data.stajSorumlusu || "",
          baslangicTarihi: formatDate(data.baslangicTarihi),
          bitisTarihi: formatDate(data.bitisTarihi),
          okul: data.okul || "",
          aktif: data.aktif ?? true,
        })
      } catch (err: any) {
        toast.error(err.message || "Veri yuklenemedi")
      } finally {
        setLoading(false)
      }
    }
    fetchIntern()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.adSoyad || !form.bolum) {
      toast.error("Zorunlu alanlari doldurun: Ad Soyad, Bolum")
      return
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/interns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Guncelleme basarisiz")
      }

      toast.success("Stajyer basariyla guncellendi")
      setEditMode(false)
    } catch (err: any) {
      toast.error(err.message || "Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/personnel?tab=stajyer">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {editMode ? "Stajyer Duzenle" : "Stajyer Detay"}
          </h1>
        </div>
        {!editMode && (
          <Button variant="outline" onClick={() => setEditMode(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Duzenle
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Kisisel Bilgiler */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kisisel Bilgiler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adSoyad">Ad Soyad *</Label>
                <Input
                  id="adSoyad"
                  value={form.adSoyad}
                  onChange={(e) => set("adSoyad", e.target.value)}
                  disabled={!editMode}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefon">Telefon</Label>
                <Input
                  id="telefon"
                  value={form.telefon}
                  onChange={(e) => set("telefon", e.target.value)}
                  disabled={!editMode}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staj Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Staj Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bolum">Bolum *</Label>
                <Select
                  id="bolum"
                  value={form.bolum}
                  onChange={(e) => set("bolum", e.target.value)}
                  disabled={!editMode}
                  required
                >
                  <option value="">Secin</option>
                  {BOLUMLER.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stajSorumlusu">Staj Sorumlusu</Label>
                <Input
                  id="stajSorumlusu"
                  value={form.stajSorumlusu}
                  onChange={(e) => set("stajSorumlusu", e.target.value)}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baslangicTarihi">Baslangic Tarihi</Label>
                <Input
                  id="baslangicTarihi"
                  type="date"
                  value={form.baslangicTarihi}
                  onChange={(e) => set("baslangicTarihi", e.target.value)}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bitisTarihi">Bitis Tarihi</Label>
                <Input
                  id="bitisTarihi"
                  type="date"
                  value={form.bitisTarihi}
                  onChange={(e) => set("bitisTarihi", e.target.value)}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="okul">Okul</Label>
                <Input
                  id="okul"
                  value={form.okul}
                  onChange={(e) => set("okul", e.target.value)}
                  disabled={!editMode}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Durum */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Durum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aktif"
                checked={form.aktif}
                onCheckedChange={(checked) => set("aktif", !!checked)}
                disabled={!editMode}
              />
              <Label htmlFor="aktif">Aktif</Label>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {editMode && (
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditMode(false)}
            >
              Iptal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Kaydet
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
