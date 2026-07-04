"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { NativeSelect as Select } from "@/components/ui/select"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { PersonnelAutocomplete } from "@/components/ui/personnel-autocomplete"
import { toast } from "sonner"
import {
  KAN_GRUBU_LABELS,
  CINSIYET_LABELS,
  YAKA_LABELS,
  YAKA_DETAYI_LABELS,
  YAKA_DETAY_MAP,
  DIREKT_ENDIREKT_LABELS,
  ASANSOR_MEKANIK_LABELS,
} from "@/lib/personnel-constants"

type FormData = {
  sicilNo: string
  adSoyad: string
  cinsiyet: string
  sinif: string
  yakaRengi: string
  yakaDetayi: string
  kanGrubu: string
  gorev: string
  bolum: string
  bolumDetay: string
  birimSorumlusu: string
  sorumlu2: string
  sorumlu3: string
  bolumMuduru: string
  direktEndirekt: string
  asansorMekanik: string
  masrafMerkezi: string
  iseGirisTarihi: string
  telefon: string
  interKepMail: string
  mailAdresi: string
  ikametAdresi: string
  egitimYeri: string
  egitimTipi: string
  egitimAlani: string
  mezuniyetYili: string
  emekli: boolean
  engelli: boolean
  serviceRoute: string
  serviceStop: string
  denemeDegerlendirme: string
  altiAyDegerlendirme: string
  // Belgeler
  kalfalikBelgesi: string
  ustalikBelgesi: string
  forkliftEhliyeti: boolean
  vincEhliyeti: boolean
  ilkYardimciBelgesi: string
  yanginSertifikasi: string
  mykBelgesiTarihi: string
  eTrans: boolean
  ustaOgreticiBelgesi: boolean
  // KVKK Sensitive
  tcKimlikNo: string
  sgkNo: string
  dogumTarihi: string
  bankaSube: string
  bankaHesapNo: string
  ibanNo: string
}

const initialForm: FormData = {
  sicilNo: "",
  adSoyad: "",
  cinsiyet: "",
  sinif: "",
  yakaRengi: "",
  yakaDetayi: "",
  kanGrubu: "",
  gorev: "",
  bolum: "",
  bolumDetay: "",
  birimSorumlusu: "",
  sorumlu2: "",
  sorumlu3: "",
  bolumMuduru: "",
  direktEndirekt: "",
  asansorMekanik: "",
  masrafMerkezi: "",
  iseGirisTarihi: "",
  telefon: "",
  interKepMail: "",
  mailAdresi: "",
  ikametAdresi: "",
  egitimYeri: "",
  egitimTipi: "",
  egitimAlani: "",
  mezuniyetYili: "",
  emekli: false,
  engelli: false,
  serviceRoute: "",
  serviceStop: "",
  denemeDegerlendirme: "",
  altiAyDegerlendirme: "",
  kalfalikBelgesi: "",
  ustalikBelgesi: "",
  forkliftEhliyeti: false,
  vincEhliyeti: false,
  ilkYardimciBelgesi: "",
  yanginSertifikasi: "",
  mykBelgesiTarihi: "",
  eTrans: false,
  ustaOgreticiBelgesi: false,
  tcKimlikNo: "",
  sgkNo: "",
  dogumTarihi: "",
  bankaSube: "",
  bankaHesapNo: "",
  ibanNo: "",
}

