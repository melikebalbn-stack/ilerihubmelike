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

type ConsultantForm = {
  adSoyad: string
  telefon: string
  email: string
  bolum: string
  uzmanlikAlani: string
  sozlesmeBaslangic: string
  sozlesmeBitis: string
  aktif: boolean
}

const initialForm: ConsultantForm = {
  adSoyad: "",
  telefon: "",
  email: "",
  bolum: "",
  uzmanlikAlani: "",
  sozlesmeBaslangic: "",
  sozlesmeBitis: "",
  aktif: true,
}

function formatDate(val: string | null | undefined): string {
  if (!val) return ""
  return val.substring(0, 10)
}

export default function ConsultantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState<ConsultantForm>(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const set = (field: keyof ConsultantForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    async function fetchConsultant() {
      try {
        const res = await fetch(`/api/consultants/${id}`)
        if (!res.ok) throw new Error("Danisman bulunamadi")
        const data = await res.json()
        setForm({
          adSoyad: data.adSoyad || "",
          telefon: data.telefon || "",
          email: data.email || "",
          bolum: data.bolum || "",
          uzmanlikAlani: data.uzmanlikAlani || "",
          sozlesmeBaslangic: formatDate(data.sozlesmeBaslangic),
          sozlesmeBitis: formatDate(data.sozlesmeBitis),
          aktif: data.aktif ?? true,
        })
      } catch (err: any) {
        toast.error(err.message || "Veri yuklenemedi")
      } finally {
        setLoading(false)
      }
    }
    fetchConsultant()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.adSoyad) {
      toast.error("Zorunlu alanlari doldurun: Ad Soyad")
      return
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/consultants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Guncelleme basarisiz")
      }

      toast.success("Danisman basariyla guncellendi")
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
            <Link href="/personnel?tab=danisman">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {editMode ? "Danisman Duzenle" : "Danisman Detay"}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  disabled={!editMode}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danismanlik Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Danismanlik Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bolum">Bolum</Label>
                <Select
                  id="bolum"
                  value={form.bolum}
                  onChange={(e) => set("bolum", e.target.value)}
                  disabled={!editMode}
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
                <Label htmlFor="uzmanlikAlani">Uzmanlik Alani</Label>
                <Input
                  id="uzmanlikAlani"
                  value={form.uzmanlikAlani}
                  onChange={(e) => set("uzmanlikAlani", e.target.value)}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sozlesmeBaslangic">Sozlesme Baslangic</Label>
                <Input
                  id="sozlesmeBaslangic"
                  type="date"
                  value={form.sozlesmeBaslangic}
                  onChange={(e) => set("sozlesmeBaslangic", e.target.value)}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sozlesmeBitis">Sozlesme Bitis</Label>
                <Input
                  id="sozlesmeBitis"
                  type="date"
                  value={form.sozlesmeBitis}
                  onChange={(e) => set("sozlesmeBitis", e.target.value)}
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
