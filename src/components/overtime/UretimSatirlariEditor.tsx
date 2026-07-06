"use client"

// Faz 2 — personel kartında çoklu üretim satırı editörü (create + edit ortak).
// Her satır: "Mesai Nedeni"/"Vardiya Sebebi" = parça kodu (text) + "Hedef Adet" (number).
// Faz 1 API sözleşmesi: submit'te uretimSatirlari: [{ parcaKodu, hedefAdet }].

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"

export interface UretimSatirInput {
  parcaKodu: string
  hedefAdet: string // string state; submit sırasında Number'a çevrilir
}

export function emptyUretimSatir(): UretimSatirInput {
  return { parcaKodu: "", hedefAdet: "" }
}

/** Bir satır dolu mu (herhangi bir alanı doldurulmuş)? */
export function satirDoluMu(r: UretimSatirInput): boolean {
  return r.parcaKodu.trim() !== "" || r.hedefAdet.trim() !== ""
}

/** Geçerli satır: parça kodu dolu + hedefAdet > 0. */
export function satirGecerliMi(r: UretimSatirInput): boolean {
  const n = Number(r.hedefAdet)
  return r.parcaKodu.trim() !== "" && Number.isFinite(n) && n > 0
}

/**
 * Personelin üretim satırları geçerli mi?
 * - MESAI: en az 1 geçerli satır + kısmen doldurulmuş her satır geçerli olmalı.
 * - VARDIYA: satırlar opsiyonel; doldurulmuş her satır geçerli olmalı (0 geçerli OK).
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
        <div className="w-9" />
      </div>

      {rowsSafe.map((row, i) => {
        const parcaBos = !row.parcaKodu.trim()
        const hedefNum = Number(row.hedefAdet)
        const hedefGecersiz = row.hedefAdet.trim() === "" || !Number.isFinite(hedefNum) || hedefNum <= 0
        // Hata gösterimi: satır kısmen doluysa (kullanıcı dokunmuş) her iki alanı da denetle;
        // MESAI'de 1. satır zorunlu → boşsa da işaretle.
        const dokunulmus = satirDoluMu(row)
        const mesaiIlkSatirZorunlu = !isVardiya && i === 0
        const showParcaErr = (dokunulmus || mesaiIlkSatirZorunlu) && parcaBos
        const showHedefErr = (dokunulmus || mesaiIlkSatirZorunlu) && hedefGecersiz
        return (
          <div key={i} className="flex gap-2 items-start">
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
                min="1"
                placeholder="Ör: 50"
                value={row.hedefAdet}
                disabled={disabled}
                onChange={(e) => update(i, "hedefAdet", e.target.value)}
                className={showHedefErr ? "border-red-300 focus-visible:ring-red-400" : ""}
              />
            </div>
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
        <p className="text-xs text-red-500">En az bir geçerli üretim satırı gerekli (parça kodu + hedef adet &gt; 0).</p>
      )}
    </div>
  )
}
