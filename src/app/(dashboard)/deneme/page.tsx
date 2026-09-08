"use client"

// IV-FR-27 · Değerlendirme listesi.
// GÖRÜNÜRLÜK: İV tüm formları görür; diğerleri YALNIZ kendi zincirindekileri —
// filtreleme sunucuda (GET /api/deneme), zincir dışı form buraya HİÇ gelmez.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NativeSelect as Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Loader2, ClipboardList, RotateCcw } from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"

const DURUM_ETIKET: Record<string, string> = {
  TASLAK: "Taslak",
  DEGERLENDIRICI1_BEKLIYOR: "1. Değerlendirici",
  MUDUR_YRD_BEKLIYOR: "Müdür Yardımcısı",
  MUDUR_BEKLIYOR: "Müdür",
  ONAY_BEKLIYOR: "Onay",
  IK_BEKLIYOR: "İnsan Varlıkları",
  TAMAMLANDI: "Tamamlandı",
  IPTAL: "İptal",
}
const GECME_PUANI = 60

type Satir = {
  id: string
  tur: "DENEME_2AY" | "ALTI_AY"
  durum: string
  hedefTarih: string
  yakaRengi: string
  puan1: number | null
  puan2: number | null
  ortalama: number | null
  basarili: boolean | null
  adimSahibi: string | null
  personnel: { sicilNo: string | null; adSoyad: string; bolum: string; gorev: string }
}

