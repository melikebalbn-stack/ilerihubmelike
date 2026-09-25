"use client"

// IV-FR-27 · Deneme Süresi Değerlendirme — form doldurma ekranı.
//
// Desen: anket/[slug] (grup başlığı + RadioGroup + gönder) ile
// forms/overtime/[id] (client component, apiFetch, toast, AlertDialog) birleşimi.
// Kâğıt formun grup yapısı korunur: 4 grup, her grubun kendi toplamı, altta genel
// toplam + not ortalaması. 20 kriter uzun bir liste olduğu için gruplar ayrı kart.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AlertCircle, ArrowLeft, Check, Loader2, Save, Send, ShieldAlert, Undo2, UserCog, X } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"

// Kâğıt formdaki puan etiketleri — birebir.
const PUAN_ETIKET: Record<number, string> = {
  1: "Çok Yetersiz",
  2: "Yetersiz",
  3: "Orta Derece",
  4: "İyi Derece",
  5: "Çok İyi Derece",
}

const GRUP_BASLIK: Record<string, string> = {
  MESLEKI: "Mesleki Yeterlilik",
  DAVRANISSAL: "Davranışsal Yeterlilik",
  BIREYSEL: "Bireysel Yeterlilik",
  CALISAN: "Çalışanlar İçin Kriterler",
}
const GRUP_SIRA = ["MESLEKI", "DAVRANISSAL", "BIREYSEL", "CALISAN"]

const GECME_PUANI = 60

type Kriter = { id: string; sira: number; grup: string; baslik: string; aciklama: string }
type Puan = { kriterId: string; degerlendiriciSira: number; puan: number; not: string | null }
type Kisi = { sicilNo: string | null; adSoyad: string; gorev: string } | null
type Log = {
  eskiDurum: string | null
  yeniDurum: string
  olayTipi: string | null
  aciklama: string | null
  createdAt: string
  aktor: { name: string | null; email: string | null } | null
}
type Aday = { id: string; adSoyad: string; sicilNo: string | null; bolum: string; gorev: string }

type Form = {
  id: string
  tur: "DENEME_2AY" | "ALTI_AY"
  durum: string
  hedefTarih: string
  yakaRengi: string
  puan1: number | null
  puan2: number | null
  ortalama: number | null
  personnel: {
    sicilNo: string | null; adSoyad: string; bolum: string; bolumDetay: string | null
    gorev: string; yakaRengi: string; iseGirisTarihi: string
    denemeDegerlendirme: string | null; altiAyDegerlendirme: string | null
  }
  degerlendirici1: Kisi
  degerlendirici2: Kisi
  onaylayan: Kisi
  puanlar: Puan[]
  loglar: Log[]
}

type Yanit = { form: Form; kriterler: Kriter[]; yetki: { roller: string[]; adimSahibi: boolean } }

const tarih = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("tr-TR") : "—"

