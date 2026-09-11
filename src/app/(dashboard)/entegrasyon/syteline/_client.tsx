'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Play, FlaskConical, RotateCcw, Loader2, Search, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

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
export type SyteEslemeRow = {
  id: string
  entity: string
  tip: string
  kaynakDeger: string
  hedefDeger: string
  aktif: boolean
  not: string | null
}
type Entity = 'MALZEME' | 'IS_EMRI'

// Kuyruk filtre butonları — Tümü / BEKLIYOR / YAZILDI / HATA (ATLANDI yok).
const FILTRELER = [
  { key: '', label: 'Tümü' },
  { key: 'BEKLIYOR', label: 'BEKLIYOR' },
  { key: 'YAZILDI', label: 'YAZILDI' },
  { key: 'HATA', label: 'HATA' },
] as const
const SAYFA = 50
const rozet: Record<string, string> = {
  BEKLIYOR: 'bg-amber-100 text-amber-700',
  YAZILDI: 'bg-emerald-100 text-emerald-700',
  HATA: 'bg-red-100 text-red-700',
  ATLANDI: 'bg-slate-100 text-slate-500',
}
const katRozet: Record<string, string> = {
  IFS_TEMEL_VERI: 'bg-sky-100 text-sky-700',
  SYTELINE_VERI: 'bg-amber-100 text-amber-700',
  HUB_ESLEME: 'bg-violet-100 text-violet-700',
}
// Eşleme tipleri + eşleme/kuyruk yardımcı metinleri entity'ye göre.
const ENTITY_CONFIG: Record<Entity, {
  tipler: readonly string[]
  eslemePlaceholder: { kaynak: string; hedef: string }
  kaynakBaslik: string
  aramaPlaceholder: string
  eksikMetin: string
}> = {
  MALZEME: {
    tipler: ['BIRIM', 'URUN_KODU', 'MUHASEBE_GRUBU'],
    eslemePlaceholder: { kaynak: 'ör. LT / 9999', hedef: 'ör. l / 153' },
    kaynakBaslik: 'Kaynak (item)',
    aramaPlaceholder: 'item ara…',
    eksikMetin: 'tüm aktif Syteline malzemeleri mapper’dan geçirilip (DB’ye yazmadan) hata dağılımı çıkarılır.',
  },
  IS_EMRI: {
    tipler: ['TEZGAH'],
    eslemePlaceholder: { kaynak: 'Syteline RESID (ör. KM01)', hedef: 'IFS ResourceId (ör. LZ01)' },
    kaynakBaslik: 'Kaynak (job)',
    aramaPlaceholder: 'job ara…',
    eksikMetin: 'tüm serbest Syteline iş emirleri mapper’dan geçirilip (DB’ye yazmadan) hata dağılımı çıkarılır.',
  },
}
const trTarih = (iso: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—')

const ENTITY_SEKME = [
  { key: 'MALZEME', label: 'Malzeme', hazir: true },
  { key: 'IS_EMRI', label: 'İş Emri', hazir: true },
  { key: 'MUSTERI', label: 'Müşteri', hazir: false },
] as const

export type SytelineClientProps = {
  sayac: Record<Entity, Record<string, number>>
  durum: Record<Entity, SyteDurumBilgi>
  eslemeler: Record<Entity, SyteEslemeRow[]>
}

export function SytelineClient(props: SytelineClientProps) {
  const [entity, setEntity] = useState<(typeof ENTITY_SEKME)[number]['key']>('MALZEME')
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <h1 className="text-xl font-bold text-slate-800">Syteline → IFS Entegrasyonu</h1>
      {/* Entity sekmeleri */}
      <div className="flex gap-2 border-b">
        {ENTITY_SEKME.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => s.hazir && setEntity(s.key)}
            disabled={!s.hazir}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              entity === s.key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'
            } ${s.hazir ? 'hover:text-slate-800' : 'cursor-not-allowed opacity-50'}`}
          >
            {s.label}
            {!s.hazir && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-400">yakında</span>}
          </button>
        ))}
      </div>

      {entity === 'MALZEME' || entity === 'IS_EMRI' ? (
        <SekmeIcerik
          entity={entity}
          sayac={props.sayac[entity] ?? {}}
          durum={props.durum[entity]}
          eslemeler={props.eslemeler[entity] ?? []}
        />
      ) : (
        <div className="rounded-xl border bg-slate-50 p-10 text-center text-slate-400">
          Bu entity yakında — henüz senkron tanımlı değil.
        </div>
      )}
    </div>
  )
}

function SekmeIcerik({
  entity,
  sayac,
  durum,
  eslemeler,
}: {
  entity: Entity
  sayac: Record<string, number>
  durum: SyteDurumBilgi
  eslemeler: SyteEslemeRow[]
}) {
  const router = useRouter()
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [calisiyor, setCalisiyor] = useState<null | 'dry' | 'real'>(null)
  const [batch, setBatch] = useState('')
  const [kuyrukYenile, setKuyrukYenile] = useState(0)

  async function calistir(dryRun: boolean) {
    setCalisiyor(dryRun ? 'dry' : 'real')
    setMesaj(null)
    try {
      const bN = Number.parseInt(batch, 10)
      const batchVal = Number.isInteger(bN) && bN >= 1 && bN <= 500 ? bN : undefined
      const r = await fetch('/api/entegrasyon/syteline/calistir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, batch: batchVal, entity }),
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
          setKuyrukYenile((n) => n + 1)
        }
      } else setMesaj(`Hata: ${d?.error ?? r.status}`)
    } catch {
      setMesaj('Bağlantı hatası')
    } finally {
      setCalisiyor(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Son çalışma: {trTarih(durum?.sonCalismaAt ?? null)}
          {durum?.calisiyorAt ? ' · ⏳ şu an çalışıyor' : ''} · Watermark: {trTarih(durum?.sonRecordDate ?? null)}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => calistir(true)} disabled={calisiyor !== null} className="gap-2">
            {calisiyor === 'dry' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Dry-run
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

      <EksiklerKart entity={entity} />
      <EslemelerKart entity={entity} eslemeler={eslemeler} />
      <KuyrukKart entity={entity} sayac={sayac} disYenile={kuyrukYenile} />
    </div>
  )
}

// Kuyruk kartı — server-side filtre (durum + kaynakAnahtar araması) + 50'şer sayfalama.
// Varsayılan görünüm HATA; uzun listeyi baştan yüklemez. disYenile artınca sorguyu yeniden çeker.
function KuyrukKart({ entity, sayac, disYenile }: { entity: Entity; sayac: Record<string, number>; disYenile: number }) {
  const router = useRouter()
  const cfg = ENTITY_CONFIG[entity]
  const [durum, setDurum] = useState<string>('HATA')
  const [qGirdi, setQGirdi] = useState('')
  const [q, setQ] = useState('')
  const [skip, setSkip] = useState(0)
  const [rows, setRows] = useState<SyteKayitRow[]>([])
  const [toplam, setToplam] = useState(0)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [deneniyor, setDeneniyor] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const p = new URLSearchParams({ entity, durum, q, skip: String(skip), take: String(SAYFA) })
      const r = await fetch(`/api/entegrasyon/syteline/kuyruk?${p}`, { cache: 'no-store' })
      const d = await r.json().catch(() => null)
      if (r.ok) {
        setRows(d?.rows ?? [])
        setToplam(d?.toplam ?? 0)
      } else setHata(d?.error ?? `Hata ${r.status}`)
    } catch {
      setHata('Bağlantı hatası')
    } finally {
      setYukleniyor(false)
    }
  }, [entity, durum, q, skip])

  useEffect(() => {
    void yukle()
  }, [yukle, disYenile])

  async function yenidenDene(id: string) {
    setDeneniyor(id)
    setHata(null)
    try {
      const r = await fetch('/api/entegrasyon/syteline/yeniden-dene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (r.ok) {
        router.refresh()
        await yukle()
      } else {
        const d = await r.json().catch(() => null)
        setHata(`Hata: ${d?.error ?? r.status}`)
      }
    } catch {
      setHata('Bağlantı hatası')
    } finally {
      setDeneniyor(null)
    }
  }

  const sayfaBas = toplam === 0 ? 0 : skip + 1
  const sayfaSon = Math.min(skip + SAYFA, toplam)

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Kuyruk</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['BEKLIYOR', 'YAZILDI', 'HATA', 'ATLANDI'] as const).map((d) => (
          <div key={d} className="rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{sayac[d] ?? 0}</div>
            <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${rozet[d]}`}>{d}</div>
          </div>
        ))}
      </div>

      {/* Filtre: durum butonları + kaynakAnahtar arama */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTRELER.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setDurum(f.key)
              setSkip(0)
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${durum === f.key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {f.label}
          </button>
        ))}
        <form
          className="ml-auto flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            setSkip(0)
            setQ(qGirdi.trim())
          }}
        >
          <input
            value={qGirdi}
            onChange={(e) => setQGirdi(e.target.value)}
            placeholder={cfg.aramaPlaceholder}
            className="h-8 w-40 rounded-lg border px-2 text-sm"
          />
          <button type="submit" className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs text-slate-600 hover:bg-slate-50">
            <Search className="h-3.5 w-3.5" /> Ara
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">{cfg.kaynakBaslik}</th>
              <th className="px-3 py-2 text-left">Durum</th>
              <th className="px-3 py-2 text-left">Hata</th>
              <th className="px-3 py-2 text-right">Deneme</th>
              <th className="px-3 py-2 text-left">Güncelleme</th>
              <th className="px-3 py-2 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {yukleniyor ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">Kayıt yok.</td>
              </tr>
            ) : (
              rows.map((k) => (
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
                        disabled={deneniyor !== null}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {deneniyor === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
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

      {/* Sayfalama */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{hata ? <span className="text-red-600">{hata}</span> : `${toplam} kayıt · ${sayfaBas}–${sayfaSon}`}</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setSkip((s) => Math.max(0, s - SAYFA))}
            disabled={skip === 0 || yukleniyor}
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Önceki
          </button>
          <button
            type="button"
            onClick={() => setSkip((s) => s + SAYFA)}
            disabled={sayfaSon >= toplam || yukleniyor}
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
          >
            Sonraki <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

type EksikSebep = { sebep: string; adet: number; kategori: string; ornekler: string[] }

function EksiklerKart({ entity }: { entity: Entity }) {
  const [yukleniyor, setYukleniyor] = useState(false)
  const [okunan, setOkunan] = useState<number | null>(null)
  const [sebepler, setSebepler] = useState<EksikSebep[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  async function analiz() {
    setYukleniyor(true)
    setHata(null)
    try {
      const r = await fetch(`/api/entegrasyon/syteline/eksikler?entity=${entity}`, { cache: 'no-store' })
      const d = await r.json().catch(() => null)
      if (r.ok) {
        setOkunan(d?.okunan ?? 0)
        setSebepler(d?.sebepler ?? [])
      } else setHata(d?.error ?? `Hata ${r.status}`)
    } catch {
      setHata('Bağlantı hatası')
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Eksikler analizi</h2>
        <Button variant="outline" size="sm" onClick={analiz} disabled={yukleniyor} className="gap-2">
          {yukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Analiz et
        </Button>
      </div>
      {hata && <p className="text-sm text-red-600">{hata}</p>}
      {sebepler == null ? (
        <p className="text-sm text-slate-400">“Analiz et” — {ENTITY_CONFIG[entity].eksikMetin}</p>
      ) : sebepler.length === 0 ? (
        <p className="text-sm text-emerald-600">Eksik yok — {okunan} satırın tümü eşlenebiliyor. ✅</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-500">{okunan} satır tarandı · {sebepler.length} farklı sebep</p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Sebep</th>
                  <th className="px-3 py-2 text-right">Adet</th>
                  <th className="px-3 py-2 text-left">Kategori</th>
                  <th className="px-3 py-2 text-left">Örnekler (ilk 5)</th>
                </tr>
              </thead>
              <tbody>
                {sebepler.map((s) => (
                  <tr key={s.sebep} className="border-t">
                    <td className="px-3 py-2 font-medium text-slate-800">{s.sebep}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.adet}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${katRozet[s.kategori] ?? 'bg-slate-100 text-slate-500'}`}>
                        {s.kategori}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{s.ornekler.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function EslemelerKart({ entity, eslemeler }: { entity: Entity; eslemeler: SyteEslemeRow[] }) {
  const router = useRouter()
  const cfg = ENTITY_CONFIG[entity]
  const [tip, setTip] = useState<string>(cfg.tipler[0])
  const [kaynak, setKaynak] = useState('')
  const [hedef, setHedef] = useState('')
  const [bekliyor, setBekliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const liste = eslemeler.filter((e) => e.tip === tip)

  async function ekle() {
    if (!kaynak.trim() || !hedef.trim()) return
    setBekliyor(true)
    setHata(null)
    try {
      const r = await fetch('/api/entegrasyon/syteline/esleme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, tip, kaynakDeger: kaynak.trim(), hedefDeger: hedef.trim() }),
      })
      if (r.ok) {
        setKaynak('')
        setHedef('')
        router.refresh()
      } else {
        const d = await r.json().catch(() => null)
        setHata(d?.error ?? `Hata ${r.status}`)
      }
    } catch {
      setHata('Bağlantı hatası')
    } finally {
      setBekliyor(false)
    }
  }

  async function sil(id: string) {
    setBekliyor(true)
    setHata(null)
    try {
      const r = await fetch('/api/entegrasyon/syteline/esleme', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (r.ok) router.refresh()
      else {
        const d = await r.json().catch(() => null)
        setHata(d?.error ?? `Hata ${r.status}`)
      }
    } catch {
      setHata('Bağlantı hatası')
    } finally {
      setBekliyor(false)
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Eşlemeler (Syteline → IFS)</h2>
      <div className="mb-3 flex gap-2">
        {cfg.tipler.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTip(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${tip === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {hata && <p className="mb-2 text-sm text-red-600">{hata}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Kaynak (Syteline)</th>
              <th className="px-3 py-2 text-left">Hedef (IFS)</th>
              <th className="px-3 py-2 text-left">Not</th>
              <th className="px-3 py-2 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-400">Bu tipte eşleme yok.</td>
              </tr>
            ) : (
              liste.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 font-medium text-slate-800">{e.kaynakDeger}</td>
                  <td className="px-3 py-2">{e.hedefDeger}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{e.not ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => sil(e.id)}
                      disabled={bekliyor}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Sil
                    </button>
                  </td>
                </tr>
              ))
            )}
            {/* Ekleme satırı */}
            <tr className="border-t bg-slate-50/60">
              <td className="px-3 py-2">
                <input value={kaynak} onChange={(e) => setKaynak(e.target.value)} placeholder={cfg.eslemePlaceholder.kaynak} className="h-8 w-full rounded border px-2 text-sm" />
              </td>
              <td className="px-3 py-2">
                <input value={hedef} onChange={(e) => setHedef(e.target.value)} placeholder={cfg.eslemePlaceholder.hedef} className="h-8 w-full rounded border px-2 text-sm" />
              </td>
              <td className="px-3 py-2 text-xs text-slate-400">upsert (aynı kaynak varsa hedef güncellenir)</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={ekle}
                  disabled={bekliyor || !kaynak.trim() || !hedef.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {bekliyor ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Ekle
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
