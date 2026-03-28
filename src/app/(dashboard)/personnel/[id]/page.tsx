"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { NativeSelect as Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, Loader2, Pencil, Shield, Eye } from "lucide-react"
import { toast } from "sonner"
import {
  BOLUMLER,
  KAN_GRUBU_LABELS,
  CINSIYET_LABELS,
  YAKA_LABELS,
  DIREKT_ENDIREKT_LABELS,
  ASANSOR_MEKANIK_LABELS,
} from "@/lib/personnel-constants"

type PersonnelData = {
  id: string
  sicilNo: string
  adSoyad: string
  cinsiyet: string | null
  sinif: string | null
  yakaRengi: string | null
  kanGrubu: string | null
  gorev: string | null
  bolum: string | null
  bolumDetay: string | null
  birimSorumlusu: string | null
  bolumMuduru: string | null
  direktEndirekt: string | null
  asansorMekanik: string | null
  masrafMerkezi: string | null
  iseGirisTarihi: string | null
  telefon: string | null
  interKepMail: string | null
  azureAdEmail: string | null
  egitimYeri: string | null
  egitimTipi: string | null
  egitimAlani: string | null
  mezuniyetYili: string | null
  mykUstalikKalfalik: boolean
  ilkYardimci: boolean
  emekli: boolean
  engelli: boolean
  aktif: boolean
  denemeDegerlendirme: string | null
  altiAyDegerlendirme: string | null
}

const ADMIN_ROLES = ["ADMIN", "HR_MANAGER", "SUPER_ADMIN"]

