"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ChevronDown, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { buyukTR, normalizeAd } from "@/lib/org/normalize-ad"

export { buyukTR }

export interface PozisyonSecenegi {
  ad: string
  adBuyuk: string
  zincir: string[]
  kutuSayisi: number
  bosKutuVar: boolean
  /** Üst zincirdeki kutu id'leri — FK tabanlı süzme için (sunucu doldurur). */
  ustIds?: string[]
}

interface Props {
  value: string
  onChange: (value: string) => void
  /** Seçili bölüm — FK yoksa ad kuralıyla süzme için. */
  bolum?: string
  /**
   * Seçili bölümün şema kutusu. VARSA süzme bunun alt ağacına göre yapılır
   * (ad kuralındaki "Kalıphane ↔ Kalite" gibi kapsama yanılgıları olmaz).
   * Yoksa MEVCUT ad kuralına düşülür — fail-open korunur.
   */
  bolumOrgUnitId?: string | null
  id?: string
  disabled?: boolean
}

/**
 * Görev alanı — seçenekler organizasyon şemasındaki POSITION kutu adlarından gelir.
 * Şemada tanımlı olmayan mevcut değer KORUNUR ve uyarı gösterilir; kayıt engellenmez.
 */
export function GorevSecici({ value, onChange, bolum, bolumOrgUnitId, id, disabled }: Props) {
  const [pozisyonlar, setPozisyonlar] = useState<PozisyonSecenegi[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState("")
  const [bolumSuz, setBolumSuz] = useState(true)
  const kap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/org/pozisyon-adlari")
      .then((r) => (r.ok ? r.json() : { pozisyonlar: [] }))
      .then((d: { pozisyonlar?: PozisyonSecenegi[] }) => setPozisyonlar(d.pozisyonlar ?? []))
      .catch(() => {})
      .finally(() => setYukleniyor(false))
  }, [])

  useEffect(() => {
    const dis = (e: MouseEvent) => {
      if (kap.current && !kap.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener("mousedown", dis)
    return () => document.removeEventListener("mousedown", dis)
  }, [])

  // Bölüme göre süzme — ÖNCE FK, sonra ad kuralı.
  //   1. bolumOrgUnitId varsa: o kutunun ALT AĞACINDAKİ pozisyonlar (kesin bağ)
  //   2. yoksa (ya da FK ile hiç eşleşme çıkmazsa): MEVCUT ad kuralı
  // Her iki yolda da sonuç boşsa süzme YAPILMAZ — fail-open korunur, kullanıcı
  // şemadan kopuk bir bölümde de görev seçebilir.
  const bolumeUyan = useMemo(() => {
    if (bolumOrgUnitId) {
      const fk = pozisyonlar.filter((p) => p.ustIds?.includes(bolumOrgUnitId))
      if (fk.length > 0) return fk
    }
    const b = normalizeAd(bolum ?? "")
    if (!b) return pozisyonlar
    const uyan = pozisyonlar.filter((p) =>
      p.zincir.some((z) => {
        const n = normalizeAd(z)
        return !!n && (n === b || n.includes(b) || b.includes(n))
      }),
    )
    return uyan.length > 0 ? uyan : pozisyonlar
  }, [pozisyonlar, bolum, bolumOrgUnitId])

  const bolumSuzmeIsliyor = bolumeUyan.length !== pozisyonlar.length

  const liste = useMemo(() => {
    const kaynak = bolumSuz && bolumSuzmeIsliyor ? bolumeUyan : pozisyonlar
    const q = normalizeAd(arama)
    if (!q) return kaynak
    return kaynak.filter((p) => normalizeAd(p.ad).includes(q))
  }, [pozisyonlar, bolumeUyan, bolumSuz, bolumSuzmeIsliyor, arama])

  const semadaVar = useMemo(
    () => !value || pozisyonlar.some((p) => normalizeAd(p.ad) === normalizeAd(value)),
    [pozisyonlar, value],
  )

  const sec = (p: PozisyonSecenegi) => {
    onChange(p.adBuyuk)
    setAcik(false)
    setArama("")
  }

  return (
    <div ref={kap} className="relative space-y-1">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setAcik((a) => !a)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:opacity-50"
      >
        <span className={value ? "truncate" : "truncate text-muted-foreground"}>
          {value || (yukleniyor ? "Yükleniyor…" : "Seçiniz")}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {!semadaVar && !yukleniyor && (
        <div className="flex items-start gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Bu görev şemada tanımlı değil. Değer korunur, kayıt engellenmez.</span>
        </div>
      )}

      {acik && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="Görev ara…"
                className="h-8 pl-7 text-sm"
              />
            </div>
            {bolumSuzmeIsliyor && (
              <label className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!bolumSuz}
                  onChange={(e) => setBolumSuz(!e.target.checked)}
                />
                Tüm pozisyonlar ({pozisyonlar.length}) — bölüm dışı atama
              </label>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {liste.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Sonuç bulunamadı</div>
            )}
            {liste.map((p) => (
              <button
                key={p.ad}
                type="button"
                onClick={() => sec(p)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="truncate">{p.adBuyuk}</span>
                {!p.bosKutuVar && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">kadro dolu</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