export default function NewPersonnelPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [form, setForm] = useState<FormData>(initialForm)
  const [saving, setSaving] = useState(false)
  const [jobTitles, setJobTitles] = useState<string[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [personnelNames, setPersonnelNames] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/settings/job-titles")
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setJobTitles(data.map(j => j.name)))
      .catch(() => {})
    fetch("/api/settings/hr-departments")
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setDepartments(data.map(d => d.name)))
      .catch(() => {})
    fetch("/api/overtime/personnel-list")
      .then(r => r.ok ? r.json() : [])
      .then((data: { adSoyad: string }[]) => setPersonnelNames(data.map(p => p.adSoyad)))
      .catch(() => {})
  }, [])

  const addMonths = (iso: string, months: number): string => {
    if (!iso) return ""
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ""
    const day = d.getDate()
    d.setMonth(d.getMonth() + months)
    // Ay taşmasını düzelt (ör: 31 Ocak + 1 ay = 3 Mart yerine 28 Şubat)
    if (d.getDate() !== day) d.setDate(0)
    return d.toISOString().split("T")[0]
  }

  const set = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // İşe giriş tarihi değişince deneme (2 ay) ve 6 ay değerlendirme tarihlerini otomatik hesapla
      if (field === "iseGirisTarihi" && typeof value === "string") {
        next.denemeDegerlendirme = addMonths(value, 2)
        next.altiAyDegerlendirme = addMonths(value, 6)
      }
      // Yaka değişince yakaDetayi'yi sıfırla (yaka=BEYAZ iken MAVI detay kalmasın — tutarlılık).
      if (field === "yakaRengi") {
        next.yakaDetayi = ""
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.sicilNo || !form.adSoyad || !form.gorev || !form.bolum || !form.iseGirisTarihi) {
      toast.error("Zorunlu alanları doldurun: Sicil No, Ad Soyad, Görev, Bölüm, İşe Giriş Tarihi")
      return
    }

    // Yaka Aşama 1: yeni personel her zaman aktif → Yaka Rengi + Yaka Detayı zorunlu.
    if (!form.yakaRengi || !form.yakaDetayi) {
      toast.error("Yaka Rengi ve Yaka Detayı zorunludur")
      return
    }

    try {
      setSaving(true)
      // KVKK alanlarını sensitive olarak ayır
      const { tcKimlikNo, sgkNo, dogumTarihi, bankaSube, bankaHesapNo, ibanNo, ...personnelFields } = form
      const sensitive: Record<string, string> = {}
      if (tcKimlikNo) sensitive.tcKimlikNo = tcKimlikNo
      if (sgkNo) sensitive.sgkNo = sgkNo
      if (dogumTarihi) sensitive.dogumTarihi = dogumTarihi

      // PR-1: banka bilgisi tek primary PersonnelBankAccount olarak gönderilir (sensitive.banka* yerine).
      // Çoklu hesap, personel oluşturulduktan sonra Hassas Bilgiler sayfasından eklenir.
      const bankAccounts =
        bankaSube || bankaHesapNo || ibanNo
          ? [{ bankaSube: bankaSube || null, hesapNo: bankaHesapNo || null, ibanNo: ibanNo || null, isPrimary: true, aktif: true }]
          : undefined

      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...personnelFields,
          sensitive: Object.keys(sensitive).length > 0 ? sensitive : undefined,
          bankAccounts,
        }),
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
    <div className="space-y-4 max-w-5xl mx-auto pb-0">
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
                <Label htmlFor="yakaRengi">Yaka Rengi *</Label>
                <Select id="yakaRengi" value={form.yakaRengi} onChange={(e) => set("yakaRengi", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(YAKA_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="yakaDetayi">Yaka Detayı *</Label>
                <Select
                  id="yakaDetayi"
                  value={form.yakaDetayi}
                  onChange={(e) => set("yakaDetayi", e.target.value)}
                  disabled={!form.yakaRengi}
                >
                  <option value="">{form.yakaRengi ? "Seçiniz" : "Önce yaka seçin"}</option>
                  {(YAKA_DETAY_MAP[form.yakaRengi] ?? []).map((k) => (
                    <option key={k} value={k}>{YAKA_DETAYI_LABELS[k] ?? k}</option>
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
                <Select id="gorev" value={form.gorev} onChange={(e) => set("gorev", e.target.value)} required>
                  <option value="">Seçiniz</option>
                  {jobTitles.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolum">Bölüm *</Label>
                <Select id="bolum" value={form.bolum} onChange={(e) => set("bolum", e.target.value)} required>
                  <option value="">Seçiniz</option>
                  {departments.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolumDetay">Bölüm Detay</Label>
                <Input id="bolumDetay" value={form.bolumDetay} onChange={(e) => set("bolumDetay", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birimSorumlusu">1. Sorumlu</Label>
                <PersonnelAutocomplete id="birimSorumlusu" value={form.birimSorumlusu} onChange={(v) => set("birimSorumlusu", v)} personnel={personnelNames} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sorumlu2">2. Sorumlu</Label>
                <PersonnelAutocomplete id="sorumlu2" value={form.sorumlu2} onChange={(v) => set("sorumlu2", v)} personnel={personnelNames} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sorumlu3">3. Sorumlu</Label>
                <PersonnelAutocomplete id="sorumlu3" value={form.sorumlu3} onChange={(v) => set("sorumlu3", v)} personnel={personnelNames} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolumMuduru">Bölüm Müdürü</Label>
                <PersonnelAutocomplete id="bolumMuduru" value={form.bolumMuduru} onChange={(v) => set("bolumMuduru", v)} personnel={personnelNames} />
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
                <Select id="masrafMerkezi" value={form.masrafMerkezi} onChange={(e) => set("masrafMerkezi", e.target.value)}>
                  <option value="">Seçiniz</option>
                  <option value="720.1.01">720.1.01</option>
                  <option value="750.1.01">750.1.01</option>
                  <option value="760.1.01">760.1.01</option>
                  <option value="770.1.01">770.1.01</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="iseGirisTarihi">İşe Giriş Tarihi *</Label>
                <Input id="iseGirisTarihi" type="date" value={form.iseGirisTarihi} onChange={(e) => set("iseGirisTarihi", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceRoute">Servis</Label>
                <Select id="serviceRoute" value={form.serviceRoute} onChange={(e) => set("serviceRoute", e.target.value)}>
                  <option value="">Seçiniz</option>
                  <option value="ARAPÇEŞME">ARAPÇEŞME</option>
                  <option value="AYDOS-KURTKÖY">AYDOS-KURTKÖY</option>
                  <option value="KAVACIK-BEYKOZ">KAVACIK-BEYKOZ</option>
                  <option value="BEYLİKBAĞI GÜZELTEPE">BEYLİKBAĞI GÜZELTEPE</option>
                  <option value="BEYLİKBAĞI ULAŞTEPE">BEYLİKBAĞI ULAŞTEPE</option>
                  <option value="DARICA">DARICA</option>
                  <option value="ÇARŞI-DEVELİ">ÇARŞI-DEVELİ</option>
                  <option value="KAYNARCA-KARTAL">KAYNARCA-KARTAL</option>
                  <option value="ÜSKÜDAR">ÜSKÜDAR</option>
                </Select>
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
                <Label htmlFor="interKepMail">KEP Adresi</Label>
                <Input id="interKepMail" type="email" value={form.interKepMail} onChange={(e) => set("interKepMail", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mailAdresi">Mail Adresi</Label>
                <Input id="mailAdresi" type="email" value={form.mailAdresi} onChange={(e) => set("mailAdresi", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="ikametAdresi">İkamet Adresi</Label>
                <Input id="ikametAdresi" value={form.ikametAdresi} onChange={(e) => set("ikametAdresi", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KVKK - Hassas Veriler */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">KVKK - Hassas Veriler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tcKimlikNo">TC Kimlik No</Label>
                <Input id="tcKimlikNo" value={form.tcKimlikNo} onChange={(e) => set("tcKimlikNo", e.target.value)} maxLength={11} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sgkNo">SGK No</Label>
                <Input id="sgkNo" value={form.sgkNo} onChange={(e) => set("sgkNo", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dogumTarihi">Doğum Tarihi</Label>
                <Input id="dogumTarihi" type="date" value={form.dogumTarihi} onChange={(e) => set("dogumTarihi", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankaSube">Banka Şube</Label>
                <Input id="bankaSube" value={form.bankaSube} onChange={(e) => set("bankaSube", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankaHesapNo">Banka Hesap No</Label>
                <Input id="bankaHesapNo" value={form.bankaHesapNo} onChange={(e) => set("bankaHesapNo", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ibanNo">IBAN No</Label>
                <Input id="ibanNo" value={form.ibanNo} onChange={(e) => set("ibanNo", e.target.value)} placeholder="TR..." />
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
                <Select id="egitimTipi" value={form.egitimTipi} onChange={(e) => set("egitimTipi", e.target.value)}>
                  <option value="">Seçiniz</option>
                  <option value="İlköğretim">İlköğretim</option>
                  <option value="Lise">Lise</option>
                  <option value="E.M.L.">E.M.L.</option>
                  <option value="T.M.L">T.M.L</option>
                  <option value="M.Y.O.">M.Y.O.</option>
                  <option value="Üniversite">Üniversite</option>
                  <option value="ÜNİVERSİTE MH.">ÜNİVERSİTE MH.</option>
                  <option value="ÜNİVERSİTE Y.L.">ÜNİVERSİTE Y.L.</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="egitimAlani">Eğitim Alanı</Label>
                <Input id="egitimAlani" value={form.egitimAlani} onChange={(e) => set("egitimAlani", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mezuniyetYili">Mezuniyet Yılı</Label>
                <Input id="mezuniyetYili" value={form.mezuniyetYili} onChange={(e) => set("mezuniyetYili", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Belgeler */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Belgeler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ilkYardimciBelgesi">İlk Yardımcı Belgesi Tarihi</Label>
                <Input id="ilkYardimciBelgesi" type="date" value={form.ilkYardimciBelgesi} onChange={(e) => set("ilkYardimciBelgesi", e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="kalfalikBelgesi" checked={!!form.kalfalikBelgesi} onCheckedChange={(c) => set("kalfalikBelgesi", c ? new Date().toISOString() : "")} />
                  <Label htmlFor="kalfalikBelgesi" className="cursor-pointer">Kalfalık Belgesi Var</Label>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="ustalikBelgesi" checked={!!form.ustalikBelgesi} onCheckedChange={(c) => set("ustalikBelgesi", c ? new Date().toISOString() : "")} />
                  <Label htmlFor="ustalikBelgesi" className="cursor-pointer">Ustalık Belgesi Var</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="yanginSertifikasi">Yangın Sertifikası Tarihi</Label>
                <Input id="yanginSertifikasi" type="date" value={form.yanginSertifikasi} onChange={(e) => set("yanginSertifikasi", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mykBelgesiTarihi">MYK Belgesi Geçerlilik Tarihi</Label>
                <Input id="mykBelgesiTarihi" type="date" value={form.mykBelgesiTarihi} onChange={(e) => set("mykBelgesiTarihi", e.target.value)} />
              </div>
              <div className="col-span-1" />
              <div className="col-span-1" />
              <div className="flex flex-wrap gap-6 items-center md:col-span-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="forkliftEhliyeti" checked={form.forkliftEhliyeti} onCheckedChange={(v) => set("forkliftEhliyeti", !!v)} />
                  <Label htmlFor="forkliftEhliyeti" className="cursor-pointer">Forklift Ehliyet</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="vincEhliyeti" checked={form.vincEhliyeti} onCheckedChange={(v) => set("vincEhliyeti", !!v)} />
                  <Label htmlFor="vincEhliyeti" className="cursor-pointer">Vinç Operatörlük Ehliyet</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="eTrans" checked={form.eTrans} onCheckedChange={(v) => set("eTrans", !!v)} />
                  <Label htmlFor="eTrans" className="cursor-pointer">E.Transpalet Ehliyet</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ustaOgreticiBelgesi" checked={form.ustaOgreticiBelgesi} onCheckedChange={(v) => set("ustaOgreticiBelgesi", !!v)} />
                  <Label htmlFor="ustaOgreticiBelgesi" className="cursor-pointer">Usta Öğretici Belgesi</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Özel Durum */}
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
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Değerlendirme */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Değerlendirme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Değerlendirme tarihleri, İşe Giriş Tarihi alanından otomatik hesaplanır.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="denemeDegerlendirme">Deneme Süresi (2 Ay) Değerlendirme</Label>
                  <Input
                    id="denemeDegerlendirme"
                    type="date"
                    value={form.denemeDegerlendirme}
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="altiAyDegerlendirme">İlk 6 Ay Değerlendirme</Label>
                  <Input
                    id="altiAyDegerlendirme"
                    type="date"
                    value={form.altiAyDegerlendirme}
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                </div>
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
