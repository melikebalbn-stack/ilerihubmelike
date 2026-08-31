"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ChevronDown, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { normalizeAd } from "@/lib/org/normalize-ad"

export interface BolumSecenegi {
  id: string
  name: string
  isActive: boolean
  orgUnitId: string | null
  ustDepartman: { code: string; name: string } | null
}

interface Props {
  value: string
  onChange: (value: string, orgUnitId: string | null) => void
  id?: string
  disabled?: boolean
  /**
   * Listeden çıkarılacak bölüm adı. PersonnelTransferModal "mevcut bölüme
   * transfer" seçeneğini göstermiyordu; o davranış korunuyor.
   */
  haricTut?: string
}

/** orgUnitId dolu ama üst departmanı olmayanlar — kendileri müdürlük. */
const MUDURLUKLER = "Müdürlükler"
/** orgUnitId hiç yok — şemaya bağlanmamış bölümler, en altta. */
const TANIMSIZ = "Şemada tanımsız"

/**
 * Bölüm alanı — seçenekler DepartmentDefinition'dan gelir, org şemasındaki
 * ÜST DEPARTMAN'a göre gruplanır (hr-departments ucu `ustDepartman` döner).
 *
 * Şemada tanımlı olmayan mevcut değer KORUNUR ve uyarı gösterilir; kayıt
 * engellenmez — GorevSecici ile aynı ilke.
 *
 * SEÇİLEN DEĞER: bölümün `name`'i AYNEN. Büyük harfe ÇEVRİLMEZ —
 * DepartmentDefinition adları Başlık Biçimi'nde ("Fabrika Müdürlüğü") ve
 * Personnel.bolum onlarla birebir eşleşmeli.
 *
 * GorevSecici'den FARKLAR (bilinçli):
 *   - "kadro dolu" rozetinin bölüm karşılığı yok → eklenmedi
 *   - "Tüm pozisyonlar" kutucuğunun karşılığı yok (bölüm listesi zaten tam)
 *   - grup başlıkları var (sticky değil, basit ayırıcı)
 */
export function BolumSecici({ value, onChange, id, disabled, haricTut }: Props) {
  const [bolumler, setBolumler] = useState<BolumSecenegi[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState("")
  const kap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let iptal = false
    fetch("/api/settings/hr-departments")
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "yetki" : "sunucu")
        return r.json()
      })
      .then((d: BolumSecenegi[]) => {
        if (iptal) return
        const aktif = (d ?? []).filter((x) => x.isActive)
        setBolumler(aktif)
        setHata(aktif.length === 0 ? "Tanımlı bölüm bulunamadı (Ayarlar → İV Tanımları)." : null)
      })
      .catch((e: Error) => {
        if (iptal) return
        setBolumler([])
        setHata(e.message === "yetki" ? "Bölüm listesi için yetkiniz yok." : "Bölüm listesi yüklenemedi.")
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false)
      })
    return () => {
      iptal = true
    }
  }, [])

  useEffect(() => {
    const dis = (e: MouseEvent) => {
      if (kap.current && !kap.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener("mousedown", dis)
    return () => document.removeEventListener("mousedown", dis)
  }, [])

  const secilebilir = useMemo(
    () => bolumler.filter((b) => !haricTut || b.name !== haricTut),
    [bolumler, haricTut],
  )

  const liste = useMemo(() => {
    const q = normalizeAd(arama)
    if (!q) return secilebilir
    return secilebilir.filter((b) => normalizeAd(b.name).includes(q))
  }, [secilebilir, arama])

  /** Grup sırası: üst departmanlar alfabetik → Müdürlükler → Şemada tanımsız. */
  const gruplar = useMemo(() => {
    const harita = new Map<string, BolumSecenegi[]>()
    for (const b of liste) {
      const anahtar = b.ustDepartman?.name ?? (b.orgUnitId ? MUDURLUKLER : TANIMSIZ)
      const mevcut = harita.get(anahtar)
      if (mevcut) mevcut.push(b)
      else harita.set(anahtar, [b])
    }
    const sirala = (a: string, b: string) => {
      const rank = (k: string) => (k === TANIMSIZ ? 2 : k === MUDURLUKLER ? 1 : 0)
      const fark = rank(a) - rank(b)
      return fark !== 0 ? fark : a.localeCompare(b, "tr")
    }
    return [...harita.entries()]
      .sort((a, b) => sirala(a[0], b[0]))
      .map(([baslik, items]) => ({
        baslik,
        items: [...items].sort((x, y) => x.name.localeCompare(y.name, "tr")),
      }))
  }, [liste])

  const semadaVar = useMemo(
    () => !value || bolumler.some((b) => normalizeAd(b.name) === normalizeAd(value)),
    [bolumler, value],
  )

  const sec = (b: BolumSecenegi) => {
    // name AYNEN — büyük harfe çevrilmez (Personnel.bolum ile birebir olmalı).
    onChange(b.name, b.orgUnitId)
    setAcik(false)
    setArama("")
  }

  return (
    <div ref={kap} className="relative space-y-1">
      <button
        type="button"
        id={id}
        disabled={disabled || !!hata}
        title={hata ?? undefined}
        onClick={() => setAcik((a) => !a)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:opacity-50"
      >
        <span className={value ? "truncate" : "truncate text-muted-foreground"}>
          {value || (yukleniyor ? "Yükleniyor…" : hata ? hata : "Seçiniz")}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {!semadaVar && !yukleniyor && !hata && (
        <div className="flex items-start gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Bu bölüm şemada tanımlı değil. Değer korunur, kayıt engellenmez.</span>
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
                placeholder="Bölüm ara…"
                className="h-8 pl-7 text-sm"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {gruplar.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Sonuç bulunamadı</div>
            )}
            {gruplar.map((g) => (
              <div key={g.baslik}>
                <div className="border-t px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground first:border-t-0 first:pt-1">
                  {g.baslik}
                </div>
                {g.items.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => sec(b)}
                    className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="truncate">{b.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
