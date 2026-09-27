import { AlertTriangle } from 'lucide-react'
import { TERMINAL_ACCENT } from '../_shared'
import type { ModulYardim } from './_yardim-icerik'

/** Modül yardımı gövdesi: Ne zaman? / Nasıl? (numaralı) / Dikkat. Rehber sayfası ve menü "?" paneli ortak kullanır. */
export function YardimGovde({ modul }: { modul: ModulYardim }) {
  return (
    <>
      <div className="flex flex-col gap-1 rounded-xl border bg-card p-3.5">
        <span className="text-xs font-semibold" style={{ color: TERMINAL_ACCENT }}>Ne zaman?</span>
        <span className="text-sm leading-snug">{modul.neZaman}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold" style={{ color: TERMINAL_ACCENT }}>Nasıl?</span>
        {modul.adimlar.map((a, i) => (
          <div key={i} className="flex gap-3 rounded-xl border bg-card p-3.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold"
              style={{ color: TERMINAL_ACCENT }}
            >
              {i + 1}
            </span>
            <span className="text-sm leading-snug">{a}</span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-sm leading-snug"><span className="font-semibold">Dikkat: </span>{modul.dikkat}</p>
      </div>
    </>
  )
}
