'use client'

import { useEffect, useState } from 'react'

type LogItem = {
  id: string
  tarih: string
  islemTuru: string
  koliTipi: 'Ana' | 'Alt' | null
  kullanici: { id: string; name: string | null; email: string }
  detay: Record<string, unknown> | null
}

const ISLEM_LABEL: Record<string, string> = {
  Olustur: 'Oluşturuldu',
  Goruntule: 'Görüntülendi',
  Duzenle: 'Düzenlendi',
  Sil: 'Silindi',
  EtiketBas: 'Etiket Basıldı',
  QrTara: 'QR Tarandı',
  AltKoliEkle: 'Alt Koli Eklendi',
  AltKoliCikar: 'Alt Koli Çıkarıldı',
  ImhaTalep: 'İmha Talebi',
  ImhaOnayla: 'İmha Onaylandı',
  ImhaReddet: 'İmha Reddedildi',
  KoliAc: 'Koli Açıldı',
  TopluIceAktar: 'Toplu İçe Aktarım',
  RaporCikar: 'Rapor Çıkarıldı',
}

const ISLEM_COLOR: Record<string, string> = {
  Olustur: 'bg-emerald-500',
  Duzenle: 'bg-blue-500',
  Sil: 'bg-rose-500',
  AltKoliEkle: 'bg-emerald-400',
  AltKoliCikar: 'bg-rose-400',
  Goruntule: 'bg-slate-400',
  ImhaTalep: 'bg-amber-500',
  ImhaOnayla: 'bg-rose-600',
  ImhaReddet: 'bg-slate-500',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function summarizeDetay(islem: string, detay: Record<string, unknown> | null): string | null {
  if (!detay) return null
  if (islem === 'Duzenle' && detay.changes && typeof detay.changes === 'object') {
    const keys = Object.keys(detay.changes as object)
    if (keys.length > 0) return `Değişiklik: ${keys.join(', ')}`
  }
  if (islem === 'AltKoliEkle' && typeof detay.altArsivNo === 'string') {
    return detay.altArsivNo
  }
  if (islem === 'AltKoliCikar' && typeof detay.altArsivNo === 'string') {
    return detay.altArsivNo
  }
  return null
}

export default function AktiviteLogTimeline({
  koliId,
  refreshKey = 0,
}: {
  koliId: string
  refreshKey?: number
}) {
  const [items, setItems] = useState<LogItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/arsiv/aktivite?koliId=${koliId}&limit=50`, {
      credentials: 'include',
    })
      .then((r) => r.json().then((j) => ({ status: r.status, body: j })))
      .then(({ status, body }) => {
        if (cancelled) return
        if (status !== 200) {
          setError(body.error || `Hata: ${status}`)
          return
        }
        setItems(body.items)
      })
      .catch((e) => {
        if (!cancelled) setError(`Bağlantı: ${(e as Error).message}`)
      })
    return () => {
      cancelled = true
    }
  }, [koliId, refreshKey])

  if (error) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        {error}
      </div>
    )
  }

  if (items === null) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded border border-slate-200 bg-white p-3">
            <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse" />
            <div className="h-2.5 w-1/3 bg-slate-100 rounded mt-2 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500 text-sm">
        Henüz işlem geçmişi yok.
      </div>
    )
  }

  return (
    <ol className="space-y-2">
      {items.map((item) => {
        const label = ISLEM_LABEL[item.islemTuru] ?? item.islemTuru
        const dotColor = ISLEM_COLOR[item.islemTuru] ?? 'bg-slate-400'
        const summary = summarizeDetay(item.islemTuru, item.detay)
        return (
          <li
            key={item.id}
            className="rounded border border-slate-200 bg-white p-3 flex gap-3"
          >
            <span
              className={`mt-1 inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-900">{label}</span>
                <span className="text-xs text-slate-500">{formatDateTime(item.tarih)}</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 truncate">
                {item.kullanici.name ?? item.kullanici.email}
                {item.koliTipi && (
                  <span className="ml-2 text-slate-400">
                    ({item.koliTipi === 'Ana' ? 'Ana koli' : 'Alt koli'})
                  </span>
                )}
              </p>
              {summary && (
                <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">{summary}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
