'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MusteriSecici, type MusteriOption } from '@/components/quality/rma/MusteriSecici'
import { HataKoduSecici, type HataKoduSecenek } from './HataKoduSecici'
import {
  UYGUNSUZLUK_KARAR_OPTIONS,
  UYGUNSUZLUK_DURUM_LABELS,
  redOrani,
  formatOran,
  hesaplaDurum,
} from '@/lib/quality/uygunsuzluk-labels'
import { UygunsuzlukDosyaPaneli } from './UygunsuzlukDosyaPaneli'

// ── Tipler ──
interface SatirState {
  key: string
  yariMamulKodu: string
  malzemeAdi: string
  redAdeti: string
  reworkAdedi: string
  hurdaAdedi: string
  olusanBolumId: string | null
  hataKoduId: string | null
  hataDetayi: string
  karar: string
}

export interface UygunsuzlukDetay {
  id: string
  no: number
  tarih: string
  mamulUrunKodu: string
  altParcaKodu: string | null
  musteriAdi: string | null
  isEmriNo: string
  isEmriAdeti: number | null
  kategoriId: string | null
  kategori?: { id: string; ad: string } | null
  tespitEdenBolumId: string | null
  kokNeden: string | null
  kacisKokNedeni: string | null
  duzelticiFaaliyet: string | null
  geciciAksiyon: string | null
  sorumluId: string | null
  sorumlu?: { adSoyad: string; sicilNo: string | null } | null
  onaylayanId: string | null
  onaylayan?: { adSoyad: string; sicilNo: string | null } | null
  katilimcilar: { id: string; adSoyad: string; sicilNo: string | null }[]
  termin: string | null
  kapanisTarihi: string | null
  ogrenilmisDersler: string[]
  tarihGecmisi: {
    alanAdi: string
    eskiDeger: string | null
    yeniDeger: string | null
    degistirenAdi: string | null
    degistirmeTarihi: string
  }[]
  dosyalar: {
    id: string
    dosyaAdi: string
    dosyaUrl: string
    dosyaBoyutu: number | null
    yuklemeTarihi: string
  }[]
  satirlar: {
    siraNo: number
    yariMamulKodu: string | null
    malzemeAdi: string | null
    redAdeti: number
    reworkAdedi: number | null
    hurdaAdedi: number | null
    olusanBolumId: string | null
    hataKoduId: string | null
    hataDetayi: string | null
    karar: string | null
  }[]
}

let keySeq = 0
const yeniSatir = (): SatirState => ({
  key: `s${keySeq++}`,
  yariMamulKodu: '',
  malzemeAdi: '',
  redAdeti: '',
  reworkAdedi: '',
  hurdaAdedi: '',
  olusanBolumId: null,
  hataKoduId: null,
  hataDetayi: '',
  karar: '',
})

/** ISO → yyyy-MM-dd (date input için) */
function isoToDate(v: string | null): string {
  if (!v) return ''
  return new Date(v).toISOString().slice(0, 10)
}

/**
 * Uygunsuzluk formu (KAL-KYT-15 Bölüm 2).
 *
 * RmaFormClient deseni: elle kontrollü `useState` + shadcn primitifleri.
 * react-hook-form / SurveyRenderer KULLANILMIYOR (portalda RMA da öyle).
 * Etiketler `uygunsuzluk-labels.ts` — tek kaynak.
 */
