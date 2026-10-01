'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Kalem = {
  id: string; personnelId: string; personelAd: string; sicil: string | null; bolum: string | null; durum: string
  baslangic: string; bitis: string; baslangicYarim: string | null; bitisYarim: string | null; gunSayisi: number; olusturma: string
  sahipsiz: boolean; ekipCakisma: number; talepEden: string | null; etiket: 'İzin'; kademe: 'YONETICI' | 'IV'
  dakika: number | null; baslangicSaat: string | null; bitisSaat: string | null
  iv?: { turAd: string; not: string | null; belgeler: { id: string; ad: string; mime: string; boyut: number }[] }
  kararim?: { karar: string; not: string | null; zaman: string }
}
type Detay = {
  kalem: Omit<Kalem, 'kademe' | 'kararim'>
  kidem: string
  kademe: 'YONETICI' | 'IV' | null
  islemYapabilir: boolean
  engel: string | null
  bakiye: { once: number; sonra: number; yeterli: boolean } | null
  onayAdimlari: { kademe: string; karar: string; zaman: string; gerekce: string | null }[]
  ekipTablosu: { gunler: { tarih: string; tatil: string | null }[]; satirlar: { ad: string; talep: boolean; hucreler: string[] }[] }
}

const gunFmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
const kisa = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}`
const tarihFmt = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`
const aralik = (k: { baslangic: string; bitis: string }) => (k.baslangic === k.bitis ? tarihFmt(k.baslangic) : `${kisa(k.baslangic)}–${tarihFmt(k.bitis)}`)
const GUNLER = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
function once(iso: string) {
  const dk = Math.floor((Date.now() - Date.parse(iso)) / 60_000)
  if (dk < 60) return `${Math.max(1, dk)} dk önce`
  if (dk < 24 * 60) return `${Math.floor(dk / 60)} saat önce`
  const g = Math.floor(dk / 1440)
  return g === 1 ? 'dün' : `${g} gün önce`
}
// Hücre renkleri (canvas): izinli koyu mavi, yarım açık mavi, bekliyor turuncu, tatil gri. Tür YOK.
const HUCRE: Record<string, { c: string; t: string }> = {
  TALEP: { c: 'bg-[#1B4F72] text-white', t: 'Talep' },
  TALEP_YARIM: { c: 'bg-[linear-gradient(90deg,#1B4F72_50%,#dbeafe_50%)] text-slate-900', t: 'Yarım' },
  IZINLI: { c: 'bg-blue-100 text-blue-900', t: 'İzinli' },
  YARIM: { c: 'bg-blue-50 text-blue-800', t: 'Yarım' },
  BEKLIYOR: { c: 'bg-amber-100 text-amber-900', t: 'Bekliyor' },
  TATIL: { c: 'bg-slate-200 text-slate-600', t: 'Tatil' },
  AREFE: { c: 'bg-slate-100 text-slate-600', t: 'Arefe' },
  BOS: { c: 'bg-slate-50', t: '' },
}

async function istek<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<{ ok: boolean; veri: T & { error?: string } }> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init })
    const veri = (await r.json().catch(() => ({}))) as T & { error?: string; ok?: boolean }
    return { ok: r.ok && veri.ok !== false, veri }
  } catch {
    return { ok: false, veri: { error: 'Sunucuya ulaşılamadı' } as T & { error?: string } }
  }
}

// Süre: saatlik izinde saat aralığı, günlükte gün (tür bilgisi değil)
const sure = (k: { dakika: number | null; gunSayisi: number; baslangicSaat: string | null; bitisSaat: string | null }) =>
  k.dakika ? `${(k.dakika / 60).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} sa (${k.baslangicSaat}–${k.bitisSaat})` : `${gunFmt(k.gunSayisi)} gün`

