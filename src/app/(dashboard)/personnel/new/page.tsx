"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { NativeSelect as Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  BOLUMLER,
  KAN_GRUBU_LABELS,
  CINSIYET_LABELS,
  YAKA_LABELS,
  DIREKT_ENDIREKT_LABELS,
  ASANSOR_MEKANIK_LABELS,
} from "@/lib/personnel-constants"

type FormData = {
  sicilNo: string
  adSoyad: string
  cinsiyet: string
  sinif: string
  yakaRengi: string
  kanGrubu: string
  gorev: string
  bolum: string
  bolumDetay: string
  birimSorumlusu: string
  bolumMuduru: string
  direktEndirekt: string
  asansorMekanik: string
  masrafMerkezi: string
  iseGirisTarihi: string
  telefon: string
  interKepMail: string
  azureAdEmail: string
  egitimYeri: string
  egitimTipi: string
  egitimAlani: string
  mezuniyetYili: string
  mykUstalikKalfalik: boolean
  ilkYardimci: boolean
  emekli: boolean
  engelli: boolean
  aktif: boolean
  serviceRoute: string
  serviceStop: string
  denemeDegerlendirme: string
  altiAyDegerlendirme: string
}

const initialForm: FormData = {
  sicilNo: "",
  adSoyad: "",
  cinsiyet: "",
  sinif: "",
  yakaRengi: "",
  kanGrubu: "",
  gorev: "",
  bolum: "",
  bolumDetay: "",
  birimSorumlusu: "",
  bolumMuduru: "",
  direktEndirekt: "",
  asansorMekanik: "",
  masrafMerkezi: "",
  iseGirisTarihi: "",
  telefon: "",
  interKepMail: "",
  azureAdEmail: "",
  egitimYeri: "",
  egitimTipi: "",
  egitimAlani: "",
  mezuniyetYili: "",
  mykUstalikKalfalik: false,
  ilkYardimci: false,
  emekli: false,
  engelli: false,
  aktif: true,
  serviceRoute: "",
  serviceStop: "",
  denemeDegerlendirme: "",
  altiAyDegerlendirme: "",
}

