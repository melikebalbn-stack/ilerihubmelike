"use client"

// "Şemada Yeri Yok" kartına tıklanınca açılan liste + YERLEŞTİRME modalı.
// Liste SUNUCUDAN gelir (org-chart GET → koltuksuzPersonel, yalnız hasFullAccess).
// Emsal: PersonelsizKoltukModal — aynı desen (liste + satır içi işlem).
//
// YENİ UÇ YOK. İki yol da mevcut uçları kullanır:
//   (a) mevcut boş kutuya oturt  → POST org-chart/uye-ata
//   (b) yeni kutu aç ve oturt    → POST org-chart/birim + POST org-chart/uye-ata
// 1:1 kuralı: uye-ata dolu kadroyu zaten reddeder; ayrıca seçicide dolu kutular
// seçilemez görünür (çift kapı).

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import HedefSecici, { type SeciciBirim } from "./HedefSecici"

export interface KoltuksuzPersonel {
  id: string
  sicilNo: string | null
  adSoyad: string
  bolum: string
  gorev: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  personeller: KoltuksuzPersonel[]
  /** Tüm ağaç — boş kutu önerisi ve hedef seçici bundan beslenir. */
  birimler?: SeciciBirim[]
  hasFullAccess?: boolean
  onRefresh?: () => void
  /** Yerleştirme bitince ağaçta o kutuya kaydırma/vurgulama isteği. */
  onYerlesti?: (orgUnitId: string) => void
}

const DIACRITIC: Record<string, string> = { Ç: "C", Ğ: "G", Ş: "S", Ö: "O", Ü: "U", İ: "I" }
/** koltuk-eslesme.ts'teki normalizeAd ile aynı aile. */
function normalizeAd(s: string): string {
  if (!s) return ""
  return s
    .toLocaleUpperCase("tr-TR")
    .replace(/[ÇĞŞÖÜİ]/g, (c) => DIACRITIC[c] ?? c)
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
}

interface DuzKutu {
  birim: SeciciBirim
  zincir: string
  dolu: boolean
}

function duzlestir(liste: SeciciBirim[], ustler: string[] = []): DuzKutu[] {
  const out: DuzKutu[] = []
  for (const b of liste ?? []) {
    if (b.positionStatus === "DONDURULDU") continue
    if (b.unitType === "POSITION") {
      const dolu = (b.employees ?? []).some((e) => e.employmentStatus !== "VACANT")
      out.push({ birim: b, zincir: ustler.join(" / "), dolu })
    }
    if (b.children?.length) out.push(...duzlestir(b.children, [b.name, ...ustler]))
  }
  return out
}

/** Dolu kutular ve pozisyon olmayan birimler hedef olamaz (1:1). */
function secilemezler(liste: SeciciBirim[], out: Set<string> = new Set()): Set<string> {
  for (const b of liste ?? []) {
    const dolu = (b.employees ?? []).some((e) => e.employmentStatus !== "VACANT")
    if (b.unitType !== "POSITION" || dolu || b.positionStatus === "DONDURULDU") out.add(b.id)
    if (b.children?.length) secilemezler(b.children, out)
  }
  return out
}