export function OnayClient({ ivMi, ilkSekme }: { ivMi: boolean; ilkSekme: 'bekleyen' | 'karar' | 'erken' }) {
  const [sekme, setSekme] = useState(ilkSekme === 'erken' && !ivMi ? 'bekleyen' : ilkSekme)
  const [kalemler, setKalemler] = useState<Kalem[] | null>(null)
  const [secili, setSecili] = useState<string | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [bekleyenSayi, setBekleyenSayi] = useState<number | null>(null)

  const yukle = useCallback(async () => {
    if (sekme === 'erken') return
    const { ok, veri } = await istek<{ kalemler: Kalem[] }>(`/api/izin/onay?sekme=${sekme}`)
    if (!ok) return setHata(veri.error ?? 'Liste alınamadı')
    setHata(null)
    setKalemler(veri.kalemler)
    if (sekme === 'bekleyen') setBekleyenSayi(veri.kalemler.length)
    setSecili((s) => (s && veri.kalemler.some((k) => k.id === s) ? s : veri.kalemler[0]?.id ?? null))
  }, [sekme])
  useEffect(() => { setKalemler(null); void yukle() }, [yukle])

  return (
    <div className="space-y-5">
      <div className="inline-flex h-10 overflow-hidden rounded-lg border bg-white text-sm" role="tablist">
        {(ivMi ? (['bekleyen', 'karar', 'erken'] as const) : (['bekleyen', 'karar'] as const)).map((s, i) => (
          <button key={s} role="tab" aria-selected={sekme === s} onClick={() => setSekme(s)}
            className={cn('px-4', i > 0 && 'border-l', sekme === s ? 'bg-[#1B4F72] font-medium text-white' : 'text-slate-700 hover:bg-slate-50')}>
            {s === 'bekleyen' ? `Bekleyen${bekleyenSayi !== null ? ` (${bekleyenSayi})` : ''}` : s === 'karar' ? 'Karar verdiklerim' : 'Erken dönüş'}
          </button>
        ))}
      </div>
      {sekme === 'erken' && <ErkenDonusPanel />}
      {sekme !== 'erken' && hata && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{hata}</div>}
      {sekme !== 'erken' && !kalemler && !hata && <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />}
      {sekme !== 'erken' && kalemler && kalemler.length === 0 && (
        <div className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-slate-400">{sekme === 'bekleyen' ? 'Onayınızı bekleyen talep yok' : 'Henüz karar vermediniz'}</div>
      )}
      {sekme !== 'erken' && kalemler && kalemler.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-2.5">
            {kalemler.map((k) => (
              <button key={`${k.id}-${k.kademe}`} onClick={() => setSecili(k.id)}
                className={cn('flex w-full flex-col gap-1.5 rounded-lg border bg-white p-3.5 text-left', secili === k.id ? 'border-2 border-[#1B4F72]' : 'hover:border-slate-300')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{k.personelAd}</span>
                  <span className="text-xs text-slate-500">{once(k.kararim?.zaman ?? k.olusturma)}</span>
                </div>
                <div className="flex justify-between gap-2 text-sm text-slate-700">
                  <span>{k.iv?.turAd ?? k.etiket}</span>
                  <span className="font-mono">{aralik(k)} · {sure(k)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {k.kademe === 'IV' && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">İV kademesi</span>}
                  {k.kademe === 'YONETICI' && ivMi && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-500">Yönetici onayında · görüntüleme</span>}
                  {k.sahipsiz && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">Sahipsiz — yönetici çözülemedi</span>}
                  {k.kararim && <span className={cn('rounded-full border px-2 py-0.5', k.kararim.karar === 'ONAY' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-100 text-slate-600')}>{k.kararim.karar === 'ONAY' ? 'Onayladınız' : 'Reddettiniz'}</span>}
                </div>
                {k.ekipCakisma > 0 && <span className="text-xs text-amber-800">Aynı günlerde ekipten {k.ekipCakisma} kişi izinli</span>}
              </button>
            ))}
          </div>
          {secili && <DetayPanel id={secili} bitti={yukle} />}
        </div>
      )}
    </div>
  )
}

function DetayPanel({ id, bitti }: { id: string; bitti: () => void }) {
  const [d, setD] = useState<Detay | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [gerekce, setGerekce] = useState('')
  const [negatif, setNegatif] = useState(false)
  const [calisiyor, setCalisiyor] = useState(false)
  const [mesaj, setMesaj] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    const { ok, veri } = await istek<Detay>(`/api/izin/onay/${id}`)
    if (ok) setD(veri)
    else setHata(veri.error ?? 'Talep alınamadı')
  }, [id])
  useEffect(() => { setD(null); setHata(null); setGerekce(''); setNegatif(false); setMesaj(null); void yukle() }, [yukle])

  const karar = async (k: 'ONAY' | 'RED') => {
    if (k === 'RED' && gerekce.trim().length < 5) return setHata('Red gerekçesi zorunlu (en az 5 karakter)')
    setCalisiyor(true)
    const { ok, veri } = await istek<{ uyari: string | null }>(`/api/izin/onay/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ karar: k, gerekce, negatifeDusur: negatif }),
    })
    setCalisiyor(false)
    if (!ok) return setHata(veri.error ?? 'Karar kaydedilemedi')
    setHata(null)
    setMesaj(veri.uyari)
    bitti()
  }

  if (!d) return <section className="rounded-lg border bg-white p-6">{hata ? <p className="text-sm text-amber-800">{hata}</p> : <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />}</section>
  const k = d.kalem
  const tablo = d.ekipTablosu
  return (
    <section aria-labelledby="onay-detay" className="min-w-0 space-y-5 rounded-lg border bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="onay-detay" className="text-lg font-semibold">{k.personelAd}</h2>
          <p className="text-sm text-slate-500">{[k.sicil, k.bolum, `Kıdem ${d.kidem}`].filter(Boolean).join(' · ')}</p>
          {k.talepEden && <p className="text-xs text-slate-500">{k.talepEden} adına açtı</p>}
        </div>
        {d.islemYapabilir && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{d.kademe === 'IV' ? 'İV onayınızda' : 'Sizin onayınızda'}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {k.iv && <Bilgi ad="Tür" deger={k.iv.turAd} />}
        <Bilgi ad="Tarih" deger={aralik(k)} mono />
        <Bilgi ad="Düşülecek" deger={sure(k)} mono />
        {d.bakiye && <Bilgi ad="Bakiye" deger={`${gunFmt(d.bakiye.once)} → ${gunFmt(d.bakiye.sonra)}`} mono uyari={!d.bakiye.yeterli} />}
      </div>
      {k.iv?.not && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{k.iv.not}</p>}
      {k.iv && k.iv.belgeler.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-slate-500">Belgeler (her açılış denetim kaydına yazılır)</span>
          <ul className="space-y-1 text-sm">
            {k.iv.belgeler.map((b) => (
              <li key={b.id}>
                <a href={`/api/izin/belge/${b.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#1B4F72] hover:underline">{b.ad}</a>
                <span className="ml-2 text-xs text-slate-500">{Math.ceil(b.boyut / 1024)} KB</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tablo.gunler.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-semibold">Ekibin o günleri</span>
          <div className="overflow-x-auto">
            <div className="grid min-w-[480px] gap-1 text-xs" style={{ gridTemplateColumns: `150px repeat(${tablo.gunler.length}, minmax(44px, 1fr))` }}>
              <div />
              {tablo.gunler.map((g) => <div key={g.tarih} className="text-center text-slate-500">{GUNLER[new Date(`${g.tarih}T12:00:00Z`).getUTCDay()]} {Number(g.tarih.slice(8))}</div>)}
              {tablo.satirlar.map((s) => (
                <div key={s.ad} className="contents">
                  <div className={cn('truncate py-1.5', s.talep && 'font-semibold')}>{s.ad}</div>
                  {s.hucreler.map((h, i) => (
                    <div key={i} className={cn('flex h-7 items-center justify-center rounded-md text-[11px] font-medium', HUCRE[h]?.c)}>{HUCRE[h]?.t}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">Ekip takviminde yalnızca &quot;İzinli&quot; görünür; izin türü gösterilmez.</p>
        </div>
      )}

      {d.onayAdimlari.length > 0 && (
        <ol className="space-y-1 text-xs text-slate-500">
          {d.onayAdimlari.map((a, i) => (
            <li key={i}>{a.kademe === 'IV' ? 'İV' : 'Yönetici'} · {a.karar === 'ONAY' ? 'onayladı' : a.karar === 'RED' ? 'reddetti' : `atlandı (${a.gerekce})`} · {new Date(a.zaman).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })}</li>
          ))}
        </ol>
      )}

      {mesaj && <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{mesaj}</div>}
      {hata && <p className="text-sm text-amber-800">{hata}</p>}
      {d.islemYapabilir ? (
        <>
          <div>
            <Label htmlFor="red-gerekce" className="text-xs text-slate-500">{negatif ? 'Dilekçe gerekçesi (eksiye düşürmede zorunlu)' : 'Red gerekçesi (reddederken zorunlu)'}</Label>
            <Textarea id="red-gerekce" rows={2} value={gerekce} onChange={(e) => setGerekce(e.target.value)} className="mt-1 resize-none" maxLength={500} />
          </div>
          {d.bakiye && !d.bakiye.yeterli && d.kademe === 'IV' && (
            <label className="flex items-center gap-2 text-sm text-amber-900">
              <input type="checkbox" checked={negatif} onChange={(e) => setNegatif(e.target.checked)} className="h-4 w-4 accent-amber-700" />
              Bakiye yetersiz — dilekçeyle eksiye düşürerek onayla
            </label>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => karar('RED')} disabled={calisiyor} className="h-11">Reddet</Button>
            <Button onClick={() => karar('ONAY')} disabled={calisiyor || (!!d.bakiye && !d.bakiye.yeterli && (!negatif || gerekce.trim().length < 5))} className="h-11 px-6">
              {calisiyor && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{d.kademe === 'IV' ? 'Onayla' : "Onayla · İV'ye gönder"}
            </Button>
          </div>
        </>
      ) : k.iv && k.durum === 'ONAYLANDI' && k.baslangic > new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10) ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Label htmlFor="iptal-gerekce" className="text-xs text-slate-500">Onaylı izni başlamadan iptal et (gerekçe zorunlu; bakiyeli türde günler iade edilir)</Label>
          <Textarea id="iptal-gerekce" rows={2} value={gerekce} onChange={(e) => setGerekce(e.target.value)} className="resize-none bg-white" maxLength={500} />
          <Button variant="outline" disabled={calisiyor || gerekce.trim().length < 5} onClick={async () => {
            setCalisiyor(true)
            const { ok, veri } = await istek(`/api/izin/talepler/${id}/iptal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gerekce }) })
            setCalisiyor(false)
            if (!ok) return setHata(veri.error ?? 'İptal edilemedi')
            setHata(null); bitti(); void yukle()
          }}>İzni iptal et</Button>
        </div>
      ) : (
        d.engel && k.durum.startsWith('BEKLIYOR') && <p className="text-sm text-slate-500">{d.engel}</p>
      )}
    </section>
  )
}

function Bilgi({ ad, deger, mono, uyari }: { ad: string; deger: string; mono?: boolean; uyari?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{ad}</span>
      <span className={cn('text-[15px] font-semibold', mono && 'font-mono', uyari && 'text-amber-800')}>{deger}</span>
    </div>
  )
}

// ── Erken dönüş kuyruğu (İV) ─────────────────────────────────────────────────

type ErkenKayit = {
  id: string; durum: 'BEKLIYOR' | 'ONAYLANDI' | 'REDDEDILDI'; tarih: string; personelAd: string; sicil: string | null; turAd: string; bakiyeli: boolean
  baslangic: string; bitis: string; gunSayisi: number; iadeEdilebilir: number; iadeGun: number | null; kararAt: string | null; kararNotu: string | null
}

/** İzinli günde PDKS geçişi görülen izinler. OTOMATİK İADE YOK — İV onaylarsa o günden itibaren kalan günler iade. */
function ErkenDonusPanel() {
  const [kayitlar, setKayitlar] = useState<ErkenKayit[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [calisiyor, setCalisiyor] = useState<string | null>(null)
  const yukle = useCallback(async () => {
    const { ok, veri } = await istek<{ kayitlar: ErkenKayit[] }>('/api/izin/erken-donus')
    if (ok) { setKayitlar(veri.kayitlar); setHata(null) } else setHata(veri.error ?? 'Kuyruk alınamadı')
  }, [])
  useEffect(() => void yukle(), [yukle])

  const tara = async () => {
    setCalisiyor('tara')
    const { ok, veri } = await istek<{ yeni: number }>('/api/izin/erken-donus/tara', { method: 'POST' })
    setCalisiyor(null)
    if (!ok) return setHata(veri.error ?? 'Tarama yapılamadı')
    setMesaj(veri.yeni ? `${veri.yeni} yeni erken dönüş kaydı kuyruğa alındı` : 'Yeni kayıt yok')
    void yukle()
  }
  const karar = async (id: string, k: 'ONAY' | 'RED') => {
    if (k === 'ONAY' && !window.confirm('Tespit gününden itibaren kalan izin günleri iade edilecek. Onaylıyor musunuz?')) return
    setCalisiyor(id)
    const { ok, veri } = await istek<{ iadeGun: number }>(`/api/izin/erken-donus/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ karar: k }) })
    setCalisiyor(null)
    if (!ok) return setHata(veri.error ?? 'Karar kaydedilemedi')
    setMesaj(k === 'ONAY' ? `${gunFmt(veri.iadeGun)} gün iade edildi` : 'İade yapılmadı; izin olduğu gibi kaldı')
    void yukle()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600">Onaylı izin gününde turnikeden geçiş görülen kişiler. Otomatik iade yapılmaz — karar sizde.</p>
        <Button variant="outline" onClick={tara} disabled={calisiyor === 'tara'} className="ml-auto">
          {calisiyor === 'tara' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Tara
        </Button>
      </div>
      {mesaj && <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">{mesaj}</div>}
      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{hata}</div>}
      {!kayitlar && !hata && <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />}
      {kayitlar?.length === 0 && <div className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-slate-400">Erken dönüş kaydı yok</div>}
      <div className="space-y-2.5">
        {kayitlar?.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3.5">
            <div className="space-y-0.5 text-sm">
              <div className="font-semibold">{r.personelAd} <span className="font-mono text-xs font-normal text-slate-500">{r.sicil}</span></div>
              <div className="text-slate-600">{r.turAd} · {aralik(r)} · {gunFmt(r.gunSayisi)} gün</div>
              <div className="text-xs text-amber-800">{tarihFmt(r.tarih)} tarihinde geçiş görüldü · iade edilebilir {gunFmt(r.iadeEdilebilir)} gün{r.bakiyeli ? '' : ' (bakiyesiz tür — yalnız günler serbest kalır)'}</div>
            </div>
            {r.durum === 'BEKLIYOR' ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!!calisiyor} onClick={() => karar(r.id, 'RED')}>İade etme</Button>
                <Button size="sm" disabled={!!calisiyor || r.iadeEdilebilir <= 0} onClick={() => karar(r.id, 'ONAY')}>Kalan günleri iade et</Button>
              </div>
            ) : (
              <span className={cn('rounded-full border px-2.5 py-0.5 text-xs', r.durum === 'ONAYLANDI' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-100 text-slate-600')}>
                {r.durum === 'ONAYLANDI' ? `${gunFmt(r.iadeGun ?? 0)} gün iade edildi` : 'İade edilmedi'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
