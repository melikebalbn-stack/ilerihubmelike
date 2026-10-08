"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FileWarning, X } from "lucide-react"
import { toast } from "sonner"
import { SplitBadge } from "@/components/akademi/SplitBadge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AramaliSecim } from "@/components/envanter/AramaliSecim"
import { SEBEP_ETIKETLERI } from "@/lib/tutanak/tutanak-durum"

type Personel = { id: string; sicilNo: string | null; adSoyad: string; bolum: string | null; gorev?: string | null }
type Basamak = {
  kademe: number
  personnelId: string
  adSoyad: string
  sicilNo: string | null
  bolum: string | null
  gorev: string | null
  sonYonetici: boolean
}

function bugun(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function YeniTutanakPage() {
  const router = useRouter()
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [sahitAdaylari, setSahitAdaylari] = useState<Personel[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [kaydediyor, setKaydediyor] = useState(false)

  const [personnelId, setPersonnelId] = useState("")
  const [tutanakTarihi, setTutanakTarihi] = useState(bugun())
  const [sebep, setSebep] = useState("")
  const [aciklama, setAciklama] = useState("")
  const [sahitIdler, setSahitIdler] = useState<string[]>([])
  const [yoneticiId, setYoneticiId] = useState("")
  const [basamaklar, setBasamaklar] = useState<Basamak[]>([])
  const [sonYonetici, setSonYonetici] = useState<Basamak | null>(null)
  const [yoneticiUyari, setYoneticiUyari] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/tutanak/form-verisi")
        if (!res.ok) {
          const h = await res.json().catch(() => null)
          toast.error(h?.error || "Form verisi yüklenemedi")
          return
        }
        const d = await res.json()
        setPersoneller(d.personeller ?? [])
        setSahitAdaylari(d.sahitAdaylari ?? [])
      } catch {
        toast.error("Form verisi yüklenemedi — bağlantı hatası")
      } finally {
        setYukleniyor(false)
      }
    })()
  }, [])

  // Personel değişince yönetici zinciri yenilenir; eski seçim DAİMA temizlenir
  // (başka personelin yöneticisi kaydedilmesin).
  useEffect(() => {
    setYoneticiId("")
    setBasamaklar([])
    setSonYonetici(null)
    setYoneticiUyari(null)
    if (!personnelId) return
    ;(async () => {
      try {
        const res = await fetch(`/api/tutanak/yoneticiler?personelId=${encodeURIComponent(personnelId)}`)
        if (!res.ok) {
          setYoneticiUyari("Yönetici listesi alınamadı.")
          return
        }
        const d = await res.json()
        setBasamaklar(d.secenekler ?? [])
        setSonYonetici(d.sonYonetici ?? null)
        setYoneticiUyari(d.uyari ?? null)
      } catch {
        setYoneticiUyari("Yönetici listesi alınamadı.")
      }
    })()
  }, [personnelId])

  const secilenPersonel = personeller.find((p) => p.id === personnelId) ?? null
  // Hakkında tutanak tutulan kişi kendi tutanağına şahit olamaz.
  const sahitSecenekleri = sahitAdaylari.filter((p) => p.id !== personnelId && !sahitIdler.includes(p.id))
  // Seçilen yönetici zincirin en üstüyse ayrı bilgilendirme GİTMEZ (aynı kişi).
  const bilgilendirilecek = sonYonetici && sonYonetici.personnelId !== yoneticiId ? sonYonetici : null

  const gecerli =
    !!personnelId && !!tutanakTarihi && !!sebep && aciklama.trim().length > 0 && sahitIdler.length > 0 && !!yoneticiId

  async function kaydet(gonder: boolean) {
    if (!gecerli) {
      toast.error("Zorunlu alanlar eksik: personel, sebep, açıklama, en az 1 şahit ve yönetici")
      return
    }
    setKaydediyor(true)
    try {
      const res = await fetch("/api/tutanak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personnelId, tutanakTarihi, sebep, aciklama, sahitIdler, yoneticiId, gonder }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(d?.error || "Tutanak kaydedilemedi")
        return
      }
      if (d?.uyari) toast.warning(d.uyari, { duration: 9000 })
      else toast.success(gonder ? `${d.tutanakNo} oluşturuldu ve şahit onayına gönderildi` : `${d.tutanakNo} taslak kaydedildi`)
      router.push(`/tutanak/${d.id}`)
    } catch {
      toast.error("Tutanak kaydedilemedi — bağlantı hatası")
    } finally {
      setKaydediyor(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <FileWarning className="h-5 w-5" /> Yeni Tutanak
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            IV-FR-03 · Bölüm ve görev kayıt anında saklanır · Hakkında tutanak tutulan personel bu
            tutanağı göremez.
          </p>
        </div>
        <SplitBadge color="gray" left="Liste" right="Tutanaklar" href="/tutanak" />
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-600">Tutanak Bilgisi</p>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-600">Personel *</Label>
              <AramaliSecim
                secenekler={personeller.map((p) => ({
                  id: p.id,
                  etiket: `${p.adSoyad}${p.sicilNo ? ` (${p.sicilNo})` : ""}`,
                  aramaEk: [p.bolum, p.gorev],
                }))}
                deger={personnelId}
                onChange={setPersonnelId}
                placeholder={yukleniyor ? "Yükleniyor..." : "Personel seçin"}
                aramaPlaceholder="Ad, sicil, bölüm ara..."
              />
              {secilenPersonel && (
                <p className="text-xs text-slate-500 mt-1">
                  {secilenPersonel.bolum ?? "—"} · {secilenPersonel.gorev ?? "—"}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-slate-600">Tutanak Tarihi *</Label>
              <Input type="date" value={tutanakTarihi} onChange={(e) => setTutanakTarihi(e.target.value)} className="mt-1 h-9" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-600">Tutanak Sebebi *</Label>
            <Select value={sebep} onValueChange={setSebep}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Sebep seçin" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SEBEP_ETIKETLERI).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-slate-600">Açıklama *</Label>
            <Textarea
              rows={6}
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Olayın ne zaman, nerede ve nasıl gerçekleştiğini yazın."
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-600">Şahitler</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            En az bir şahit zorunlu. Onaylar paralel ilerler; biri reddederse tutanak reddedilir.
          </p>
        </div>
        <div className="space-y-3">
          <AramaliSecim
            secenekler={sahitSecenekleri.map((p) => ({
              id: p.id,
              etiket: `${p.adSoyad}${p.sicilNo ? ` (${p.sicilNo})` : ""}`,
              aramaEk: [p.bolum],
            }))}
            deger=""
            onChange={(id) => id && setSahitIdler((m) => [...m, id])}
            placeholder="Şahit ekle"
            aramaPlaceholder="Ad, sicil, bölüm ara..."
          />
          {sahitIdler.length === 0 ? (
            <p className="text-xs text-amber-600">Henüz şahit eklenmedi.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sahitIdler.map((id) => {
                const p = sahitAdaylari.find((x) => x.id === id)
                return (
                  <Badge key={id} variant="outline" className="gap-1.5 py-1">
                    {p?.adSoyad ?? id}
                    <span className="text-slate-500">{p?.bolum ?? ""}</span>
                    <button
                      type="button"
                      aria-label="Şahidi çıkar"
                      onClick={() => setSahitIdler((m) => m.filter((x) => x !== id))}
                      className="ml-0.5 hover:text-rose-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-600">Onaylayacak Yönetici</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Personelin organizasyon şemasındaki 1. veya 2. yöneticisi arasından seçilir.
          </p>
        </div>
        <div className="space-y-3">
          {!personnelId ? (
            <p className="text-sm text-slate-500">Önce personel seçin.</p>
          ) : yoneticiUyari ? (
            <p className="text-sm text-amber-600">{yoneticiUyari}</p>
          ) : basamaklar.length === 0 ? (
            <p className="text-sm text-slate-400">Yükleniyor…</p>
          ) : (
            <RadioGroup value={yoneticiId} onValueChange={setYoneticiId} className="space-y-2">
              {basamaklar.map((b) => (
                <label
                  key={b.personnelId}
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-slate-50"
                >
                  <RadioGroupItem value={b.personnelId} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{b.adSoyad}</span>
                    <span className="text-slate-500"> · {b.kademe}. yönetici</span>
                    <span className="block text-xs text-slate-500">
                      {b.bolum ?? "—"} · {b.gorev ?? "—"}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}

          {bilgilendirilecek && (
            <p className="text-xs text-slate-500 border-l-2 border-primary/40 pl-2">
              Bilgilendirilecek son yönetici: <strong>{bilgilendirilecek.adSoyad}</strong> — yalnız mail ve Hub
              bildirimi alır, onay adımında yer almaz.
            </p>
          )}
          {yoneticiId && !bilgilendirilecek && basamaklar.length > 0 && (
            <p className="text-xs text-slate-500 border-l-2 border-muted pl-2">
              Seçilen yönetici zincirin en üstü — ayrı bir son yönetici bilgilendirmesi gönderilmez.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <SplitBadge
          color="gray"
          left="Tutanak"
          right={kaydediyor ? "Kaydediliyor..." : "Taslak Kaydet"}
          onClick={() => void kaydet(false)}
          disabled={!gecerli || kaydediyor}
        />
        <SplitBadge
          color="green"
          left="Şahit onayı"
          right={kaydediyor ? "Gönderiliyor..." : "Kaydet ve Gönder"}
          onClick={() => void kaydet(true)}
          disabled={!gecerli || kaydediyor}
        />
      </div>
    </div>
  )
}