export function UygunsuzlukFormClient({
  initial,
  canManage,
}: {
  initial: UygunsuzlukDetay | null
  canManage: boolean
}) {
  const router = useRouter()
  const ro = !canManage

  const [kodlar, setKodlar] = useState<HataKoduSecenek[]>([])

  const [kategoriler, setKategoriler] = useState<{ id: string; ad: string }[]>(
    initial?.kategori ? [initial.kategori] : [],
  )
  const [kategoriId, setKategoriId] = useState<string | null>(initial?.kategoriId ?? null)

  useEffect(() => {
    fetch('/api/quality/uygunsuzluk-kategori')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        const gelenler: { id: string; ad: string }[] = j.items ?? []
        // Kaydın mevcut kategorisi pasifleşmiş olsa bile listede kalsın.
        setKategoriler((prev) => {
          const mevcut = prev.find((k) => k.id === initial?.kategoriId)
          return mevcut && !gelenler.some((g) => g.id === mevcut.id) ? [...gelenler, mevcut] : gelenler
        })
      })
      .catch(() => {})
  }, [initial?.kategoriId])

  const [tarih, setTarih] = useState(initial ? isoToDate(initial.tarih) : '')
  const [mamulUrunKodu, setMamulUrunKodu] = useState(initial?.mamulUrunKodu ?? '')
  const [altParcaKodu, setAltParcaKodu] = useState(initial?.altParcaKodu ?? '')
  const [musteriAdi, setMusteriAdi] = useState(initial?.musteriAdi ?? '')
  const [isEmriNo, setIsEmriNo] = useState(initial?.isEmriNo ?? '')
  const [isEmriAdeti, setIsEmriAdeti] = useState(
    initial?.isEmriAdeti != null ? String(initial.isEmriAdeti) : '',
  )
  const [tespitEdenBolumId, setTespitEdenBolumId] = useState<string | null>(
    initial?.tespitEdenBolumId ?? null,
  )
  const [kokNeden, setKokNeden] = useState(initial?.kokNeden ?? '')
  const [kacisKokNedeni, setKacisKokNedeni] = useState(initial?.kacisKokNedeni ?? '')
  const [duzelticiFaaliyet, setDuzelticiFaaliyet] = useState(initial?.duzelticiFaaliyet ?? '')
  const [geciciAksiyon, setGeciciAksiyon] = useState(initial?.geciciAksiyon ?? '')
  const [sorumlu, setSorumlu] = useState<MusteriOption | null>(
    initial?.sorumluId && initial.sorumlu
      ? {
          id: initial.sorumluId,
          code: initial.sorumlu.sicilNo ?? '',
          name: initial.sorumlu.adSoyad,
        }
      : null,
  )
  const [onaylayan, setOnaylayan] = useState<MusteriOption | null>(
    initial?.onaylayanId && initial.onaylayan
      ? {
          id: initial.onaylayanId,
          code: initial.onaylayan.sicilNo ?? '',
          name: initial.onaylayan.adSoyad,
        }
      : null,
  )
  const [katilimcilar, setKatilimcilar] = useState<MusteriOption[]>(
    initial?.katilimcilar.map((k) => ({ id: k.id, code: k.sicilNo ?? '', name: k.adSoyad })) ?? [],
  )
  const [termin, setTermin] = useState(initial ? isoToDate(initial.termin) : '')
  const [kapanisTarihi, setKapanisTarihi] = useState(initial ? isoToDate(initial.kapanisTarihi) : '')
  const [ogrenilmisDersler, setOgrenilmisDersler] = useState(
    initial?.ogrenilmisDersler?.join('\n') ?? '',
  )

  function katilimciEkle(m: MusteriOption | null) {
    if (!m) return
    setKatilimcilar((prev) => (prev.some((k) => k.id === m.id) ? prev : [...prev, m]))
  }
  function katilimciCikar(id: string) {
    setKatilimcilar((prev) => prev.filter((k) => k.id !== id))
  }

  const [satirlar, setSatirlar] = useState<SatirState[]>(
    initial && initial.satirlar.length
      ? initial.satirlar.map((s) => ({
          key: `s${keySeq++}`,
          yariMamulKodu: s.yariMamulKodu ?? '',
          malzemeAdi: s.malzemeAdi ?? '',
          redAdeti: String(s.redAdeti),
          reworkAdedi: s.reworkAdedi != null ? String(s.reworkAdedi) : '',
          hurdaAdedi: s.hurdaAdedi != null ? String(s.hurdaAdedi) : '',
          olusanBolumId: s.olusanBolumId,
          hataKoduId: s.hataKoduId,
          hataDetayi: s.hataDetayi ?? '',
          karar: s.karar ?? '',
        }))
      : [yeniSatir()],
  )
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // Seçiciler için hata kodu listesi — tek istek, tip'e göre burada süzülür.
  useEffect(() => {
    fetch('/api/quality/hata-kodu?duz=1')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => setKodlar(j.items ?? []))
      .catch(() => setKodlar([]))
  }, [])

  const bolumSecenekleri = kodlar.filter((k) => k.tip === 'BOLUM')
  const kodSecenekleri = kodlar.filter((k) => k.tip === 'KOD')
  /** Hata kodu satırında ait olduğu bölümü göster (dünkü düz liste mantığı). */
  const kodBolumEtiketi = (s: HataKoduSecenek) => {
    if (!s.ustKodId) return 'Genel'
    const p = kodlar.find((k) => k.id === s.ustKodId)
    return p ? `${p.kod} ${p.ad}` : 'Genel'
  }

  function updSatir(i: number, patch: Partial<SatirState>) {
    setSatirlar((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  const toplamRed = satirlar.reduce((t, s) => t + (Number(s.redAdeti) || 0), 0)
  const oran = redOrani(toplamRed, Number(isEmriAdeti) || null)

  const durumGuncel = hesaplaDurum({
    kapanisTarihi: kapanisTarihi || null,
    kokNeden,
    kacisKokNedeni,
    duzelticiFaaliyet,
    geciciAksiyon,
    sorumluId: sorumlu?.id ?? null,
    onaylayanId: onaylayan?.id ?? null,
    termin: termin || null,
  })
  const durumRenk: Record<string, string> = {
    ACIK: 'bg-amber-100 text-amber-800',
    DEVAM_EDIYOR: 'bg-blue-100 text-blue-800',
    KAPALI: 'bg-green-100 text-green-800',
  }

  async function kaydet() {
    if (kaydediliyor) return
    if (!tarih) return void toast.error('Tarih zorunlu')
    if (!mamulUrunKodu.trim()) return void toast.error('Mamul ürün kodu zorunlu')
    if (!isEmriNo.trim()) return void toast.error('İş emri no zorunlu')
    if (satirlar.length === 0) return void toast.error('En az bir ürün satırı gerekli')

    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i]
      const red = Number(s.redAdeti)
      if (!s.redAdeti || !Number.isInteger(red) || red < 1) {
        return void toast.error(`Satır ${i + 1}: red adeti ≥ 1 olmalı`)
      }
      const rework = s.reworkAdedi ? Number(s.reworkAdedi) : 0
      if (rework > red) {
        return void toast.error(`Satır ${i + 1}: rework (${rework}), red adetini (${red}) aşamaz`)
      }
    }

    setKaydediliyor(true)
    try {
      const body = {
        tarih,
        mamulUrunKodu: mamulUrunKodu.trim(),
        altParcaKodu: altParcaKodu.trim() || null,
        musteriAdi: musteriAdi.trim() || null,
        isEmriNo: isEmriNo.trim(),
        isEmriAdeti: isEmriAdeti ? Number(isEmriAdeti) : null,
        kategoriId,
        tespitEdenBolumId,
        kokNeden: kokNeden.trim() || null,
        kacisKokNedeni: kacisKokNedeni.trim() || null,
        duzelticiFaaliyet: duzelticiFaaliyet.trim() || null,
        geciciAksiyon: geciciAksiyon.trim() || null,
        sorumluId: sorumlu?.id ?? null,
        onaylayanId: onaylayan?.id ?? null,
        termin: termin || null,
        kapanisTarihi: kapanisTarihi || null,
        ogrenilmisDersler: ogrenilmisDersler
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        katilimciIds: katilimcilar.map((k) => k.id),
        satirlar: satirlar.map((s, i) => ({
          siraNo: i + 1,
          yariMamulKodu: s.yariMamulKodu.trim() || null,
          malzemeAdi: s.malzemeAdi.trim() || null,
          redAdeti: Number(s.redAdeti),
          reworkAdedi: s.reworkAdedi ? Number(s.reworkAdedi) : null,
          hurdaAdedi: s.hurdaAdedi ? Number(s.hurdaAdedi) : null,
          olusanBolumId: s.olusanBolumId,
          hataKoduId: s.hataKoduId,
          hataDetayi: s.hataDetayi.trim() || null,
          karar: s.karar || null,
        })),
      }

      const res = await fetch(
        initial ? `/api/quality/uygunsuzluk/${initial.id}` : '/api/quality/uygunsuzluk',
        {
          method: initial ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const saved = await res.json().catch(() => null)
      // API hata metni OLDUĞU GİBİ gösterilir (referans kısıtı mesajları dahil).
      if (!res.ok) throw new Error(saved?.error || 'Kayıt başarısız')

      toast.success(initial ? 'Kayıt güncellendi' : `Kayıt oluşturuldu (No: ${saved.no})`)
      router.push(`/kalite/uygunsuzluk/${saved.id}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata')
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link href="/kalite/uygunsuzluk">
              <ArrowLeft className="h-4 w-4 mr-1" /> Listeye dön
            </Link>
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-[#1B4F72]">
              {initial ? `Uygunsuzluk No: ${initial.no}` : 'Yeni Uygunsuzluk'}
            </h1>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${durumRenk[durumGuncel]}`}>
              {UYGUNSUZLUK_DURUM_LABELS[durumGuncel]}
            </span>
          </div>
        </div>
        {canManage && (
          <Button
            onClick={kaydet}
            disabled={kaydediliyor}
            className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 shrink-0"
          >
            {kaydediliyor ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Kaydet
          </Button>
        )}
      </div>

      {/* ── Başlık ── */}
      <div className="rounded-md border bg-white p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-slate-600">Tarih *</Label>
          <Input type="date" value={tarih} disabled={ro} onChange={(e) => setTarih(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Mamul ürün kodu *</Label>
          <Input value={mamulUrunKodu} disabled={ro} onChange={(e) => setMamulUrunKodu(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Alt parça kodu</Label>
          <Input value={altParcaKodu} disabled={ro} onChange={(e) => setAltParcaKodu(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Müşteri adı</Label>
          <Input value={musteriAdi} disabled={ro} onChange={(e) => setMusteriAdi(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">İş emri no *</Label>
          <Input value={isEmriNo} disabled={ro} onChange={(e) => setIsEmriNo(e.target.value)} className="mt-1 h-9 font-quality-mono" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">İş emri adeti</Label>
          <Input type="number" min={1} value={isEmriAdeti} disabled={ro} onChange={(e) => setIsEmriAdeti(e.target.value)} className="mt-1 h-9" />
          <p className="mt-1 text-[11px] text-slate-400">Red oranı bu değere göre hesaplanır</p>
        </div>
        <div className="lg:col-span-2">
          <Label className="text-xs text-slate-600">Tespit eden bölüm</Label>
          <div className="mt-1">
            <HataKoduSecici
              value={tespitEdenBolumId}
              onChange={setTespitEdenBolumId}
              secenekler={bolumSecenekleri}
              placeholder="Bölüm ara…"
              disabled={ro}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Aksiyon sorumlusu</Label>
          <div className="mt-1">
            <MusteriSecici
              value={sorumlu}
              onChange={setSorumlu}
              disabled={ro}
              searchUrl="/api/quality/rma/sorumlu-ara"
              placeholder="Personel ara…"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Aksiyon onaylayan</Label>
          <div className="mt-1">
            <MusteriSecici
              value={onaylayan}
              onChange={setOnaylayan}
              disabled={ro}
              searchUrl="/api/quality/rma/sorumlu-ara"
              placeholder="Personel ara…"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Termin</Label>
          <Input type="date" value={termin} disabled={ro} onChange={(e) => setTermin(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Kapanış tarihi</Label>
          <Input type="date" value={kapanisTarihi} disabled={ro} onChange={(e) => setKapanisTarihi(e.target.value)} className="mt-1 h-9" />
        </div>
        {initial && initial.tarihGecmisi.length > 0 && (
          <div className="md:col-span-2 lg:col-span-3">
            <Label className="text-xs text-slate-600">Tarih revizyon geçmişi</Label>
            <div className="mt-1 space-y-1">
              {initial.tarihGecmisi.map((t, i) => {
                const alanEtiket = t.alanAdi === 'termin' ? 'Termin' : 'Kapanış tarihi'
                return (
                  <p key={i} className="text-xs text-slate-500">
                    <span className="font-medium">{alanEtiket}:</span>{' '}
                    {t.eskiDeger ? new Date(t.eskiDeger).toLocaleDateString('tr-TR') : 'boş'}
                    {' → '}
                    {t.yeniDeger ? new Date(t.yeniDeger).toLocaleDateString('tr-TR') : 'boş'}
                    {' — '}
                    {t.degistirenAdi ?? 'bilinmiyor'}, {new Date(t.degistirmeTarihi).toLocaleString('tr-TR')}
                  </p>
                )
              })}
            </div>
          </div>
        )}
        <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-600">Kök neden (oluşum)</Label>
            <Textarea value={kokNeden} disabled={ro} onChange={(e) => setKokNeden(e.target.value)} rows={3} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Kaçış kök nedeni</Label>
            <Textarea value={kacisKokNedeni} disabled={ro} onChange={(e) => setKacisKokNedeni(e.target.value)} rows={3} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Geçici aksiyon</Label>
            <Textarea value={geciciAksiyon} disabled={ro} onChange={(e) => setGeciciAksiyon(e.target.value)} rows={3} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Kalıcı aksiyon (düzeltici faaliyet)</Label>
            <Textarea value={duzelticiFaaliyet} disabled={ro} onChange={(e) => setDuzelticiFaaliyet(e.target.value)} rows={3} className="mt-1" />
          </div>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <Label className="text-xs text-slate-600">Toplantıya katılanlar</Label>
          <div className="mt-1">
            <MusteriSecici
              value={null}
              onChange={katilimciEkle}
              disabled={ro}
              searchUrl="/api/quality/rma/sorumlu-ara"
              placeholder="Katılımcı eklemek için ara…"
            />
          </div>
          {katilimcilar.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {katilimcilar.map((k) => (
                <Badge key={k.id} variant="outline" className="gap-1 bg-slate-50 text-slate-700 border-slate-200">
                  {k.name}
                  {!ro && (
                    <button type="button" onClick={() => katilimciCikar(k.id)} aria-label="Katılımcıyı çıkar">
                      ×
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-600">Kategori</Label>
            {canManage && (
              <Link href="/kalite/uygunsuzluk/kategoriler" className="text-[11px] text-[#1B4F72] hover:underline">
                Kategorileri yönet
              </Link>
            )}
          </div>
          <Select value={kategoriId ?? 'yok'} onValueChange={(v) => setKategoriId(v === 'yok' ? null : v)} disabled={ro}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yok">Seçilmedi</SelectItem>
              {kategoriler.map((k) => (
                <SelectItem key={k.id} value={k.id}>{k.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <Label className="text-xs text-slate-600">Öğrenilmiş dersler</Label>
          <Textarea
            value={ogrenilmisDersler}
            disabled={ro}
            onChange={(e) => setOgrenilmisDersler(e.target.value)}
            rows={2}
            placeholder="Her satıra bir ders yazın"
            className="mt-1"
          />
        </div>
      </div>

      {/* ── Özet ── */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
          {satirlar.length} satır
        </Badge>
        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
          Toplam red: <span className="tabular-nums ml-1">{toplamRed}</span>
        </Badge>
        {/* Red oranı: iş emri adeti boş/0 ise HİÇBİR ŞEY gösterilmez */}
        {oran !== null && (
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
            Red oranı: {formatOran(oran)}
          </Badge>
        )}
      </div>

      {/* ── Satırlar ── */}
      <div className="space-y-3">
        {satirlar.map((s, i) => (
          <div key={s.key} className="rounded-md border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Satır {i + 1}
              </span>
              {canManage && satirlar.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSatirlar((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Satırı sil"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Yarı mamul kodu</Label>
                <Input value={s.yariMamulKodu} disabled={ro} onChange={(e) => updSatir(i, { yariMamulKodu: e.target.value })} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Malzeme adı</Label>
                <Input value={s.malzemeAdi} disabled={ro} onChange={(e) => updSatir(i, { malzemeAdi: e.target.value })} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Red adeti *</Label>
                <Input type="number" min={1} value={s.redAdeti} disabled={ro} onChange={(e) => updSatir(i, { redAdeti: e.target.value })} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Rework adedi</Label>
                <Input type="number" min={0} value={s.reworkAdedi} disabled={ro} onChange={(e) => updSatir(i, { reworkAdedi: e.target.value })} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Hurda adedi</Label>
                <Input type="number" min={0} value={s.hurdaAdedi} disabled={ro} onChange={(e) => updSatir(i, { hurdaAdedi: e.target.value })} className="mt-1 h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Oluşan bölüm</Label>
                <div className="mt-1">
                  <HataKoduSecici
                    value={s.olusanBolumId}
                    onChange={(id) => updSatir(i, { olusanBolumId: id })}
                    secenekler={bolumSecenekleri}
                    placeholder="Bölüm ara…"
                    disabled={ro}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Hata kodu</Label>
                <div className="mt-1">
                  <HataKoduSecici
                    value={s.hataKoduId}
                    onChange={(id) => updSatir(i, { hataKoduId: id })}
                    secenekler={kodSecenekleri}
                    bolumEtiketi={kodBolumEtiketi}
                    placeholder="Hata kodu ara…"
                    disabled={ro}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Karar</Label>
                <Select
                  value={s.karar || 'yok'}
                  onValueChange={(v) => updSatir(i, { karar: v === 'yok' ? '' : v })}
                  disabled={ro}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yok">Seçilmedi</SelectItem>
                    {UYGUNSUZLUK_KARAR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-600">Hata detayı</Label>
              <Textarea value={s.hataDetayi} disabled={ro} onChange={(e) => updSatir(i, { hataDetayi: e.target.value })} rows={2} className="mt-1" />
            </div>
          </div>
        ))}

        {canManage && (
          <Button variant="outline" onClick={() => setSatirlar((prev) => [...prev, yeniSatir()])}>
            <Plus className="h-4 w-4 mr-1" /> Satır ekle
          </Button>
        )}
      </div>

      {/* ── Döküman ekleri — kayıt oluşmadan (initial yokken) eklenemez, önce kaydet gerekir ── */}
      {initial && (
        <UygunsuzlukDosyaPaneli
          uygunsuzlukId={initial.id}
          initialDosyalar={initial.dosyalar}
          canManage={canManage}
        />
      )}
    </div>
  )
}
