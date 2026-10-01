'use client'

import { useMemo, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FIF_DURUM_ETIKET, fifOlayEtiketi } from '@/lib/quality/fif-durum-etiket'

export type GecmisKaydi = {
  id: string
  createdAt: string
  userAd: string | null
  olay: string | null
  eskiDurum: string | null
  yeniDurum: string
  aciklama: string | null
  faaliyetId: string | null
  /** Bağlı faaliyetin sıra no'su (satır silindiyse null). */
  faaliyetSira: number | null
}

/**
 * FİF "Geçmiş" bölümü (Paket 3b-2): TÜM günlük kayıtları — durum geçişleri +
 * faaliyet olayları (kapatma, ek termin, etkinlik). Faaliyete göre filtre:
 * Tümü / FİF geneli (satıra bağlı olmayan) / #n.
 */
export function FifGecmisPanel({ kayitlar, faaliyetler }: {
  kayitlar: GecmisKaydi[]
  faaliyetler: { id: string; sira: number }[]
}) {
  const [filtre, setFiltre] = useState('tumu')
  const gorunen = useMemo(() => kayitlar.filter((k) =>
    filtre === 'tumu' ? true : filtre === 'genel' ? !k.faaliyetId : k.faaliyetId === filtre,
  ), [kayitlar, filtre])

  return (
    <div className="rounded-md border bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#1B4F72] uppercase tracking-wide">Geçmiş ({kayitlar.length})</h3>
        <div className="w-56">
          <Select value={filtre} onValueChange={setFiltre}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tumu">Tüm kayıtlar</SelectItem>
              <SelectItem value="genel">FİF geneli</SelectItem>
              {faaliyetler.map((f) => <SelectItem key={f.id} value={f.id}>Faaliyet #{f.sira}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {gorunen.length === 0 ? (
        <p className="text-xs text-slate-400">Kayıt yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left py-1 pr-3 font-medium">Ne zaman</th>
                <th className="text-left py-1 pr-3 font-medium">Kim</th>
                <th className="text-left py-1 pr-3 font-medium">Olay</th>
                <th className="text-left py-1 pr-3 font-medium">Satır</th>
                <th className="text-left py-1 font-medium">Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {gorunen.map((k) => {
                const durumDegisti = k.eskiDurum !== k.yeniDurum
                return (
                  <tr key={k.id} className="border-t align-top">
                    <td className="py-1 pr-3 whitespace-nowrap text-slate-500">{new Date(k.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</td>
                    <td className="py-1 pr-3 whitespace-nowrap">{k.userAd ?? '—'}</td>
                    <td className="py-1 pr-3">
                      <div className="font-medium">{fifOlayEtiketi(k)}</div>
                      {durumDegisti && (
                        <div className="text-slate-500">
                          {k.eskiDurum ? `${FIF_DURUM_ETIKET[k.eskiDurum] ?? k.eskiDurum} → ` : ''}{FIF_DURUM_ETIKET[k.yeniDurum] ?? k.yeniDurum}
                        </div>
                      )}
                    </td>
                    <td className="py-1 pr-3 whitespace-nowrap">{k.faaliyetSira != null ? `#${k.faaliyetSira}` : k.faaliyetId ? '(silinmiş)' : '—'}</td>
                    <td className="py-1 text-slate-600">{k.aciklama ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
