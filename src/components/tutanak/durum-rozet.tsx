'use client'

// IV-FR-03 tutanak durum rozeti — liste ve detay ekranlarının ortak gösterimi.
// FORM-SAYFA-STANDARDI: "Durum rozeti → modülün kendi durum-rozet bileşeni".
// Satır içi <span> + DURUM_RENK deseni dar kolonda "Şahit Onayı Bekliyor"u üç
// satıra yayıyordu; kabuk artık bolum-talep rozetiyle birebir aynı ve
// whitespace-nowrap ile tek satırda kalıyor.

import { DURUM_ETIKETLERI } from '@/lib/tutanak/tutanak-durum'
import type { TutanakDurum } from '@/generated/prisma'

const STIL: Record<TutanakDurum, string> = {
  TASLAK: 'bg-slate-100 text-slate-600 border-slate-200',
  SAHIT_BEKLIYOR: 'bg-amber-50 text-amber-700 border-amber-200',
  YONETICI_BEKLIYOR: 'bg-blue-50 text-blue-700 border-blue-200',
  IK_BEKLIYOR: 'bg-violet-50 text-violet-700 border-violet-200',
  TAMAMLANDI: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REDDEDILDI: 'bg-rose-50 text-rose-700 border-rose-200',
}

export function TutanakDurumRozet({ durum }: { durum: TutanakDurum }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${STIL[durum] ?? STIL.TASLAK}`}
    >
      {DURUM_ETIKETLERI[durum] ?? durum}
    </span>
  )
}
