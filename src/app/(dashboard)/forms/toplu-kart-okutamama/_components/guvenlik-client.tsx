"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { NEDEN_LABELS, VALID_NEDEN } from "@/app/api/toplu-kart-okutamama/_lib/neden"
import { PersonnelPicker, type PickedPersonnel } from "./personnel-picker"
import { TimeCombobox } from "./time-combobox"

/**
 * GÜVENLİK görünümü (28.09, İV) — kart_okutamama.guvenlik izni olan hesap YALNIZ bunu görür:
 * herhangi bir aktif personel adına kayıt açar + KENDİ açtığı kayıtları durumlarıyla izler.
 * Kayıt AMİR onayına gider (BEKLIYOR), sonra İV. Amir kararından önce silinebilir.
 * Toplu giriş / import / export / istatistik / İV onayı YOK (API de 403).
 */
type Kayit = {
  id: string
  sicilNo: string | null
  adSoyad: string
  tarih: string
  girisSaati: string | null
  cikisSaati: string | null
  neden: string | null
  onayDurumu: "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI"
  approverId: string | null
  approverId2: string | null
  approverId3: string | null
  ivOnaylandi: boolean
}

const bugun = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
const tarihFmt = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`

function durum(k: Kayit): { metin: string; ton: string } {
  if (k.ivOnaylandi) return { metin: "İV onaylı", ton: "border-blue-200 bg-blue-50 text-blue-800" }
  if (k.onayDurumu === "REDDEDILDI") return { metin: "Amir reddetti", ton: "border-slate-200 bg-slate-100 text-slate-600" }
  if (k.onayDurumu === "ONAYLANDI") return { metin: "Amir onayladı · İV bekliyor", ton: "border-amber-200 bg-amber-50 text-amber-800" }
  const sahipsiz = !k.approverId && !k.approverId2 && !k.approverId3
  return { metin: sahipsiz ? "Amir bulunamadı · İV karar verecek" : "Amir onayı bekliyor", ton: "border-amber-200 bg-amber-50 text-amber-800" }
}

export function GuvenlikKartClient() {
  const [personel, setPersonel] = useState<PickedPersonnel | null>(null)
  const [tarih, setTarih] = useState(bugun())
  const [giris, setGiris] = useState("")
  const [cikis, setCikis] = useState("")
  const [neden, setNeden] = useState("")
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [mesaj, setMesaj] = useState<{ tur: "ok" | "hata"; metin: string } | null>(null)
  const [kayitlar, setKayitlar] = useState<Kayit[] | null>(null)

  const yukle = useCallback(async () => {
    const r = await fetch("/api/toplu-kart-okutamama?limit=50&sortBy=tarih&sortOrder=desc", { cache: "no-store" })
    if (r.ok) setKayitlar((await r.json()).records)
  }, [])
  useEffect(() => void yukle(), [yukle])

  const kaydet = async () => {
    if (!personel) return setMesaj({ tur: "hata", metin: "Personel seçin" })
    if (!giris && !cikis) return setMesaj({ tur: "hata", metin: "Giriş ya da çıkış saatinden en az biri gerekli" })
    setKaydediliyor(true)
    setMesaj(null)
    const r = await fetch("/api/toplu-kart-okutamama", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personnelId: personel.id, tarih, girisSaati: giris || null, cikisSaati: cikis || null, neden: neden || null }),
    })
    setKaydediliyor(false)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return setMesaj({ tur: "hata", metin: d.error ?? "Kayıt açılamadı" })
    setMesaj({ tur: "ok", metin: `${personel.adSoyad} için kayıt açıldı — amir onayına gönderildi.` })
    setPersonel(null)
    setGiris("")
    setCikis("")
    setNeden("")
    void yukle()
  }

  const sil = async (id: string) => {
    if (!window.confirm("Bu kaydı silmek istiyor musunuz?")) return
    const r = await fetch(`/api/toplu-kart-okutamama/${id}`, { method: "DELETE" })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      return setMesaj({ tur: "hata", metin: d.error ?? "Silinemedi" })
    }
    void yukle()
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <ShieldCheck className="h-6 w-6" /> Kart Okutamama — Güvenlik
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kartını okutamayan personel için kayıt açın. Kayıt personelin amirine, ardından İnsan Varlıkları&apos;na gider.
        </p>
      </div>

      <section className="space-y-4 rounded-lg border bg-white p-4 sm:p-5" aria-labelledby="yeni-kayit">
        <h2 id="yeni-kayit" className="text-base font-semibold">Yeni kayıt</h2>
        <div>
          <Label className="text-xs text-slate-500">Personel</Label>
          <div className="mt-1"><PersonnelPicker value={personel} onSelect={setPersonel} /></div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="g-tarih" className="text-xs text-slate-500">Tarih</Label>
            <Input id="g-tarih" type="date" value={tarih} max={bugun()} onChange={(e) => setTarih(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Giriş saati</Label>
            <div className="mt-1"><TimeCombobox value={giris} onChange={setGiris} placeholder="—" /></div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Çıkış saati</Label>
            <div className="mt-1"><TimeCombobox value={cikis} onChange={setCikis} placeholder="—" /></div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Neden</Label>
            <Select value={neden} onValueChange={setNeden}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seçin" /></SelectTrigger>
              <SelectContent>{VALID_NEDEN.map((n) => <SelectItem key={n} value={n}>{NEDEN_LABELS[n]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {mesaj && (
          <p className={cn("rounded-md px-3 py-2 text-sm", mesaj.tur === "ok" ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-900")}>{mesaj.metin}</p>
        )}
        <div className="flex justify-end">
          <Button onClick={kaydet} disabled={kaydediliyor || !personel} className="h-11 px-6">
            {kaydediliyor && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Kaydı aç
          </Button>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border bg-white p-4 sm:p-5" aria-labelledby="kayitlarim">
        <h2 id="kayitlarim" className="text-base font-semibold">Açtığım kayıtlar</h2>
        {!kayitlar && <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />}
        {kayitlar?.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Henüz kayıt yok</p>}
        <ul className="divide-y">
          {kayitlar?.map((k) => {
            const d = durum(k)
            return (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <div className="font-medium">{k.adSoyad} <span className="font-mono text-xs text-slate-500">{k.sicilNo}</span></div>
                  <div className="text-xs text-slate-500">
                    {tarihFmt(k.tarih)} · {k.girisSaati ?? "—"} – {k.cikisSaati ?? "—"}{k.neden ? ` · ${NEDEN_LABELS[k.neden as keyof typeof NEDEN_LABELS] ?? k.neden}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs", d.ton)}>{d.metin}</span>
                  {k.onayDurumu === "BEKLIYOR" && !k.ivOnaylandi && (
                    <Button variant="ghost" size="sm" onClick={() => sil(k.id)}>Sil</Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