export default function KoltuksuzPersonelModal({
  open, onOpenChange, personeller, birimler = [], hasFullAccess = false, onRefresh, onYerlesti,
}: Props) {
  const [acikKisi, setAcikKisi] = useState<KoltuksuzPersonel | null>(null)
  const [yol, setYol] = useState<"mevcut" | "yeni" | null>(null)
  const [secici, setSecici] = useState<"bosKutu" | "ustBirim" | null>(null)
  const [yeniAd, setYeniAd] = useState("")
  const [yeniUst, setYeniUst] = useState<{ id: string; etiket: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const duzKutular = useMemo(() => duzlestir(birimler), [birimler])
  const bosKutular = useMemo(() => duzKutular.filter((k) => !k.dolu), [duzKutular])
  const secilemezSet = useMemo(() => secilemezler(birimler), [birimler])

  // Öneri: kişinin görevine karşılık gelen BOŞ kutular.
  const oneriler = useMemo(() => {
    if (!acikKisi) return []
    const g = normalizeAd(acikKisi.gorev)
    if (!g) return []
    return bosKutular.filter((k) => normalizeAd(k.birim.name) === g)
  }, [acikKisi, bosKutular])

  // Yerleştirme paneli açılırken liste diyalogu KAPANIR: Radix overlay'i üstte
  // kalıyor ve panel görünür ama tıklanamaz oluyordu. Vazgeçilirse listeye dönülür.
  const panelAc = (p: KoltuksuzPersonel) => {
    setAcikKisi(p); setYol(null); setYeniAd(p.gorev ?? ""); setYeniUst(null)
    onOpenChange(false)
  }
  const kapat = (listeyeDon = false) => {
    setAcikKisi(null); setYol(null); setSecici(null); setYeniAd(""); setYeniUst(null)
    if (listeyeDon) onOpenChange(true)
  }

  const cagir = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.status === 403) { toast.error("Bu işlem için yetkiniz yok"); return null }
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) { toast.error(data.error || "İşlem başarısız"); return null }
    return data as Record<string, unknown>
  }

  /** (a) Mevcut boş kutuya oturt. */
  const mevcudaOturt = async (orgUnitId: string, kutuAdi: string) => {
    if (!acikKisi) return
    setSaving(true)
    try {
      const d = await cagir("/api/strategic-hr/org-chart/uye-ata", {
        orgUnitId, personnelId: acikKisi.id, displayName: acikKisi.adSoyad,
      })
      if (!d) return
      toast.success(`${acikKisi.adSoyad} → ${kutuAdi}`)
      kapat()
      onRefresh?.()
      onYerlesti?.(orgUnitId)
    } finally {
      setSaving(false)
    }
  }

  /** (b) Yeni kutu aç + oturt. Kutu açıldıktan sonra oturtma başarısız olursa
   *  kullanıcıya AÇIK söylenir — kutu ortada kalmasın, elle bağlanabilsin. */
  const yeniAcVeOturt = async () => {
    if (!acikKisi || !yeniUst || !yeniAd.trim()) return
    setSaving(true)
    try {
      const b = await cagir("/api/strategic-hr/org-chart/birim", {
        name: yeniAd.trim(), unitType: "POSITION", parentId: yeniUst.id,
      })
      const yeniId = (b?.birim as { id?: string } | undefined)?.id
      if (!yeniId) return
      const a = await cagir("/api/strategic-hr/org-chart/uye-ata", {
        orgUnitId: yeniId, personnelId: acikKisi.id, displayName: acikKisi.adSoyad,
      })
      if (!a) {
        toast.error(`"${yeniAd.trim()}" kutusu açıldı ama kişi oturtulamadı — kutudan "Üye ata" ile bağlayın`)
        kapat(); onRefresh?.(); onYerlesti?.(yeniId)
        return
      }
      toast.success(`${yeniAd.trim()} açıldı, ${acikKisi.adSoyad} oturtuldu`)
      kapat()
      onRefresh?.()
      onYerlesti?.(yeniId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Şemada Yeri Olmayan Personel ({personeller.length})</DialogTitle>
            <DialogDescription>
              Aktif olup organizasyon şemasında koltuğu bulunmayan personel.
              {hasFullAccess ? " Yerleştir ile boş bir kutuya oturtun ya da yeni kutu açın." : ""}
            </DialogDescription>
          </DialogHeader>

          {personeller.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tüm aktif personelin şemada yeri var.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto rounded-md border">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Sicil</TableHead>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Bölüm</TableHead>
                    <TableHead>Görev</TableHead>
                    {hasFullAccess && <TableHead className="w-28" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personeller.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.sicilNo || "-"}</TableCell>
                      <TableCell className="font-medium">{p.adSoyad}</TableCell>
                      <TableCell className="text-muted-foreground">{p.bolum}</TableCell>
                      <TableCell>{p.gorev}</TableCell>
                      {hasFullAccess && (
                        <TableCell>
                          <button
                            type="button"
                            data-yerlestir={p.id}
                            onClick={() => panelAc(p)}
                            className="rounded border border-teal-300 px-2 py-1 text-[11px] font-medium text-teal-700 hover:bg-teal-50"
                          >
                            ► Yerleştir
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Yerleştirme paneli — kişi seçilince açılır */}
      {acikKisi && hasFullAccess && !secici && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-card p-4 shadow-xl" data-yerlestirme-panel="1">
            <div className="text-sm font-semibold">{acikKisi.adSoyad} — şemaya yerleştir</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {acikKisi.sicilNo} · {acikKisi.bolum} · {acikKisi.gorev}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setYol("mevcut")}
                className={`flex-1 rounded border px-2 py-1.5 text-xs ${yol === "mevcut" ? "border-teal-500 bg-teal-50" : ""}`}
              >
                Mevcut boş kutuya oturt
              </button>
              <button
                type="button"
                onClick={() => setYol("yeni")}
                className={`flex-1 rounded border px-2 py-1.5 text-xs ${yol === "yeni" ? "border-teal-500 bg-teal-50" : ""}`}
              >
                Yeni kutu aç ve oturt
              </button>
            </div>

            {yol === "mevcut" && (
              <div className="mt-3 space-y-2">
                <div className="text-[11px] font-medium">
                  Görevine uyan boş kutular ({oneriler.length})
                </div>
                {oneriler.length === 0 ? (
                  <div className="rounded border border-dashed p-2 text-[11px] text-muted-foreground">
                    &quot;{acikKisi.gorev}&quot; unvanında boş kutu yok — ağaçtan seçin ya da yeni kutu açın.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded border">
                    {oneriler.map((k) => (
                      <button
                        key={k.birim.id}
                        type="button"
                        data-oneri="1"
                        disabled={saving}
                        onClick={() => mevcudaOturt(k.birim.id, k.birim.name)}
                        className="block w-full border-b px-2 py-1.5 text-left last:border-b-0 hover:bg-accent disabled:opacity-50"
                      >
                        <div className="text-xs font-medium">{k.birim.name}</div>
                        <div className="text-[10px] text-muted-foreground">{k.zincir || "(kök)"}</div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSecici("bosKutu")}
                  className="w-full rounded border px-2 py-1.5 text-xs hover:bg-accent"
                >
                  Tüm boş kutular arasından ağaçtan seç ({bosKutular.length})
                </button>
              </div>
            )}

            {yol === "yeni" && (
              <div className="mt-3 space-y-2">
                <label className="block text-[11px] font-medium">Kutu adı</label>
                {/* Ön-dolu: kişinin Personnel.gorev değeri */}
                <input
                  value={yeniAd}
                  onChange={(e) => setYeniAd(e.target.value)}
                  data-yeni-kutu-adi="1"
                  className="h-9 w-full rounded border px-2 text-sm"
                />
                <label className="block text-[11px] font-medium">Üst birim</label>
                <button
                  type="button"
                  onClick={() => setSecici("ustBirim")}
                  className="h-9 w-full rounded border px-2 text-left text-sm"
                >
                  {yeniUst ? yeniUst.etiket : <span className="text-muted-foreground">Ağaçtan seçin…</span>}
                </button>
                <button
                  type="button"
                  disabled={saving || !yeniAd.trim() || !yeniUst}
                  onClick={yeniAcVeOturt}
                  className="w-full rounded bg-teal-700 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Yerleştiriliyor…" : "Kutuyu aç ve oturt"}
                </button>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => kapat(true)} className="rounded border px-3 py-1.5 text-xs">
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {acikKisi && secici === "bosKutu" && (
        <HedefSecici
          baslik="Boş kutu seç"
          aciklama={`${acikKisi.adSoyad} buraya oturtulacak — dolu kutular seçilemez`}
          birimler={birimler}
          mod="birim"
          secilemezIdler={secilemezSet}
          onKapat={() => setSecici(null)}
          onSec={async (s) => {
            setSecici(null)
            if (s) await mevcudaOturt(s.id, s.etiket)
          }}
        />
      )}

      {acikKisi && secici === "ustBirim" && (
        <HedefSecici
          baslik="Üst birim seç"
          aciklama={`"${yeniAd || acikKisi.gorev}" kutusu bunun altına açılacak`}
          birimler={birimler}
          mod="birim"
          onKapat={() => setSecici(null)}
          onSec={(s) => {
            setSecici(null)
            if (s) setYeniUst({ id: s.id, etiket: s.etiket })
          }}
        />
      )}
    </>
  )
}
