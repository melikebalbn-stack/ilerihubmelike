"use client"

// Faz 2 — personel kartında çoklu üretim satırı editörü (create + edit ortak).
// Her satır: "Mesai Nedeni"/"Vardiya Sebebi" = parça kodu (text) + "Hedef Adet" (number).
// Faz 1 API sözleşmesi: submit'te uretimSatirlari: [{ parcaKodu, hedefAdet }].

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, AlertTriangle } from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"

/**
 * HEDEF UYARISI (20.09.2026): parça kodu + hedef girilince aynı sayısal parça kodunun geçmiş
 * hedef aralığıyla karşılaştırır (sunucu: /api/overtime/hedef-gecmis, kural lib
 * hedefUyarisi — hedef < geçmiş medyanın 1/10'u, ≥2 kayıt). ENGELLEMEZ, sadece uyarır.
 * Serbest metin kodda (AYAR, taşlama) sunucu geçmiş aramaz → uyarı yok. 500 ms debounce.
 */
function HedefUyari({ parcaKodu, hedefAdet, aktif }: { parcaKodu: string; hedefAdet: string; aktif: boolean }) {
  const [uyari, setUyari] = useState<string | null>(null)
  useEffect(() => {
    const kod = parcaKodu.trim()
    const h = hedefAdet.trim()
    // Yalnız sayısal parça kodu (ilk token) + geçerli hedef>0 için sor; aksi halde uyarıyı sil.
    if (!aktif || !/^\d{3,}(-\d+)?$/.test(kod.split(/\s+/)[0] ?? "") || h === "" || !(Number(h) > 0)) { setUyari(null); return }
    let alive = true
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/overtime/hedef-gecmis?parcaKodu=${encodeURIComponent(kod)}&hedef=${encodeURIComponent(h)}`)
        if (!alive || res.__authHandled || !res.ok) return
        const data = (await res.json()) as { uyari: string | null }
        if (alive) setUyari(data.uyari ?? null)
      } catch { /* uyarı bilgi amaçlı — sessiz geç */ }
    }, 500)
    return () => { alive = false; clearTimeout(t) }
  }, [parcaKodu, hedefAdet, aktif])
  if (!uyari) return null
  return (
    <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{uyari} — kaydetmeye devam edebilirsiniz.</span>
    </div>
  )
}

export interface UretimSatirInput {
  parcaKodu: string
  hedefAdet: string // string state; submit sırasında Number'a çevrilir
  // KPI Faz 2: "Sayılamayan iş" (ayar, birim sorumlusu, eğitim…) — işaretliyken hedef 0'a
  // kilitlenir. Yalnız UI durumu; API/şemada karşılığı hedefAdet=0 (KPI'ya girmez).
  sayilamayan?: boolean
}

export function emptyUretimSatir(): UretimSatirInput {
  return { parcaKodu: "", hedefAdet: "", sayilamayan: false }
}

/** Mevcut satırdan UI durumu: hedef 0 ise kutucuk işaretli gelir (kayıtlı 0 = sayılamayan). */
export function sayilamayanMi(hedefAdet: number | null | undefined): boolean {
  return hedefAdet === 0
}

/** Bir satır dolu mu (herhangi bir alanı doldurulmuş)? */
export function satirDoluMu(r: UretimSatirInput): boolean {
  return r.parcaKodu.trim() !== "" || r.hedefAdet.trim() !== ""
}

/**
 * Geçerli satır: parça kodu dolu + hedefAdet >= 0 (0 KASITLI hedef — "üretim beklenmiyor").
 * DİKKAT: Number("") === 0 — boş alan kazara "geçerli 0" sayılmasın diye trim kontrolü ŞART.
 * Boş = "henüz girilmedi" (geçersiz), "0" = kasıtlı sıfır (geçerli).
 */
export function satirGecerliMi(r: UretimSatirInput): boolean {
  const s = r.hedefAdet.trim()
  if (s === "") return false
  const n = Number(s)
  return r.parcaKodu.trim() !== "" && Number.isFinite(n) && n >= 0
}

/**
 * Personelin üretim satırları geçerli mi?
 * - MESAI: en az 1 geçerli satır + kısmen doldurulmuş her satır geçerli olmalı.
 * - VARDIYA: satırlar opsiyonel; doldurulmuş her satır geçerli olmalı.
 */
export function personelSatirlariGecerli(rows: UretimSatirInput[], isVardiya: boolean): boolean {
  const doluSatirlarGecerli = rows.every((r) => !satirDoluMu(r) || satirGecerliMi(r))
  if (isVardiya) return doluSatirlarGecerli
  return doluSatirlarGecerli && rows.some(satirGecerliMi)
}

/** Submit için: yalnız geçerli satırları API şekline çevir. */
export function toApiUretimSatirlari(rows: UretimSatirInput[]): { parcaKodu: string; hedefAdet: number; sira: number }[] {
  return rows
    .filter(satirGecerliMi)
    .map((r, i) => ({ parcaKodu: r.parcaKodu.trim(), hedefAdet: Math.trunc(Number(r.hedefAdet)), sira: i + 1 }))
}

interface Props {
  rows: UretimSatirInput[]
  onChange: (rows: UretimSatirInput[]) => void
  isVardiya?: boolean
  disabled?: boolean
}

export default function UretimSatirlariEditor({ rows, onChange, isVardiya = false, disabled = false }: Props) {
  const label = isVardiya ? "Vardiya Sebebi" : "Mesai Nedeni"
  const rowsSafe = rows.length > 0 ? rows : [emptyUretimSatir()]

  function update(i: number, field: keyof UretimSatirInput, value: string) {
    onChange(rowsSafe.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }
  // Sayılamayan iş: işaretlenince hedef "0" ve kilitli; kaldırılınca alan boşalır (tekrar zorunlu).
  function toggleSayilamayan(i: number, checked: boolean) {
    onChange(rowsSafe.map((r, idx) => (idx === i ? { ...r, sayilamayan: checked, hedefAdet: checked ? "0" : "" } : r)))
  }
  function addRow() {
    onChange([...rowsSafe, emptyUretimSatir()])
  }
  function removeRow(i: number) {
    if (rowsSafe.length <= 1) return
    onChange(rowsSafe.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {/* Kolon başlıkları — "Mesai Nedeni" etiketi korunur */}
      <div className="flex gap-2 items-center">
        <div className="flex-1 text-xs font-medium text-gray-600">
          {label}
          {!isVardiya && <span className="text-red-500"> *</span>}
        </div>
        <div className="w-28 text-xs font-medium text-gray-600">
          Hedef Adet
          {!isVardiya && <span className="text-red-500"> *</span>}
        </div>
        <div className="w-24 text-xs font-medium text-gray-600" title="Ayar, birim sorumlusu, eğitim gibi adetle ölçülmeyen iş — KPI'ya girmez">
          Sayılamayan
        </div>
        <div className="w-9" />
      </div>

      {rowsSafe.map((row, i) => {
        const parcaBos = !row.parcaKodu.trim()
        const hedefNum = Number(row.hedefAdet)
        // 0 geçerli (kasıtlı "üretim beklenmiyor"); boş ve negatif geçersiz.
        const hedefGecersiz = row.hedefAdet.trim() === "" || !Number.isFinite(hedefNum) || hedefNum < 0
        // Hata gösterimi: satır kısmen doluysa (kullanıcı dokunmuş) her iki alanı da denetle;
        // MESAI'de 1. satır zorunlu → boşsa da işaretle.
        const dokunulmus = satirDoluMu(row)
        const mesaiIlkSatirZorunlu = !isVardiya && i === 0
        const showParcaErr = (dokunulmus || mesaiIlkSatirZorunlu) && parcaBos
        const showHedefErr = (dokunulmus || mesaiIlkSatirZorunlu) && hedefGecersiz
        return (
          <div key={i} className="space-y-1">
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                placeholder={isVardiya ? "Parça kodu / sebep (opsiyonel)" : "Parça kodu (zorunlu)"}
                value={row.parcaKodu}
                disabled={disabled}
                onChange={(e) => update(i, "parcaKodu", e.target.value)}
                className={showParcaErr ? "border-red-300 focus-visible:ring-red-400" : ""}
              />
            </div>
            <div className="w-28">
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Ör: 50"
                value={row.hedefAdet}
                disabled={disabled || !!row.sayilamayan}
                onChange={(e) => update(i, "hedefAdet", e.target.value)}
                className={showHedefErr ? "border-red-300 focus-visible:ring-red-400" : ""}
              />
            </div>
            <label className="w-24 flex items-center gap-1.5 h-10 text-xs text-gray-700 select-none">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!row.sayilamayan}
                disabled={disabled}
                onChange={(e) => toggleSayilamayan(i, e.target.checked)}
                aria-label="Sayılamayan iş"
              />
              Sayılamayan
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || rowsSafe.length <= 1}
              onClick={() => removeRow(i)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-10 w-9 px-0 shrink-0"
              aria-label="Satırı sil"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* Hedef uyarısı — engellemez; sayılamayan iş (kutucuk) işaretliyse sorulmaz */}
          <HedefUyari parcaKodu={row.parcaKodu} hedefAdet={row.hedefAdet} aktif={!disabled && !row.sayilamayan} />
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={addRow}
        className="h-8"
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> Parça Ekle
      </Button>

      {!isVardiya && !rowsSafe.some(satirGecerliMi) && (
        <p className="text-xs text-red-500">En az bir geçerli üretim satırı gerekli (parça kodu + hedef adet; sayılamayan iş için kutucuğu işaretleyin).</p>
      )}
    </div>
  )
}
