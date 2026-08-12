'use client'

// PR-JOBAPP-RENDERER: Tek tarih input'u. ISO YYYY-MM-DD format.
//
// 2026-08: native `<input type="date">` yerine DateField'a delege edildi — maskeli
// GG.AA.YYYY metin girişi + yıl/ay AÇILIR LİSTELİ takvim (doğum tarihi gibi uzak
// tarihlerde aydan aya tıklatmak yerine yıl doğrudan seçilir).
// SÖZLEŞME DEĞİŞMEDİ: value/onChange hâlâ ISO `YYYY-MM-DD` (veya boş string);
// min/max/disabled aynen geçer. Bu bileşeni YALNIZ iş başvuru formu kullanır.

import { DateField } from '@/components/ui/date-field'

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  min?: string
  max?: string
  /** Değer yokken takvimin açılacağı yıl (ör. doğum tarihinde bugünden uzak bir yıl). */
  acilisYili?: number
}

export function FormDateInput({ value, onChange, disabled, min, max, acilisYili }: Props) {
  return (
    <DateField
      value={value}
      onChange={onChange}
      disabled={disabled}
      min={min}
      max={max}
      acilisYili={acilisYili}
    />
  )
}