const gun = (t: string) => Math.round((new Date(t).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)

export default function DenemeListesiPage() {
  const [satirlar, setSatirlar] = useState<Satir[]>([])
  const [kapsam, setKapsam] = useState<"tumu" | "kendi">("kendi")
  const [yukleniyor, setYukleniyor] = useState(true)
  const [f, setF] = useState({ durum: "", tur: "", yaka: "", bolum: "", baslangic: "", bitis: "", hepsi: "false" })

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    try {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(f)) if (v && !(k === "hepsi" && v === "false")) qs.set(k, v)
      const res = await apiFetch(`/api/deneme?${qs.toString()}`)
      if (!res.ok) { setSatirlar([]); return }
      const j = await res.json()
      setSatirlar(j.formlar ?? [])
      setKapsam(j.kapsam ?? "kendi")
    } finally {
      setYukleniyor(false)
    }
  }, [f])

  useEffect(() => { void yukle() }, [yukle])

  const bolumler = useMemo(
    () => [...new Set(satirlar.map((s) => s.personnel.bolum))].sort((a, b) => a.localeCompare(b, "tr")),
    [satirlar],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ClipboardList className="h-5 w-5" /> Deneme Süresi Değerlendirmeleri
          </h1>
          <p className="text-sm text-muted-foreground">
            IV-FR-27 · {kapsam === "tumu" ? "tüm formlar" : "zincirinizdeki formlar"} · {satirlar.length} kayıt
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void yukle()}>
          <RotateCcw className="mr-2 h-4 w-4" /> Yenile
        </Button>
      </div>

      {/* ── FİLTRELER ── */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Select value={f.durum} onChange={(e) => setF({ ...f, durum: e.target.value })}>
            <option value="">Durum (açık formlar)</option>
            {Object.entries(DURUM_ETIKET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={f.tur} onChange={(e) => setF({ ...f, tur: e.target.value })}>
            <option value="">Tür (hepsi)</option>
            <option value="DENEME_2AY">2 AY</option>
            <option value="ALTI_AY">6 AY</option>
          </Select>
          <Select value={f.yaka} onChange={(e) => setF({ ...f, yaka: e.target.value })}>
            <option value="">Yaka (hepsi)</option>
            <option value="MAVI">Mavi</option>
            <option value="GRI">Gri</option>
            <option value="BEYAZ">Beyaz</option>
          </Select>
          <Select value={f.bolum} onChange={(e) => setF({ ...f, bolum: e.target.value })}>
            <option value="">Bölüm (hepsi)</option>
            {bolumler.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
          <Input type="date" value={f.baslangic} onChange={(e) => setF({ ...f, baslangic: e.target.value })} />
          <Input type="date" value={f.bitis} onChange={(e) => setF({ ...f, bitis: e.target.value })} />
        </CardContent>
        <CardContent className="flex items-center gap-4 border-t px-4 py-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={f.hepsi === "true"}
              onChange={(e) => setF({ ...f, hepsi: e.target.checked ? "true" : "false" })}
            />
            Kapanmış formları da göster
          </label>
          <span className="text-muted-foreground">
            Varsayılan: yalnız açık formlar (Tamamlandı ve İptal hariç)
          </span>
        </CardContent>
      </Card>

      {/* ── TABLO ── */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                <th>Personel</th><th>Tür</th><th>Yaka</th><th>Bölüm</th>
                <th>Hedef Tarih</th><th>Durum</th><th>Adım Sahibi</th>
                <th className="text-right">1. Puan</th><th className="text-right">2. Puan</th>
                <th className="text-right">Ortalama</th><th>Sonuç</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {yukleniyor && (
                <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td></tr>
              )}
              {!yukleniyor && satirlar.length === 0 && (
                <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">
                  Görüntüleyebileceğiniz değerlendirme yok.
                </td></tr>
              )}
              {!yukleniyor && satirlar.map((s) => {
                const acik = !["TAMAMLANDI", "IPTAL"].includes(s.durum)
                const kalan = gun(s.hedefTarih)
                const gecikmis = acik && kalan < 0
                const yaklasan = acik && kalan >= 0 && kalan <= 3
                const dusuk = s.ortalama !== null && s.ortalama < GECME_PUANI
                return (
                  <tr
                    key={s.id}
                    className={cn(
                      "[&>td]:px-3 [&>td]:py-2 hover:bg-muted/40",
                      gecikmis && "bg-destructive/10",
                      yaklasan && "bg-amber-100/60 dark:bg-amber-500/10",
                    )}
                  >
                    <td>
                      <Link href={`/deneme/${s.id}`} className="font-medium hover:underline">
                        {s.personnel.adSoyad}
                      </Link>
                      <div className="text-xs text-muted-foreground">{s.personnel.sicilNo}</div>
                    </td>
                    <td><Badge variant={s.tur === "DENEME_2AY" ? "secondary" : "default"}>
                      {s.tur === "DENEME_2AY" ? "2 AY" : "6 AY"}
                    </Badge></td>
                    <td className="text-xs">{s.yakaRengi}</td>
                    <td className="max-w-[180px] truncate" title={s.personnel.bolum}>{s.personnel.bolum}</td>
                    <td className={cn("whitespace-nowrap tabular-nums", gecikmis && "font-semibold text-destructive")}>
                      {new Date(s.hedefTarih).toLocaleDateString("tr-TR")}
                      {acik && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({kalan < 0 ? `${-kalan} gün geçti` : kalan === 0 ? "bugün" : `${kalan} gün`})
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{DURUM_ETIKET[s.durum] ?? s.durum}</td>
                    <td className="whitespace-nowrap text-xs">{s.adimSahibi ?? "—"}</td>
                    <td className="text-right tabular-nums">{s.puan1 ?? "—"}</td>
                    <td className="text-right tabular-nums">{s.puan2 ?? "—"}</td>
                    <td className={cn("text-right font-semibold tabular-nums", dusuk && "text-destructive")}>
                      {s.ortalama?.toFixed(1) ?? "—"}
                    </td>
                    <td>
                      {s.basarili === null ? "—" : (
                        <Badge variant={s.basarili ? "default" : "destructive"}>
                          {s.basarili ? "BAŞARILI" : "BAŞARISIZ"}
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        <span className="mr-3 inline-block h-2 w-2 rounded-full bg-destructive/40 align-middle" /> hedef tarihi geçmiş ve hâlâ açık
        <span className="ml-4 mr-3 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" /> 3 gün ve altı kalmış
      </p>
    </div>
  )
}