export default function PersonnelDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const userRole = session?.user?.role as string
  const isAdmin = ADMIN_ROLES.includes(userRole)

  const [data, setData] = useState<PersonnelData | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(searchParams.get("edit") === "true")

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/personnel/${id}`)
        if (!res.ok) throw new Error("Veri yüklenemedi")
        const json = await res.json()
        setData(json)
        // Prepare form data
        const formData: Record<string, any> = {}
        Object.entries(json).forEach(([k, v]) => {
          if (k === "iseGirisTarihi" && v) {
            formData[k] = new Date(v as string).toISOString().slice(0, 10)
          } else {
            formData[k] = v ?? ""
          }
        })
        setForm(formData)
      } catch (err: any) {
        toast.error(err.message || "Veriler yüklenemedi")
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchData()
  }, [id])

  const set = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!form.sicilNo || !form.adSoyad) {
      toast.error("Sicil No ve Ad Soyad zorunludur")
      return
    }
    try {
      setSaving(true)
      const res = await fetch(`/api/personnel/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Güncelleme başarısız")
      }
      toast.success("Personel güncellendi")
      setEditMode(false)
      // Refresh data
      const updated = await res.json()
      setData(updated)
    } catch (err: any) {
      toast.error(err.message || "Bir hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR")
    } catch {
      return "-"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>Personel bulunamadı</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/personnel">Listeye Dön</Link>
        </Button>
      </div>
    )
  }

  // Display mode helper
  const displayValue = (value: string | null | undefined, labelsMap?: Record<string, string>) => {
    if (!value) return "-"
    if (labelsMap && labelsMap[value]) return labelsMap[value]
    return value
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/personnel">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{data.adSoyad}</h1>
            <p className="text-sm text-muted-foreground">Sicil No: {data.sicilNo}</p>
          </div>
          {!data.aktif && <Badge variant="destructive">Pasif</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/personnel/${id}/sensitive`}>
                <Shield className="h-4 w-4 mr-2" />
                Hassas Bilgiler
              </Link>
            </Button>
          )}
          {isAdmin && !editMode && (
            <Button size="sm" onClick={() => setEditMode(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Düzenle
            </Button>
          )}
          {editMode && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                İptal
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Kaydet
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Section 1: Kimlik */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kimlik Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Sicil No *</Label>
                <Input value={form.sicilNo || ""} onChange={(e) => set("sicilNo", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ad Soyad *</Label>
                <Input value={form.adSoyad || ""} onChange={(e) => set("adSoyad", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cinsiyet</Label>
                <Select value={form.cinsiyet || ""} onChange={(e) => set("cinsiyet", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(CINSIYET_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sınıf</Label>
                <Input value={form.sinif || ""} onChange={(e) => set("sinif", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Yaka Rengi</Label>
                <Select value={form.yakaRengi || ""} onChange={(e) => set("yakaRengi", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(YAKA_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kan Grubu</Label>
                <Select value={form.kanGrubu || ""} onChange={(e) => set("kanGrubu", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(KAN_GRUBU_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><p className="text-sm text-muted-foreground">Sicil No</p><p className="font-medium">{data.sicilNo}</p></div>
              <div><p className="text-sm text-muted-foreground">Ad Soyad</p><p className="font-medium">{data.adSoyad}</p></div>
              <div><p className="text-sm text-muted-foreground">Cinsiyet</p><p className="font-medium">{displayValue(data.cinsiyet, CINSIYET_LABELS)}</p></div>
              <div><p className="text-sm text-muted-foreground">Sınıf</p><p className="font-medium">{data.sinif || "-"}</p></div>
              <div>
                <p className="text-sm text-muted-foreground">Yaka Rengi</p>
                <div>
                  {data.yakaRengi === "MAVI" && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Mavi Yaka</Badge>}
                  {data.yakaRengi === "BEYAZ" && <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Beyaz Yaka</Badge>}
                  {!data.yakaRengi && <p className="font-medium">-</p>}
                </div>
              </div>
              <div><p className="text-sm text-muted-foreground">Kan Grubu</p><p className="font-medium">{displayValue(data.kanGrubu, KAN_GRUBU_LABELS)}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: İstihdam */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">İstihdam Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Görev *</Label>
                <Input value={form.gorev || ""} onChange={(e) => set("gorev", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bölüm *</Label>
                <Select value={form.bolum || ""} onChange={(e) => set("bolum", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {BOLUMLER.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bölüm Detay</Label>
                <Input value={form.bolumDetay || ""} onChange={(e) => set("bolumDetay", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Birim Sorumlusu</Label>
                <Input value={form.birimSorumlusu || ""} onChange={(e) => set("birimSorumlusu", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bölüm Müdürü</Label>
                <Input value={form.bolumMuduru || ""} onChange={(e) => set("bolumMuduru", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Direkt / Endirekt</Label>
                <Select value={form.direktEndirekt || ""} onChange={(e) => set("direktEndirekt", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(DIREKT_ENDIREKT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asansör / Mekanik</Label>
                <Select value={form.asansorMekanik || ""} onChange={(e) => set("asansorMekanik", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(ASANSOR_MEKANIK_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Masraf Merkezi</Label>
                <Input value={form.masrafMerkezi || ""} onChange={(e) => set("masrafMerkezi", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>İşe Giriş Tarihi *</Label>
                <Input type="date" value={form.iseGirisTarihi || ""} onChange={(e) => set("iseGirisTarihi", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-muted-foreground">Görev</p><p className="font-medium">{data.gorev || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Bölüm</p><p className="font-medium">{data.bolum || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Bölüm Detay</p><p className="font-medium">{data.bolumDetay || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Birim Sorumlusu</p><p className="font-medium">{data.birimSorumlusu || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Bölüm Müdürü</p><p className="font-medium">{data.bolumMuduru || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Direkt / Endirekt</p><p className="font-medium">{displayValue(data.direktEndirekt, DIREKT_ENDIREKT_LABELS)}</p></div>
              <div><p className="text-sm text-muted-foreground">Asansör / Mekanik</p><p className="font-medium">{displayValue(data.asansorMekanik, ASANSOR_MEKANIK_LABELS)}</p></div>
              <div><p className="text-sm text-muted-foreground">Masraf Merkezi</p><p className="font-medium">{data.masrafMerkezi || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">İşe Giriş Tarihi</p><p className="font-medium">{formatDate(data.iseGirisTarihi)}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: İletişim */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">İletişim Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={form.telefon || ""} onChange={(e) => set("telefon", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>İnterkep Mail</Label>
                <Input type="email" value={form.interKepMail || ""} onChange={(e) => set("interKepMail", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Azure AD Email</Label>
                <Input type="email" value={form.azureAdEmail || ""} onChange={(e) => set("azureAdEmail", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><p className="text-sm text-muted-foreground">Telefon</p><p className="font-medium">{data.telefon || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">İnterkep Mail</p><p className="font-medium">{data.interKepMail || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Azure AD Email</p><p className="font-medium">{data.azureAdEmail || "-"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Eğitim */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Eğitim Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Eğitim Yeri</Label>
                <Input value={form.egitimYeri || ""} onChange={(e) => set("egitimYeri", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Eğitim Tipi</Label>
                <Input value={form.egitimTipi || ""} onChange={(e) => set("egitimTipi", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Eğitim Alanı</Label>
                <Input value={form.egitimAlani || ""} onChange={(e) => set("egitimAlani", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mezuniyet Yılı</Label>
                <Input value={form.mezuniyetYili || ""} onChange={(e) => set("mezuniyetYili", e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="edit-myk" checked={!!form.mykUstalikKalfalik} onCheckedChange={(v) => set("mykUstalikKalfalik", !!v)} />
                <Label htmlFor="edit-myk" className="cursor-pointer">MYK Ustalık/Kalfalık</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="edit-ilkyardim" checked={!!form.ilkYardimci} onCheckedChange={(v) => set("ilkYardimci", !!v)} />
                <Label htmlFor="edit-ilkyardim" className="cursor-pointer">İlk Yardımcı</Label>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-muted-foreground">Eğitim Yeri</p><p className="font-medium">{data.egitimYeri || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Eğitim Tipi</p><p className="font-medium">{data.egitimTipi || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Eğitim Alanı</p><p className="font-medium">{data.egitimAlani || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Mezuniyet Yılı</p><p className="font-medium">{data.mezuniyetYili || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">MYK Ustalık/Kalfalık</p><p className="font-medium">{data.mykUstalikKalfalik ? "Evet" : "Hayır"}</p></div>
              <div><p className="text-sm text-muted-foreground">İlk Yardımcı</p><p className="font-medium">{data.ilkYardimci ? "Evet" : "Hayır"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Özel Durum */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Özel Durum</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="edit-emekli" checked={!!form.emekli} onCheckedChange={(v) => set("emekli", !!v)} />
                <Label htmlFor="edit-emekli" className="cursor-pointer">Emekli</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="edit-engelli" checked={!!form.engelli} onCheckedChange={(v) => set("engelli", !!v)} />
                <Label htmlFor="edit-engelli" className="cursor-pointer">Engelli</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="edit-aktif" checked={!!form.aktif} onCheckedChange={(v) => set("aktif", !!v)} />
                <Label htmlFor="edit-aktif" className="cursor-pointer">Aktif</Label>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-6">
              <div><p className="text-sm text-muted-foreground">Emekli</p><p className="font-medium">{data.emekli ? "Evet" : "Hayır"}</p></div>
              <div><p className="text-sm text-muted-foreground">Engelli</p><p className="font-medium">{data.engelli ? "Evet" : "Hayır"}</p></div>
              <div><p className="text-sm text-muted-foreground">Aktif</p><p className="font-medium">{data.aktif ? "Evet" : "Hayır"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 6: Değerlendirme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Değerlendirme</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deneme Süresi (2 Ay) Değerlendirme</Label>
                <Textarea value={form.denemeDegerlendirme || ""} onChange={(e) => set("denemeDegerlendirme", e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>İlk 6 Ay Değerlendirme</Label>
                <Textarea value={form.altiAyDegerlendirme || ""} onChange={(e) => set("altiAyDegerlendirme", e.target.value)} rows={3} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-muted-foreground">Deneme Süresi (2 Ay) Değerlendirme</p><p className="font-medium whitespace-pre-wrap">{data.denemeDegerlendirme || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">İlk 6 Ay Değerlendirme</p><p className="font-medium whitespace-pre-wrap">{data.altiAyDegerlendirme || "-"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
