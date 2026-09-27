'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Gun = { gun: string; durum: string; ilkGiris: string | null; sonCikis: string | null; gecDakika: number; erkenCikisDakika: number; calismaDakika: number | null; formla: boolean }
type Veri =
  | { bagli: false }
  | {
      bagli: true
      kart: string | null
      bugun: { gun: string; durum: string; ilkGiris: string | null; sonCikis: string | null; gecDakika: number; beklenenBaslangic: string | null; beklenenBitis: string | null; uyarilar: string[] } | null
      bugunOlaylar: { zaman: string; yon: 'GIRIS' | 'CIKIS' | null; tip: string }[]
      gunler: Gun[]
    }

const saat = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }) : '—')
const gunAdi = (g: string) => new Date(`${g}T12:00:00Z`).toLocaleDateString('tr-TR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const sure = (dk: number | null) => (dk === null ? '' : `${Math.floor(dk / 60)} sa ${String(dk % 60).padStart(2, '0')} dk`)
const ETIKET: Record<string, { t: string; c: string }> = {
  TAM: { t: 'Tam', c: 'border-blue-200 bg-blue-50 text-blue-800' },
  TAM_FORMLA: { t: 'Tam (formla)', c: 'border-blue-200 bg-white text-blue-800' },
  MESAI: { t: 'Mesai', c: 'border-blue-300 bg-blue-100 text-blue-900' },
  EKSIK_GIRIS: { t: 'Eksik giriş', c: 'border-amber-300 bg-amber-50 text-amber-900' },
  EKSIK_CIKIS: { t: 'Eksik çıkış', c: 'border-amber-300 bg-amber-50 text-amber-900' },
  GELMEDI: { t: 'Kayıt yok', c: 'border-slate-300 bg-slate-100 text-slate-700' },
  TATIL: { t: 'Tatil', c: 'border-slate-200 text-slate-500' },
  HAFTA_SONU: { t: 'Hafta sonu', c: 'border-slate-200 text-slate-500' },
  BEKLENMIYOR: { t: '—', c: 'border-slate-200 text-slate-400' },
}

export function GecislerimClient() {
  const [v, setV] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  useEffect(() => {
    void (async () => {
      const r = await fetch('/api/pdks/gecislerim', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.ok === false) return setHata(d.error ?? 'Geçişler alınamadı')
      setV(d)
    })()
  }, [])

  if (hata) return <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{hata}</p>
  if (!v) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
  if (!v.bagli) return <p className="rounded-lg border p-4 text-sm text-slate-600">Hesabınız bir personel kaydına bağlı değil. İnsan Varlıkları ile görüşün.</p>
  const b = v.bugun
  const eksik = (d: string) => d === 'EKSIK_GIRIS' || d === 'EKSIK_CIKIS' || d === 'GELMEDI'

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="text-xs text-slate-500">Bugün{v.kart && <> · kart {v.kart}</>}</div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1 text-xs text-slate-500"><ArrowDownLeft className="h-3.5 w-3.5 text-blue-600" /> İlk giriş</div>
            <div className="text-3xl font-semibold tabular-nums">{saat(b?.ilkGiris ?? null)}</div>
            {b && b.gecDakika > 0 && <div className="text-xs font-medium text-amber-800">{b.gecDakika} dk geç</div>}
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-slate-500"><ArrowUpRight className="h-3.5 w-3.5 text-slate-500" /> Son çıkış</div>
            <div className="text-3xl font-semibold tabular-nums">{saat(b?.sonCikis ?? null)}</div>
          </div>
        </div>
        {b?.beklenenBaslangic && <div className="mt-2 text-xs text-slate-500">Vardiya {saat(b.beklenenBaslangic)}–{saat(b.beklenenBitis)}</div>}
        {v.bugunOlaylar.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {v.bugunOlaylar.map((o, i) => (
              <span key={i} className={cn('rounded-full border px-2 py-0.5 text-xs', o.tip === 'GECERLI_KART' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-300 bg-amber-50 text-amber-900')}>
                {saat(o.zaman)} {o.yon === 'GIRIS' ? 'giriş' : o.yon === 'CIKIS' ? 'çıkış' : ''}{o.tip !== 'GECERLI_KART' && ' · geçersiz'}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-2 text-sm font-medium text-slate-700">Son 7 gün</div>
        <ul className="divide-y">
          {v.gunler.map((g) => (
            <li key={g.gun} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{gunAdi(g.gun)}</span>
                <span className={cn('rounded-full border px-2 py-0.5 text-xs', (ETIKET[g.durum] ?? ETIKET.BEKLENMIYOR).c)}>{(ETIKET[g.durum] ?? ETIKET.BEKLENMIYOR).t}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-xs text-slate-500">
                <span className="tabular-nums">{saat(g.ilkGiris)} – {saat(g.sonCikis)}{g.gecDakika > 0 && <span className="ml-1 text-amber-800">· {g.gecDakika} dk geç</span>}</span>
                <span>{sure(g.calismaDakika)}</span>
              </div>
              {eksik(g.durum) && (
                <Link href="/forms/toplu-kart-okutamama" className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#1B4F72] py-2 text-sm font-medium text-[#1B4F72] active:bg-blue-50">
                  <FileText className="h-4 w-4" /> Kart okutamama formu doldur
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="px-1 text-xs text-slate-500">Yalnız kendi kayıtlarınızı görürsünüz. Onaylanan kart okutamama formu eksik saati tamamlar.</p>
    </div>
  )
}
