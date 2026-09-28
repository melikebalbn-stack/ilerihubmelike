'use client'

// Bölüm değişikliği talebi durum rozeti — iki ekranın ortak gösterimi.

const STIL: Record<string, string> = {
  BEKLIYOR: 'bg-amber-50 text-amber-700 border-amber-200',
  ONAYLANDI: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REDDEDILDI: 'bg-rose-50 text-rose-700 border-rose-200',
  IPTAL: 'bg-slate-100 text-slate-600 border-slate-200',
}

export const DURUM_ETIKET: Record<string, string> = {
  BEKLIYOR: 'İnsan Varlıkları onayında',
  ONAYLANDI: 'Onaylandı',
  REDDEDILDI: 'Reddedildi',
  IPTAL: 'Geri çekildi',
}

export function TalepDurumRozet({ durum }: { durum: string }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${STIL[durum] ?? STIL.IPTAL}`}>
      {DURUM_ETIKET[durum] ?? durum}
    </span>
  )
}
