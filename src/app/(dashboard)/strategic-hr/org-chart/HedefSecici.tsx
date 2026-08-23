"use client"

import { useMemo, useState } from "react"
import { Search, X } from "lucide-react"

// Hedef seçimi 300+ elemanlı açılır listeyle yapılamıyordu: aynı adda 20 kutu
// varken hangisini seçtiğin belli olmuyordu. Burada hedef AĞAÇTA görülerek
// seçilir; aramada da her satırın ÜST BİRİM ZİNCİRİ yazar.

export interface SeciciBirim {
  id: string
  name: string
  code?: string
  unitType: string
  positionStatus?: "AKTIF" | "DONDURULDU" | "PLANLANAN"
  children?: SeciciBirim[]
  employees?: { id: string; displayName: string; employmentStatus?: string }[]
}

export interface SeciciSecim {
  /** Birim modunda OrgUnit.id, koltuk modunda OrgEmployee.id */
  id: string
  etiket: string
  zincir: string
}

interface Props {
  baslik: string
  aciklama?: string
  birimler: SeciciBirim[]
  /** "birim": kutu seçilir · "koltuk": kutudaki kişi seçilir */
  mod: "birim" | "koltuk"
  /** Bu id'ler seçilemez (kaynak kutunun kendisi, kendi alt ağacı vb.) */
  secilemezIdler?: Set<string>
  /** Kök seçeneği ("üst birim yok") gösterilsin mi */
  kokSecenegi?: boolean
  onSec: (secim: SeciciSecim | null) => void
  onKapat: () => void
}

interface DuzSatir {
  id: string
  ad: string
  zincir: string
  derinlik: number
  birim: SeciciBirim
  koltukMu: boolean
}

function duzlestir(
  liste: SeciciBirim[],
  mod: "birim" | "koltuk",
  ustler: string[] = [],
  derinlik = 0,
): DuzSatir[] {
  const out: DuzSatir[] = []
  for (const b of liste ?? []) {
    if (b.positionStatus === "DONDURULDU") continue
    const zincir = ustler.join(" / ")
    if (mod === "birim") {
      out.push({ id: b.id, ad: b.name, zincir, derinlik, birim: b, koltukMu: false })
    } else {
      for (const e of b.employees ?? []) {
        if (e.employmentStatus === "VACANT") continue
        out.push({
          id: e.id,
          ad: `${e.displayName} — ${b.name}`,
          zincir,
          derinlik,
          birim: b,
          koltukMu: true,
        })
      }
    }
    if (b.children?.length) out.push(...duzlestir(b.children, mod, [b.name, ...ustler], derinlik + 1))
  }
  return out
}

export default function HedefSecici({
  baslik,
  aciklama,
  birimler,
  mod,
  secilemezIdler,
  kokSecenegi,
  onSec,
  onKapat,
}: Props) {
  const [arama, setArama] = useState("")
  const [kapali, setKapali] = useState<Set<string>>(new Set())

  const duz = useMemo(() => duzlestir(birimler, mod), [birimler, mod])

  const aramaSonuclari = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR")
    if (!q) return []
    return duz
      .filter((s) => s.ad.toLocaleLowerCase("tr-TR").includes(q))
      .slice(0, 40)
  }, [duz, arama])

  const secilemez = (id: string) => secilemezIdler?.has(id) ?? false

  const satirSec = (s: DuzSatir) => {
    if (secilemez(s.koltukMu ? s.birim.id : s.id)) return
    onSec({ id: s.id, etiket: s.ad, zincir: s.zincir })
  }

  const agacCiz = (liste: SeciciBirim[], ustler: string[] = [], derinlik = 0): React.ReactNode =>
    (liste ?? [])
      .filter((b) => b.positionStatus !== "DONDURULDU")
      .map((b) => {
        const cocuk = (b.children ?? []).filter((c) => c.positionStatus !== "DONDURULDU")
        const acik = !kapali.has(b.id)
        const zincir = ustler.join(" / ")
        const kisiler = (b.employees ?? []).filter((e) => e.employmentStatus !== "VACANT")
        return (
          <div key={b.id}>
            <div
              className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent"
              style={{ paddingLeft: derinlik * 14 + 4 }}
            >
              {cocuk.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setKapali((p) => {
                      const n = new Set(p)
                      if (n.has(b.id)) n.delete(b.id)
                      else n.add(b.id)
                      return n
                    })
                  }
                  className="h-4 w-4 shrink-0 rounded border text-[10px] leading-none text-muted-foreground"
                >
                  {acik ? "−" : "+"}
                </button>
              ) : (
                <span className="h-4 w-4 shrink-0" />
              )}
              {mod === "birim" ? (
                <button
                  type="button"
                  disabled={secilemez(b.id)}
                  onClick={() => satirSec({ id: b.id, ad: b.name, zincir, derinlik, birim: b, koltukMu: false })}
                  className="flex-1 truncate text-left text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  title={zincir ? `${b.name} — ${zincir}` : b.name}
                >
                  {b.name}
                  {b.unitType !== "POSITION" && (
                    <span className="ml-1 text-[10px] text-muted-foreground">({b.unitType === "DEPARTMENT" ? "departman" : "grup"})</span>
                  )}
                </button>
              ) : (
                <span className="flex-1 truncate text-xs text-muted-foreground">{b.name}</span>
              )}
            </div>
            {mod === "koltuk" &&
              kisiler.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  disabled={secilemez(e.id)}
                  onClick={() =>
                    satirSec({ id: e.id, ad: `${e.displayName} — ${b.name}`, zincir, derinlik, birim: b, koltukMu: true })
                  }
                  className="block w-full truncate rounded px-1 py-0.5 text-left text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ paddingLeft: derinlik * 14 + 26 }}
                >
                  {e.displayName}
                </button>
              ))}
            {acik && cocuk.length > 0 && agacCiz(cocuk, [b.name, ...ustler], derinlik + 1)}
          </div>
        )
      })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-lg border bg-card shadow-xl">
        <div className="flex items-start justify-between border-b p-3">
          <div>
            <div className="text-sm font-semibold">{baslik}</div>
            {aciklama && <div className="text-[11px] text-muted-foreground">{aciklama}</div>}
          </div>
          <button type="button" onClick={onKapat} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder={mod === "birim" ? "Kutu ara…" : "Kişi ara…"}
              className="h-8 w-full rounded border pl-7 pr-2 text-sm"
            />
          </div>
          {kokSecenegi && (
            <button
              type="button"
              onClick={() => onSec(null)}
              className="mt-2 w-full rounded border px-2 py-1 text-xs hover:bg-accent"
            >
              Üst birim yok (kök yap)
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {arama.trim() ? (
            aramaSonuclari.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">Sonuç bulunamadı</div>
            ) : (
              aramaSonuclari.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-arama-satiri="1"
                  disabled={secilemez(s.koltukMu ? s.birim.id : s.id)}
                  onClick={() => satirSec(s)}
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div className="truncate text-xs font-medium">{s.ad}</div>
                  {/* Aynı adlı kutuları ayırt etmenin tek yolu: üst birim zinciri */}
                  <div className="truncate text-[10px] text-muted-foreground">
                    {s.zincir || "(kök)"}
                  </div>
                </button>
              ))
            )
          ) : (
            agacCiz(birimler)
          )}
        </div>
      </div>
    </div>
  )
}