export default function NewPersonnelPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [form, setForm] = useState<FormData>(initialForm)
  const [saving, setSaving] = useState(false)

  const set = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.sicilNo || !form.adSoyad || !form.gorev || !form.bolum || !form.iseGirisTarihi) {
      toast.error("Zorunlu alanları doldurun: Sicil No, Ad Soyad, Görev, Bölüm, İşe Giriş Tarihi")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Kayıt başarısız")
      }

      toast.success("Personel başarıyla oluşturuldu")
      router.push("/personnel")
    } catch (err: any) {
      toast.error(err.message || "Bir hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/personnel">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Yeni Personel</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Kimlik */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kimlik Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sicilNo">Sicil No *</Label>
                <Input id="sicilNo" value={form.sicilNo} onChange={(e) => set("sicilNo", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adSoyad">Ad Soyad *</Label>
                <Input id="adSoyad" value={form.adSoyad} onChange={(e) => set("adSoyad", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cinsiyet">Cinsiyet</Label>
                <Select id="cinsiyet" value={form.cinsiyet} onChange={(e) => set("cinsiyet", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(CINSIYET_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sinif">Sınıf</Label>
                <Input id="sinif" value={form.sinif} onChange={(e) => set("sinif", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yakaRengi">Yaka Rengi</Label>
                <Select id="yakaRengi" value={form.yakaRengi} onChange={(e) => set("yakaRengi", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(YAKA_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kanGrubu">Kan Grubu</Label>
                <Select id="kanGrubu" value={form.kanGrubu} onChange={(e) => set("kanGrubu", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(KAN_GRUBU_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: İstihdam */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">İstihdam Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gorev">Görev *</Label>
                <Input id="gorev" value={form.gorev} onChange={(e) => set("gorev", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolum">Bölüm *</Label>
                <Select id="bolum" value={form.bolum} onChange={(e) => set("bolum", e.target.value)} required>
                  <option value="">Seçiniz</option>
                  {BOLUMLER.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolumDetay">Bölüm Detay</Label>
                <Input id="bolumDetay" value={form.bolumDetay} onChange={(e) => set("bolumDetay", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birimSorumlusu">Birim Sorumlusu</Label>
                <Input id="birimSorumlusu" value={form.birimSorumlusu} onChange={(e) => set("birimSorumlusu", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolumMuduru">Bölüm Müdürü</Label>
                <Input id="bolumMuduru" value={form.bolumMuduru} onChange={(e) => set("bolumMuduru", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direktEndirekt">Direkt / Endirekt</Label>
                <Select id="direktEndirekt" value={form.direktEndirekt} onChange={(e) => set("direktEndirekt", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(DIREKT_ENDIREKT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asansorMekanik">Asansör / Mekanik</Label>
                <Select id="asansorMekanik" value={form.asansorMekanik} onChange={(e) => set("asansorMekanik", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(ASANSOR_MEKANIK_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="masrafMerkezi">Masraf Merkezi</Label>
                <Input id="masrafMerkezi" value={form.masrafMerkezi} onChange={(e) => set("masrafMerkezi", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iseGirisTarihi">İşe Giriş Tarihi *</Label>
                <Input id="iseGirisTarihi" type="date" value={form.iseGirisTarihi} onChange={(e) => set("iseGirisTarihi", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceRoute">Servis</Label>
                <Input id="serviceRoute" value={form.serviceRoute} onChange={(e) => set("serviceRoute", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceStop">Servis Durağı</Label>
                <Input id="serviceStop" value={form.serviceStop} onChange={(e) => set("serviceStop", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: İletişim */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">İletişim Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefon">Telefon</Label>
                <Input id="telefon" value={form.telefon} onChange={(e) => set("telefon", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interKepMail">İnterkep Mail</Label>
                <Input id="interKepMail" type="email" value={form.interKepMail} onChange={(e) => set("interKepMail", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="azureAdEmail">Azure AD Email</Label>
                <Input id="azureAdEmail" type="email" value={form.azureAdEmail} onChange={(e) => set("azureAdEmail", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Eğitim */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Eğitim Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="egitimYeri">Eğitim Yeri</Label>
                <Input id="egitimYeri" value={form.egitimYeri} onChange={(e) => set("egitimYeri", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="egitimTipi">Eğitim Tipi</Label>
                <Input id="egitimTipi" value={form.egitimTipi} onChange={(e) => set("egitimTipi", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="egitimAlani">Eğitim Alanı</Label>
                <Input id="egitimAlani" value={form.egitimAlani} onChange={(e) => set("egitimAlani", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mezuniyetYili">Mezuniyet Yılı</Label>
                <Input id="mezuniyetYili" value={form.mezuniyetYili} onChange={(e) => set("mezuniyetYili", e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mykUstalikKalfalik"
                  checked={form.mykUstalikKalfalik}
                  onCheckedChange={(v) => set("mykUstalikKalfalik", !!v)}
                />
                <Label htmlFor="mykUstalikKalfalik" className="cursor-pointer">MYK Ustalık/Kalfalık</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ilkYardimci"
                  checked={form.ilkYardimci}
                  onCheckedChange={(v) => set("ilkYardimci", !!v)}
                />
                <Label htmlFor="ilkYardimci" className="cursor-pointer">İlk Yardımcı</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Özel Durum */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Özel Durum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="emekli"
                  checked={form.emekli}
                  onCheckedChange={(v) => set("emekli", !!v)}
                />
                <Label htmlFor="emekli" className="cursor-pointer">Emekli</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="engelli"
                  checked={form.engelli}
                  onCheckedChange={(v) => set("engelli", !!v)}
                />
                <Label htmlFor="engelli" className="cursor-pointer">Engelli</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="aktif"
                  checked={form.aktif}
                  onCheckedChange={(v) => set("aktif", !!v)}
                />
                <Label htmlFor="aktif" className="cursor-pointer">Aktif</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Değerlendirme */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Değerlendirme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="denemeDegerlendirme">Deneme Süresi (2 Ay) Değerlendirme</Label>
                <Textarea
                  id="denemeDegerlendirme"
                  value={form.denemeDegerlendirme}
                  onChange={(e) => set("denemeDegerlendirme", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="altiAyDegerlendirme">İlk 6 Ay Değerlendirme</Label>
                <Textarea
                  id="altiAyDegerlendirme"
                  value={form.altiAyDegerlendirme}
                  onChange={(e) => set("altiAyDegerlendirme", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" asChild>
            <Link href="/personnel">İptal</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Kaydet
          </Button>
        </div>
      </form>
    </div>
  )
}
