'use client'

import { useMemo } from 'react'
import { AY_ISIMLERI, DURUM_META } from './constants'
import { getKayitTarihi, type YillikTakvimKaydiRow } from './types'

export function AylikTakvim({ rows, yil }: { rows: YillikTakvimKaydiRow[]; yil: number }) {
  const aylaraGore = useMemo(() => Array.from({ length: 12 }, (_, ay) => rows.filter(row => {
    const value = getKayitTarihi(row)
    return value?.getFullYear() === yil && value.getMonth() === ay
  })), [rows, yil])
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {AY_ISIMLERI.map((ay, index) => <section key={ay} className="min-h-36 rounded-lg border p-3">
        <h3 className="mb-2 font-semibold text-[#1B4F72]">{ay}</h3>
        <div className="space-y-2">
          {aylaraGore[index].length === 0 && <p className="text-xs text-muted-foreground">Kayıt yok</p>}
          {aylaraGore[index].map(row => <div key={row.id} className="flex gap-2 text-sm">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DURUM_META[row.durum].dot}`} />
            <span><strong>{getKayitTarihi(row)?.getDate()}:</strong> {row.kisaBaslik || row.surec}</span>
          </div>)}
        </div>
      </section>)}
    </div>
  )
}
