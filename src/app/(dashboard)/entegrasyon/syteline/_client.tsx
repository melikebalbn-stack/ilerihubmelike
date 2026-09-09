'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Play, FlaskConical, RotateCcw, Loader2 } from 'lucide-react'

export type SyteKayitRow = {
  id: string
  kaynakAnahtar: string
  durum: string
  hata: string | null
  denemeSayisi: number
  updatedAt: string
}
export type SyteDurumBilgi = {
  sonCalismaAt: string | null
  sonRecordDate: string | null
  calisiyorAt: string | null
  sonOzet: Record<string, number> | null
}

const DURUMLAR = ['HEPSI', 'BEKLIYOR', 'YAZILDI', 'HATA', 'ATLANDI'] as const
const rozet: Record<string, string> = {
  BEKLIYOR: 'bg-amber-100 text-amber-700',
  YAZILDI: 'bg-emerald-100 text-emerald-700',
  HATA: 'bg-red-100 text-red-700',
  ATLANDI: 'bg-slate-100 text-slate-500',
}
const trTarih = (iso: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—')

export function SytelineClient({
  sayac,
  durum,
  kayitlar,
}: {
  sayac: Record<string, number>
  durum: SyteDurumBilgi
  kayitlar: SyteKayitRow[]
}) {
  const router = useRouter()
  const [filtre, setFiltre] = useState<(typeof DURUMLAR)[number]>('HEPSI')
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [calisiyor, setCalisiyor] = useState<null | 'dry' | 'real' | string>(null)
  const [batch, setBatch] = useState('') // boş = SYTE_SYNC_BATCH env varsayılanı

  const gorunen = filtre === 'HEPSI' ? kayitlar : kayitlar.filter((k) => k.durum === filtre)

  async function calistir(dryRun: boolean) {
    setCalisiyor(dryRun ? 'dry' : 'real')
    setMesaj(null)
    try {
      const bN = Number.parseInt(batch, 10)
      const batchVal = Number.isInteger(bN) && bN >= 1 && bN <= 500 ? bN : undefined
      const r = await fetch('/api/entegrasyon/syteline/calistir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, batch: batchVal }),
      })
      const d = await r.json().catch(() => null)
      if (r.ok) {
        if (dryRun) {
          const dag = d?.hataDagilimi ?? {}
          const ilk = Object.entries(dag)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 3)
            .map(([k, n]) => `${k} (${n})`)
            .join(' · ')
          setMesaj(
            `Dry-run bitti — okunan ${d?.okunan ?? 0}, uygun ${d?.uygun ?? 0}, hatalı ${d?.hataliSatir ?? 0}` +
              (ilk ? ` · en sık: ${ilk}` : '') +
              ' (DB’ye yazılmadı)',
          )
        } else {
          setMesaj(
            `Çalışma bitti — okunan ${d?.okunan ?? 0}, yazılan ${d?.yazilan ?? 0}, ` +
              `bekleyen ${d?.bekleyen ?? 0}, hata ${d?.hata ?? 0}, atlanan ${d?.atlanan ?? 0}`,
          )
          router.refresh()
        }
      } else setMesaj(`Hata: ${d?.error ?? r.status}`)
    } catch {
      setMesaj('Bağlantı hatası')
    } finally {
      setCalisiyor(null)
    }
  }

  async function yenidenDene(id: string) {
    setCalisiyor(id)
    setMesaj(null)
    try {
      const r = await fetch('/api/entegrasyon/syteline/yeniden-dene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (r.ok) {
        setMesaj('Kayıt yeniden denemeye alındı (BEKLIYOR).')
        router.refresh()
      } else {
        const d = await r.json().catch(() => null)
        setMesaj(`Hata: ${d?.error ?? r.status}`)
      }
    } catch {
      setMesaj('Bağlantı hatası')
    } finally {
      setCalisiyor(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Syteline → IFS Malzeme Senkronu</h1>
          <p className="text-sm text-slate-500">
            Son çalışma: {trTarih(durum.sonCalismaAt)}
            {durum.calisiyorAt ? ' · ⏳ şu an çalışıyor' : ''} · Watermark: {trTarih(durum.sonRecordDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => calistir(true)} disabled={calisiyor !== null} className="gap-2">
            {calisiyor === 'dry' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Dry-run çalıştır
          </Button>
          <input
            type="number"
            min={1}
            max={500}
            inputMode="numeric"
            value={batch}
            onChange={(e) => setBatch(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="batch"
            title="Bu çalışmada IFS'e yazılacak azami kayıt (1-500). Boş = varsayılan."
            className="h-9 w-20 rounded-lg border px-2 text-sm"
          />
          <Button onClick={() => calistir(false)} disabled={calisiyor !== null} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            {calisiyor === 'real' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Şimdi çalıştır
          </Button>
        </div>
      </div>

      {mesaj && <div className="rounded-lg border bg-slate-50 px-4 py-2 text-sm text-slate-700">{mesaj}</div>}

      {/* Durum sayaçları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['BEKLIYOR', 'YAZILDI', 'HATA', 'ATLANDI'] as const).map((d) => (
          <div key={d} className="rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{sayac[d] ?? 0}</div>
            <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${rozet[d]}`}>{d}</div>
          </div>
        ))}
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap gap-2">
        {DURUMLAR.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFiltre(d)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filtre === d ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {d}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-slate-400">son 200 kayıt · {gorunen.length} gösteriliyor</span>
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Kaynak (item)</th>
              <th className="px-3 py-2 text-left">Durum</th>
              <th className="px-3 py-2 text-left">Hata</th>
              <th className="px-3 py-2 text-right">Deneme</th>
              <th className="px-3 py-2 text-left">Güncelleme</th>
              <th className="px-3 py-2 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {gorunen.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">Kayıt yok.</td>
              </tr>
            ) : (
              gorunen.map((k) => (
                <tr key={k.id} className="border-t">
                  <td className="px-3 py-2 font-medium text-slate-800">{k.kaynakAnahtar}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${rozet[k.durum] ?? 'bg-slate-100 text-slate-500'}`}>
                      {k.durum}
                    </span>
                  </td>
                  <td className="max-w-[360px] truncate px-3 py-2 text-red-600" title={k.hata ?? undefined}>{k.hata ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.denemeSayisi}</td>
                  <td className="px-3 py-2 text-slate-500">{trTarih(k.updatedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {k.durum === 'HATA' && (
                      <button
                        type="button"
                        onClick={() => yenidenDene(k.id)}
                        disabled={calisiyor !== null}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {calisiyor === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        Yeniden dene
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
