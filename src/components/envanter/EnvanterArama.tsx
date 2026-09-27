'use client'

import { Search } from 'lucide-react'

/**
 * IV / Envanter — modülün TEK arama kutusu deseni. Ürün Yönetimi sekmesindeki
 * kutunun (page.tsx) görünümü buraya çıkarıldı; diğer sekmeler de aynısını
 * kullanır (27.09.2026). Süzme her sekmede KENDİ listesinin alanları üzerinde
 * yapılır — ortak bir "her şeyi ara" ucu YOK.
 */
export function EnvanterArama({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (deger: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </div>
  )
}

/**
 * Serbest metin eşleşmesi — TR yerel küçük harf (İ/ı tuzağı: düz toLowerCase()
 * "İŞ" → "i̇ş" üretip "iş" aramasını kaçırıyordu). Alanlardaki null/undefined
 * atlanır; sorgu boşsa DAİMA true (süzgeç kapalı demektir).
 */
export function envanterAramaEslesir(sorgu: string, alanlar: (string | null | undefined | number)[]): boolean {
  const q = sorgu.trim().toLocaleLowerCase('tr')
  if (!q) return true
  return alanlar
    .filter((a) => a !== null && a !== undefined)
    .map((a) => String(a))
    .join(' ')
    .toLocaleLowerCase('tr')
    .includes(q)
}