export default function DenemeFormPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [veri, setVeri] = useState<Yanit | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<{ kod: number; mesaj: string } | null>(null)
  const [puanlar, setPuanlar] = useState<Record<string, number>>({})
  const [notlar, setNotlar] = useState<Record<string, string>>({})
  const [kaydediyor, setKaydediyor] = useState(false)
  const [onayNotu, setOnayNotu] = useState("")
  const [fesihGerekce, setFesihGerekce] = useState("")
  const [iptalGerekce, setIptalGerekce] = useState("")
  // ── Yönlendirme (İV) ──
  const [yonSira, setYonSira] = useState<1 | 2>(1)
  const [yonAra, setYonAra] = useState("")
  const [yonHedef, setYonHedef] = useState<Aday | null>(null)
  const [yonGerekce, setYonGerekce] = useState("")
  const [adaylar, setAdaylar] = useState<Aday[]>([])
  const [adaylarYuklendi, setAdaylarYuklendi] = useState(false)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    try {
      const res = await apiFetch(`/api/deneme/${id}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setHata({ kod: res.status, mesaj: j?.error ?? "Form yüklenemedi" })
        return
      }
      const j: Yanit = await res.json()
      setVeri(j)
      // Bu değerlendiricinin daha önce girdiği puanlar (taslak) forma yüklenir.
      const sira = j.form.durum === "DEGERLENDIRICI1_BEKLIYOR" ? 1 : 2
      const p: Record<string, number> = {}
      const n: Record<string, string> = {}
      for (const x of j.form.puanlar) {
        if (x.degerlendiriciSira === sira) {
          p[x.kriterId] = x.puan
          if (x.not) n[x.kriterId] = x.not
        }
      }
      setPuanlar(p)
      setNotlar(n)
      setHata(null)
    } catch {
      setHata({ kod: 0, mesaj: "Form yüklenemedi" })
    } finally {
      setYukleniyor(false)
    }
  }, [id])

  useEffect(() => { void yukle() }, [yukle])

  // useMemo bağımlılıkları her render değişmesin diye sabit referans.
  const kriterler = useMemo(() => veri?.kriterler ?? [], [veri])
  const form = veri?.form
  const dolduranSira = form?.durum === "DEGERLENDIRICI1_BEKLIYOR" ? 1 : 2
  const doldurabilir = !!veri?.yetki.adimSahibi &&
    ["DEGERLENDIRICI1_BEKLIYOR", "MUDUR_YRD_BEKLIYOR", "MUDUR_BEKLIYOR"].includes(form?.durum ?? "")

  // Birinci değerlendiricinin puanları — ikinci kolon doldurulurken SALT OKUNUR.
  const birinciPuanlar = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of form?.puanlar ?? []) if (p.degerlendiriciSira === 1) m[p.kriterId] = p.puan
    return m
  }, [form])
  const ikiKolon = dolduranSira === 2 && Object.keys(birinciPuanlar).length > 0

  // ── ONAY ve İK aşamaları: puan GİRİLMEZ, iki değerlendiricinin puanları salt okunur ──
  // useMemo: her render yeni dizi üretirse aşağıdaki useMemo bağımlılığı
  // sürekli değişir (react-hooks/exhaustive-deps).
  const roller = useMemo(() => veri?.yetki.roller ?? [], [veri])
  const onayAsamasi = form?.durum === "ONAY_BEKLIYOR" && roller.includes("ONAYLAYAN")
  const ikAsamasi = form?.durum === "IK_BEKLIYOR" && roller.includes("IK")
  const ikinciPuanlar = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of form?.puanlar ?? []) if (p.degerlendiriciSira === 2) m[p.kriterId] = p.puan
    return m
  }, [form])
  // Salt okunur aşamalarda kriter satırında hangi kolonlar gösterilecek.
  const saltOkunurKolonlar = onayAsamasi || ikAsamasi
  // İV her aşamada iptal edebilir (geçiş matrisi izinli). İK aşamasında iptal
  // zaten kapanış bloğunda olduğu için burada ayrı kart çizilmez.
  // Yönlendirme: yalnız İV, form kapalı değilse. Hangi adımların yönlendirilebildiği
  // sunucuda ayrıca doğrulanır (puanlanmış adım reddedilir) — buradaki liste
  // yalnız ekranı sadeleştirir, kapı DEĞİLDİR.
  const yonlendirilebilirSiralar = useMemo<(1 | 2)[]>(() => {
    if (!form || !roller.includes("IK")) return []
    if (["TAMAMLANDI", "IPTAL"].includes(form.durum)) return []
    const liste: (1 | 2)[] = []
    const p1 = form.puanlar.some((p) => p.degerlendiriciSira === 1)
    const p2 = form.puanlar.some((p) => p.degerlendiriciSira === 2)
    if (!p1) liste.push(1)
    if (form.degerlendirici2 && !p2) liste.push(2)
    return liste
  }, [form, roller])
  const yonlendirebilir = yonlendirilebilirSiralar.length > 0

  const ivIptalEdebilir =
    roller.includes("IK") &&
    !!form &&
    !["TAMAMLANDI", "IPTAL", "IK_BEKLIYOR"].includes(form.durum)

  // CANLI hesap: grup toplamları + genel toplam + ortalama.
  const grupToplam = useMemo(() => {
    const t: Record<string, number> = {}
    for (const k of kriterler) t[k.grup] = (t[k.grup] ?? 0) + (puanlar[k.id] ?? 0)
    return t
  }, [kriterler, puanlar])

  const genelToplam = useMemo(
    () => kriterler.reduce((a, k) => a + (puanlar[k.id] ?? 0), 0),
    [kriterler, puanlar],
  )
  const dolu = kriterler.filter((k) => puanlar[k.id]).length
  const tamami = kriterler.length > 0 && dolu === kriterler.length
  const notOrtalamasi = dolu > 0 ? genelToplam / dolu : 0
  const dusuk = tamami && genelToplam < GECME_PUANI
  // Kayıtlı ortalamaya göre — onay/İK aşamasında karar bunun üzerinden verilir.
  const kayitliDusuk = (form?.ortalama ?? 0) < GECME_PUANI

  const govde = () =>
    Object.entries(puanlar).map(([kriterId, puan]) => ({
      kriterId, puan, ...(notlar[kriterId]?.trim() ? { not: notlar[kriterId].trim() } : {}),
    }))

  async function kaydet(gonder: boolean) {
    if (gonder && !tamami) {
      toast.error(`Gönderim için 20 kriterin tamamı doldurulmalı (${dolu}/${kriterler.length} dolu)`)
      return
    }
    setKaydediyor(true)
    try {
      const res = await apiFetch(`/api/deneme/${id}/puanla`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puanlar: govde(), gonder }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j?.error ?? "Kaydedilemedi"); return }
      toast.success(gonder ? "Form gönderildi" : `Taslak kaydedildi (${dolu}/${kriterler.length})`)
      // Liste ekranı henüz yok (Faz 4b) — formu tazele; gönderildiyse salt okunura düşer.
      await yukle()
    } catch {
      toast.error("Kaydedilemedi")
    } finally {
      setKaydediyor(false)
    }
  }

  async function aktar() {
    setKaydediyor(true)
    try {
      const res = await apiFetch(`/api/deneme/${id}/aktar`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j?.error ?? "Aktarılamadı"); return }
      toast.success("Form bölüm müdürüne aktarıldı")
      await yukle()
    } catch {
      toast.error("Aktarılamadı")
    } finally {
      setKaydediyor(false)
    }
  }

  // Aday listesi TALEP ÜZERİNE çekilir (kart açılınca) — her form açılışında
  // tüm aktif personeli indirmenin anlamı yok.
  async function adaylariYukle() {
    if (adaylarYuklendi) return
    try {
      const res = await apiFetch(`/api/deneme/${id}/yonlendir`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? "Aday listesi alınamadı")
      setAdaylar(j.adaylar ?? [])
      setAdaylarYuklendi(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aday listesi alınamadı")
    }
  }

  async function yonlendir() {
    if (!yonHedef || yonGerekce.trim().length < 10) return
    setKaydediyor(true)
    try {
      const res = await apiFetch(`/api/deneme/${id}/yonlendir`, {
        method: "POST",
        body: JSON.stringify({ sira: yonSira, hedefPersonnelId: yonHedef.id, gerekce: yonGerekce.trim() }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? "Yönlendirilemedi")
      toast.success(`${yonSira}. değerlendirici ${yonHedef.adSoyad} olarak güncellendi`)
      // Bildirim yönlendirmeyi BLOKE ETMEZ; ulaşmadıysa kullanıcı bilsin.
      if (!j.bildirim?.gonderildi) {
        toast.warning(j.bildirim?.sebep ?? "Bildirim gönderilemedi — kişiyi ayrıca haberdar edin")
      }
      setYonHedef(null); setYonAra(""); setYonGerekce("")
      await yukle()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yönlendirilemedi")
    } finally {
      setKaydediyor(false)
    }
  }

  async function onayla(karar: "ONAYLA" | "GERI_GONDER") {
    if (karar === "GERI_GONDER" && !onayNotu.trim()) {
      toast.error("Geri gönderme için gerekçe zorunludur")
      return
    }
    setKaydediyor(true)
    try {
      const res = await apiFetch(`/api/deneme/${id}/onayla`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ karar, not: onayNotu.trim() || undefined }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j?.error ?? "İşlem başarısız"); return }
      toast.success(karar === "ONAYLA" ? "Form onaylandı" : "Form geri gönderildi")
      setOnayNotu("")
      await yukle()
    } catch {
      toast.error("İşlem başarısız")
    } finally {
      setKaydediyor(false)
    }
  }

  async function kapat(karar: "KAPAT" | "IPTAL" = "KAPAT") {
    setKaydediyor(true)
    try {
      const res = await apiFetch(`/api/deneme/${id}/kapat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          karar,
          // İptal kendi gerekçe alanını kullanır (İK bloğu dışında da çıkabiliyor).
          fesihGerekce: (karar === "IPTAL" ? iptalGerekce : fesihGerekce).trim() || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j?.error ?? "İşlem başarısız"); return }
      toast.success(
        karar === "IPTAL"
          ? "Değerlendirme iptal edildi"
          : `Değerlendirme kapatıldı — ${j.basarili ? "BAŞARILI" : "BAŞARISIZ"}`,
      )
      await yukle()
    } catch {
      toast.error("Kapatılamadı")
    } finally {
      setKaydediyor(false)
    }
  }

  if (yukleniyor) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Form yükleniyor…
    </div>
  }

  if (hata) {
    const yetkiHatasi = hata.kod === 403
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="mb-2 text-lg font-semibold">
          {yetkiHatasi ? "Bu forma erişim yetkiniz yok" : hata.mesaj}
        </h1>
        {yetkiHatasi && (
          <p className="mb-6 text-sm text-muted-foreground">
            Deneme değerlendirme formunu yalnız o formun değerlendiricileri, onaylayanı ve
            İnsan Varlıkları görebilir.
          </p>
        )}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Geri dön
        </Button>
      </div>
    )
  }

  if (!form) return null

  const p = form.personnel
  // Bitiş tarihi FORMUN TÜRÜNE göre: 2 ay formunda 2 aylık, 6 ay formunda 6 aylık
  // tarih. Etiket de türle birlikte yazılır ki hangi süre olduğu tek bakışta anlaşılsın.
  const ikiAyMi = form.tur === "DENEME_2AY"
  const bitisTarihi = ikiAyMi ? p.denemeDegerlendirme : p.altiAyDegerlendirme
  const bitisEtiketi = ikiAyMi ? "Deneme Süresi Bitiş (2 Ay)" : "Değerlendirme Süresi Bitiş (6 Ay)"

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      {/* ── ÜST BİLGİ (kâğıt formun künye bloğu) ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* Liste ekranı Faz 4b'de gelecek — şimdilik tarayıcı geçmişine dön. */}
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:underline"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Geri
          </button>
          <h1 className="text-xl font-semibold">Deneme Süresi Değerlendirme Formu</h1>
          <p className="text-xs text-muted-foreground">IV-FR-27 · Rev.2 · GİZLİ</p>
        </div>
        <Badge variant={form.tur === "DENEME_2AY" ? "secondary" : "default"} className="text-sm">
          {form.tur === "DENEME_2AY" ? "2 AY" : "6 AY"}
        </Badge>
      </div>

      <Card>
        <CardContent className="grid gap-x-8 gap-y-3 p-6 sm:grid-cols-2">
          {[
            ["Adı Soyadı", p.adSoyad],
            ["Sicil No", p.sicilNo ?? "—"],
            ["Ünvanı / Pozisyonu", p.gorev],
            ["Bölümü", p.bolum],
            ["Görev Yeri", p.bolumDetay || p.bolum],
            ["İşe Başlama Tarihi", tarih(p.iseGirisTarihi)],
            ["Değerlendirme Tarihi", tarih(form.hedefTarih)],
            [bitisEtiketi, tarih(bitisTarihi)],
          ].map(([etiket, deger]) => (
            <div key={etiket as string} className="flex justify-between gap-4 border-b border-dashed pb-1 text-sm">
              <span className="text-muted-foreground">{etiket}</span>
              <span className="text-right font-medium">{deger}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {!doldurabilir && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Salt okunur</AlertTitle>
          <AlertDescription>
            Bu formu görüntüleyebilirsiniz ancak şu anki aşamada puan giremezsiniz.
            {form.durum === "ONAY_BEKLIYOR" && " Form onay aşamasında."}
            {form.durum === "IK_BEKLIYOR" && " Form İnsan Varlıkları'nda."}
            {form.durum === "TAMAMLANDI" && " Değerlendirme tamamlandı."}
          </AlertDescription>
        </Alert>
      )}

      {ikiKolon && (
        <Alert>
          <UserCog className="h-4 w-4" />
          <AlertTitle>İki değerlendirici</AlertTitle>
          <AlertDescription>
            {form.degerlendirici1?.adSoyad} puanlarını verdi (solda, salt okunur). Siz ikinci
            değerlendirici olarak kendi puanlarınızı giriyorsunuz; sonuç iki puanın ortalamasıdır.
          </AlertDescription>
        </Alert>
      )}

      {/* ── 20 KRİTER, 4 GRUP ── */}
      {GRUP_SIRA.map((grup) => {
        const grupKriterleri = kriterler.filter((k) => k.grup === grup).sort((a, b) => a.sira - b.sira)
        if (!grupKriterleri.length) return null
        const enYuksek = grupKriterleri.length * 5
        return (
          <Card key={grup}>
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/40 py-3">
              <CardTitle className="text-base">{GRUP_BASLIK[grup] ?? grup}</CardTitle>
              <div className="text-sm">
                <span className="text-muted-foreground">Bölüm toplamı: </span>
                <span className="font-semibold tabular-nums">{grupToplam[grup] ?? 0}</span>
                <span className="text-muted-foreground"> / {enYuksek}</span>
              </div>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {grupKriterleri.map((k) => (
                <div key={k.id} className="space-y-3 p-4">
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                      {k.sira}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{k.baslik}</p>
                      <p className="text-xs text-muted-foreground">{k.aciklama}</p>
                    </div>
                    {ikiKolon && !saltOkunurKolonlar && (
                      <div className="ml-auto shrink-0 rounded-md border bg-muted/50 px-3 py-1 text-center">
                        <div className="text-[10px] uppercase text-muted-foreground">1. değerlendirici</div>
                        <div className="text-sm font-semibold tabular-nums">{birinciPuanlar[k.id] ?? "—"}</div>
                      </div>
                    )}
                    {saltOkunurKolonlar && (
                      // Onay/İK aşaması: PUAN GİRİLMEZ. Verilmiş puanlar kolon kolon okunur.
                      <div className="ml-auto flex shrink-0 gap-2">
                        <div className="rounded-md border bg-muted/50 px-3 py-1 text-center">
                          <div className="text-[10px] uppercase text-muted-foreground">1. değ.</div>
                          <div className="text-sm font-semibold tabular-nums">{birinciPuanlar[k.id] ?? "—"}</div>
                        </div>
                        {form.degerlendirici2 && (
                          <div className="rounded-md border bg-muted/50 px-3 py-1 text-center">
                            <div className="text-[10px] uppercase text-muted-foreground">2. değ.</div>
                            <div className="text-sm font-semibold tabular-nums">{ikinciPuanlar[k.id] ?? "—"}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!saltOkunurKolonlar && (
                  <RadioGroup
                    value={puanlar[k.id]?.toString() ?? ""}
                    onValueChange={(v) => setPuanlar((s) => ({ ...s, [k.id]: Number(v) }))}
                    disabled={!doldurabilir}
                    className="flex flex-wrap gap-x-5 gap-y-2 pl-9"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <RadioGroupItem value={String(n)} id={`${k.id}-${n}`} />
                        <Label htmlFor={`${k.id}-${n}`} className="cursor-pointer text-xs font-normal">
                          <span className="font-semibold tabular-nums">{n}</span> {PUAN_ETIKET[n]}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  )}

                  {doldurabilir && (
                    <Textarea
                      placeholder="Not (isteğe bağlı)"
                      value={notlar[k.id] ?? ""}
                      onChange={(e) => setNotlar((s) => ({ ...s, [k.id]: e.target.value }))}
                      className="ml-9 min-h-0 text-sm"
                      rows={1}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      {/* ── TOPLAM ── Salt okunur aşamalarda KAYITLI puanlar, doldururken canlı hesap. */}
      <Card className={(saltOkunurKolonlar ? kayitliDusuk : dusuk) ? "border-destructive" : undefined}>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          {saltOkunurKolonlar ? (
            <>
              <div>
                <div className="text-sm text-muted-foreground">1. Değerlendirici</div>
                <div className={`text-2xl font-bold tabular-nums ${(form.puan1 ?? 0) < GECME_PUANI ? "text-destructive" : ""}`}>
                  {form.puan1 ?? "—"}
                </div>
              </div>
              {form.degerlendirici2 && (
                <div>
                  <div className="text-sm text-muted-foreground">2. Değerlendirici</div>
                  <div className={`text-2xl font-bold tabular-nums ${(form.puan2 ?? 0) < GECME_PUANI ? "text-destructive" : ""}`}>
                    {form.puan2 ?? "—"}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm text-muted-foreground">Not Ortalaması</div>
                <div className={`text-3xl font-bold tabular-nums ${kayitliDusuk ? "text-destructive" : ""}`}>
                  {form.ortalama?.toFixed(2) ?? "—"}
                  <span className="ml-1 text-base font-normal text-muted-foreground">/ 100</span>
                </div>
              </div>
              <Badge variant={kayitliDusuk ? "destructive" : "default"} className="text-sm">
                {kayitliDusuk ? "BAŞARISIZ" : "BAŞARILI"}
              </Badge>
            </>
          ) : (
            <>
              <div>
                <div className="text-sm text-muted-foreground">Genel Toplam</div>
                <div className={`text-3xl font-bold tabular-nums ${dusuk ? "text-destructive" : ""}`}>
                  {genelToplam}
                  <span className="ml-1 text-base font-normal text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Not Ortalaması</div>
                <div className={`text-3xl font-bold tabular-nums ${dusuk ? "text-destructive" : ""}`}>
                  {notOrtalamasi.toFixed(2)}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {dolu} / {kriterler.length} kriter dolduruldu
              </div>
            </>
          )}
        </CardContent>
        {(saltOkunurKolonlar ? kayitliDusuk : dusuk) && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Geçme notunun altında</AlertTitle>
              <AlertDescription>
                Toplam puan {GECME_PUANI} geçme notunun altında. Bu sonuç gerekçeli tutanak gerektirir.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* ── ONAY BLOKU (ONAY_BEKLIYOR · onaylayan PUAN VERMEZ) ── */}
      {onayAsamasi && (
        <Card>
          <CardHeader className="border-b bg-muted/40 py-3">
            <CardTitle className="text-base">Onay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">
              Değerlendirme puanları yukarıda. Onaylarsanız form İnsan Varlıkları'na geçer;
              geri gönderirseniz bir önceki adıma döner. <strong>Bu aşamada puan verilmez.</strong>
            </p>
            <Textarea
              placeholder="Onay notu (geri göndermede zorunlu)"
              value={onayNotu}
              onChange={(e) => setOnayNotu(e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap justify-end gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={kaydediyor || !onayNotu.trim()}>
                    <Undo2 className="mr-2 h-4 w-4" /> Geri Gönder
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Form geri gönderilsin mi?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Form bir önceki adıma dönecek ve yeniden doldurulması istenecek.
                      Gerekçeniz kayda geçer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onayla("GERI_GONDER")}>Geri Gönder</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={kaydediyor}>
                    <Check className="mr-2 h-4 w-4" /> Onayla
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Form onaylansın mı?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Onaydan sonra form İnsan Varlıkları aşamasına geçer.
                      Not ortalaması {form.ortalama?.toFixed(2) ?? "—"}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onayla("ONAYLA")}>Onayla</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── İK KAPATMA BLOKU (IK_BEKLIYOR · yalnız İV) ── */}
      {ikAsamasi && (
        <Card className={kayitliDusuk ? "border-destructive" : undefined}>
          <CardHeader className="border-b bg-muted/40 py-3">
            <CardTitle className="text-base">İnsan Varlıkları — Kapanış</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Sonuç:</span>
              <Badge variant={kayitliDusuk ? "destructive" : "default"}>
                {kayitliDusuk ? "BAŞARISIZ" : "BAŞARILI"}
              </Badge>
              <span className="text-muted-foreground">
                (not ortalaması {form.ortalama?.toFixed(2) ?? "—"} · geçme notu {GECME_PUANI})
              </span>
            </div>

            {kayitliDusuk && (
              <>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Gerekçe zorunlu</AlertTitle>
                  <AlertDescription>
                    Gerekçeli tutanak ve belge sunulması gerekmektedir.
                  </AlertDescription>
                </Alert>
                <Textarea
                  placeholder="Fesih gerekçesi (zorunlu)"
                  value={fesihGerekce}
                  onChange={(e) => setFesihGerekce(e.target.value)}
                  rows={4}
                />
              </>
            )}

            <Textarea
              placeholder="İptal gerekçesi (iptal edilecekse zorunlu)"
              value={iptalGerekce}
              onChange={(e) => setIptalGerekce(e.target.value)}
              rows={2}
            />

            <div className="flex flex-wrap justify-end gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={kaydediyor || !iptalGerekce.trim()}>
                    <X className="mr-2 h-4 w-4" /> İptal Et
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Değerlendirme iptal edilsin mi?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Form iptal edilecek ve bir daha işlem yapılamayacak. Gerekçeniz kayda geçer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction onClick={() => kapat("IPTAL")}>İptal Et</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={kaydediyor || (kayitliDusuk && !fesihGerekce.trim())}>
                    <Check className="mr-2 h-4 w-4" /> Kapat
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Değerlendirme kapatılsın mı?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sonuç {kayitliDusuk ? "BAŞARISIZ" : "BAŞARILI"} olarak kaydedilecek ve
                      form tamamlanacak. Bu işlem geri alınamaz.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction onClick={() => kapat("KAPAT")}>Kapat</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── İV YÖNLENDİRME ── Değerlendiriciyi İnsan Varlıkları değiştirir.
          Zincir üyelerine AÇIK DEĞİL: kendi değerlendirmesini devretmek formun
          tarafsızlık varsayımını bozar. Kapılar sunucuda tekrar uygulanır. */}
      {yonlendirebilir && (
        <Card>
          <CardHeader className="border-b bg-muted/40 py-3">
            <CardTitle className="text-base">İnsan Varlıkları — Yönlendir</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">
              Değerlendirici formu dolduramıyorsa (izin, görev değişikliği, gecikme) adım
              başka bir kişiye yönlendirilebilir. Puan girilmiş adım yönlendirilemez.
              Yeni değerlendiriciye e-posta ve uygulama içi bildirim gönderilir.
            </p>

            {yonlendirilebilirSiralar.length > 1 && (
              <div className="space-y-2">
                <Label>Hangi adım?</Label>
                <div className="flex gap-2">
                  {yonlendirilebilirSiralar.map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={yonSira === n ? "default" : "outline"}
                      size="sm"
                      onClick={() => setYonSira(n)}
                    >
                      {n}. Değerlendirici
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="yon-hedef">Yeni değerlendirici (zorunlu)</Label>
              {yonHedef ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{yonHedef.adSoyad}</span>
                    <span className="text-muted-foreground">
                      {yonHedef.sicilNo ? ` · ${yonHedef.sicilNo}` : ""} · {yonHedef.bolum}
                    </span>
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setYonHedef(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    id="yon-hedef"
                    placeholder="Ad veya sicil ile ara…"
                    value={yonAra}
                    onFocus={() => void adaylariYukle()}
                    onChange={(e) => setYonAra(e.target.value)}
                  />
                  {yonAra.trim().length >= 2 && (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
                      {adaylar
                        .filter((a) => {
                          const q = yonAra.trim().toLocaleLowerCase("tr")
                          return (
                            a.adSoyad.toLocaleLowerCase("tr").includes(q) ||
                            (a.sicilNo ?? "").toLocaleLowerCase("tr").includes(q)
                          )
                        })
                        .slice(0, 12)
                        .map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                            onClick={() => { setYonHedef(a); setYonAra("") }}
                          >
                            <span className="font-medium">{a.adSoyad}</span>
                            <span className="text-muted-foreground">
                              {a.sicilNo ? ` · ${a.sicilNo}` : ""} · {a.bolum}
                            </span>
                          </button>
                        ))}
                      {adaylarYuklendi &&
                        adaylar.filter((a) =>
                          a.adSoyad.toLocaleLowerCase("tr").includes(yonAra.trim().toLocaleLowerCase("tr")),
                        ).length === 0 && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            Eşleşen aktif kullanıcı yok. (Kullanıcı hesabı olmayan personel listelenmez.)
                          </p>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="yon-gerekce">Gerekçe (zorunlu, en az 10 karakter)</Label>
              <Textarea
                id="yon-gerekce"
                placeholder="Örn. Değerlendirici uzun süreli izinde, form 2 gün gecikti."
                value={yonGerekce}
                onChange={(e) => setYonGerekce(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={kaydediyor || !yonHedef || yonGerekce.trim().length < 10}
                  >
                    <UserCog className="mr-2 h-4 w-4" /> Yönlendir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Form yönlendirilsin mi?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {yonSira}. değerlendirici <strong>{yonHedef?.adSoyad}</strong> olarak
                      değiştirilecek ve kendisine bildirim gönderilecek. İşlem form geçmişine
                      gerekçesiyle yazılır.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction onClick={yonlendir}>Yönlendir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── İV İPTAL (her aşamada) ── İK bloğu zaten kendi iptalini taşıyor,
          burası onun DIŞINDAKİ aşamalar için: form yanlış açıldıysa İV kapatabilsin. */}
      {ivIptalEdebilir && (
        <Card>
          <CardHeader className="border-b bg-muted/40 py-3">
            <CardTitle className="text-base">İnsan Varlıkları — İptal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">
              Form yanlış açıldıysa ya da değerlendirme yapılmayacaksa iptal edilebilir.
              İptal edilen form yeniden açılamaz.
            </p>
            <Textarea
              placeholder="İptal gerekçesi (zorunlu)"
              value={iptalGerekce}
              onChange={(e) => setIptalGerekce(e.target.value)}
              rows={2}
            />
            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={kaydediyor || !iptalGerekce.trim()}>
                    <X className="mr-2 h-4 w-4" /> İptal Et
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Form iptal edilsin mi?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Form iptal edilecek, geri alınamaz. Gerekçe zorunlu.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction onClick={() => kapat("IPTAL")}>İptal Et</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── FORM GEÇMİŞİ ── Durum geçişleri + durum DEĞİŞTİRMEYEN müdahaleler
          (yönlendirme). olayTipi NULL ise klasik geçiş satırıdır. */}
      {(form.loglar?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="border-b bg-muted/40 py-3">
            <CardTitle className="text-base">Form Geçmişi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {form.loglar.map((l, i) => (
                <li key={i} className="flex flex-col gap-1 px-6 py-3 text-sm sm:flex-row sm:items-start sm:gap-4">
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString("tr-TR", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  <span className="flex-1">
                    {l.olayTipi === "YONLENDIRME" && (
                      <Badge variant="outline" className="mr-2 align-middle">Yönlendirme</Badge>
                    )}
                    {l.aciklama ?? `${l.eskiDurum ?? "—"} → ${l.yeniDurum}`}
                    {l.aktor && (
                      <span className="text-muted-foreground"> · {l.aktor.name || l.aktor.email}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── EYLEMLER ── */}
      {doldurabilir && (
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t bg-background/95 py-4 backdrop-blur">
          {form.durum === "MUDUR_YRD_BEKLIYOR" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={kaydediyor}>
                  <UserCog className="mr-2 h-4 w-4" /> Müdüre Aktar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Form müdüre aktarılsın mı?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Form bölüm müdürüne aktarılacak, siz puan vermeyeceksiniz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                  <AlertDialogAction onClick={aktar}>Aktar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button variant="outline" onClick={() => kaydet(false)} disabled={kaydediyor || dolu === 0}>
            {kaydediyor ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Taslak Kaydet
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={kaydediyor || !tamami}>
                <Send className="mr-2 h-4 w-4" /> Gönder
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Form gönderilsin mi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Gönderdikten sonra değiştiremezsiniz. Genel toplam {genelToplam} / 100,
                  not ortalaması {notOrtalamasi.toFixed(2)}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction onClick={() => kaydet(true)}>Gönder</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
