"use client"

// TODO: Alanlar netlesince genisletilecek

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { NativeSelect as Select } from "@/components/ui/select"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
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

export default function NewInternPage() {
  const router = useRouter()
  const [form, setForm] = useState<InternForm>(initialForm)
  const [saving, setSaving] = useState(false)

  const set = (field: keyof InternForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.adSoyad || !form.bolum) {
      toast.error("Zorunlu alanlari doldurun: Ad Soyad, Bolum")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/interns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Kayit basarisiz")
      }

      toast.success("Stajyer basariyla olusturuldu")
      router.push("/personnel?tab=stajyer")
    } catch (err: any) {
      toast.error(err.message || "Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/personnel?tab=stajyer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Yeni Stajyer</h1>
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
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefon">Telefon</Label>
                <Input
                  id="telefon"
                  value={form.telefon}
                  onChange={(e) => set("telefon", e.target.value)}
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baslangicTarihi">Baslangic Tarihi</Label>
                <Input
                  id="baslangicTarihi"
                  type="date"
                  value={form.baslangicTarihi}
                  onChange={(e) => set("baslangicTarihi", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bitisTarihi">Bitis Tarihi</Label>
                <Input
                  id="bitisTarihi"
                  type="date"
                  value={form.bitisTarihi}
                  onChange={(e) => set("bitisTarihi", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="okul">Okul</Label>
                <Input
                  id="okul"
                  value={form.okul}
                  onChange={(e) => set("okul", e.target.value)}
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
              />
              <Label htmlFor="aktif">Aktif</Label>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/personnel?tab=stajyer">Iptal</Link>
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
      </form>
    </div>
  )
}
