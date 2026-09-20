'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/ui/select'
import { DateField } from '@/components/ui/date-field'
import { ChevronDown, ChevronRight, Database, Download, Loader2, Play, Plus, Save, Search, Trash2, X } from 'lucide-react'
import type { Birlestirme, Kaynak, KaynakIfs, KaynakPostgres, VeriSetiTanim } from '@/lib/rapor/tipler'
import { GeriRozet } from '../../../_components/rozet-link'

const NAVY = '#1B4F72'

// ── Tipler ──────────────────────────────────────────────────────────────

interface Props {
  katalogYukleyebilir: boolean
  mevcut?: { id: string; ad: string; aciklama: string; tanim: VeriSetiTanim; sablonSayisi: number }
}

interface Projeksiyon { ad: string; yuklendi: boolean; entitySayisi: number }
interface Entity { entity: string; alanSayisi: number; entitySetleri: string[] }
interface KatalogAlan { alan: string; veriTipi: string; anahtarMi: boolean }
interface HubTablo { ad: string; kolonSayisi: number }
interface HubKolon { ad: string; veriTipi: string }
interface AramaSonucu { kaynakAd: string; entity: string; alan: string; veriTipi: string }
interface AlanEsleme { cikti: string; yol: string }
type ParamTip = 'metin' | 'sayi' | 'tarih'
interface Onizleme { satirlar: Record<string, unknown>[]; toplamSatir: number; kaynakIstatistik: { ad: string; satir: number; sureMs: number }[]; toplamSureMs: number; not?: string }

// ── Yardımcılar ─────────────────────────────────────────────────────────

const YER_TUTUCU = /\{p\.([A-Za-z_][A-Za-z0-9_]*)\}/g

/** WHERE metnindeki {p.x}'leri sırayla $n'e çevirir; parametre adı listesini döndürür. */
function whereDerle(where: string): { sql: string; parametreler: string[] } {
  const parametreler: string[] = []
  const sql = where.replace(YER_TUTUCU, (_, ad: string) => {
    let i = parametreler.indexOf(ad)
    if (i < 0) { parametreler.push(ad); i = parametreler.length - 1 }
    return `$${i + 1}`
  })
  return { sql, parametreler }
}

/** Tasarım meta'sından SELECT üretir — kolon/tablo adları çift tırnaklı, değerler $n. */
function postgresSorgu(t: NonNullable<KaynakPostgres['tasarim']>): { sorgu: string; parametreler: string[] } {
  const kolonlar = t.alanlar.length ? t.alanlar.map((a) => `"${a.replace(/"/g, '""')}"`).join(', ') : '*'
  const { sql, parametreler } = whereDerle(t.where?.trim() ?? '')
  return { sorgu: `SELECT ${kolonlar} FROM "${t.tablo.replace(/"/g, '""')}"${sql ? ` WHERE ${sql}` : ''}`, parametreler }
}

function takmaAdUret(taban: string, mevcut: Set<string>): string {
  const kok = (taban.replace(/[^A-Za-z0-9_]/g, '').replace(/^[0-9]+/, '') || 'kaynak')
  const ad = kok[0].toLowerCase() + kok.slice(1)
  if (!mevcut.has(ad)) return ad
  for (let i = 2; ; i++) if (!mevcut.has(`${ad}${i}`)) return `${ad}${i}`
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`)
  return d as T
}

const hucreMetni = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

// ── Bileşen ─────────────────────────────────────────────────────────────

export default function VeriSetiTasarimClient({ katalogYukleyebilir, mevcut }: Props) {
  const router = useRouter()

  // Üst
  const [ad, setAd] = useState(mevcut?.ad ?? '')
  const [aciklama, setAciklama] = useState(mevcut?.aciklama ?? '')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [kayitHata, setKayitHata] = useState<string | null>(null)
  const [kayitHatalari, setKayitHatalari] = useState<string[]>([])
  const [kayitMesaj, setKayitMesaj] = useState<string | null>(null)

  // Orta — tanım
  const [kaynaklar, setKaynaklar] = useState<Kaynak[]>(mevcut?.tanim.kaynaklar ?? [])
  const [birlestir, setBirlestir] = useState<Birlestirme[]>(mevcut?.tanim.birlestir ?? [])
  const [alanEslemeleri, setAlanEslemeleri] = useState<AlanEsleme[]>(Object.entries(mevcut?.tanim.alanlar ?? {}).map(([cikti, yol]) => ({ cikti, yol })))
  /** kaynak takma adı → seçilebilir alan listesi (IFS katalog / Hub kolon). */
  const [kaynakAlanlari, setKaynakAlanlari] = useState<Record<string, string[]>>({})
  const [acikKaynak, setAcikKaynak] = useState<string | null>(null)

  // Sol — katalog
  const [arama, setArama] = useState('')
  const [aramaSonuclari, setAramaSonuclari] = useState<AramaSonucu[] | null>(null)
  const [kaynakTip, setKaynakTip] = useState<'ifs' | 'hub'>('ifs')
  const [projeksiyonlar, setProjeksiyonlar] = useState<Projeksiyon[]>([])
  const [seciliProjeksiyon, setSeciliProjeksiyon] = useState('')
  const [entityAra, setEntityAra] = useState('')
  const [entityler, setEntityler] = useState<Entity[]>([])
  const [entityUyari, setEntityUyari] = useState<string | null>(null)
  const [seciliEntity, setSeciliEntity] = useState<Entity | null>(null)
  const [katalogAlanlari, setKatalogAlanlari] = useState<KatalogAlan[]>([])
  const [hubTablolar, setHubTablolar] = useState<HubTablo[]>([])
  const [hubAra, setHubAra] = useState('')
  const [seciliTablo, setSeciliTablo] = useState('')
  const [hubKolonlar, setHubKolonlar] = useState<HubKolon[]>([])
  const [yukleniyor, setYukleniyor] = useState<string | null>(null)
  const [solHata, setSolHata] = useState<string | null>(null)

  // Sağ — önizleme
  const [paramDegerleri, setParamDegerleri] = useState<Record<string, { tip: ParamTip; deger: string }>>({})
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null)
  const [onizlemeHata, setOnizlemeHata] = useState<string | null>(null)
  const [onizleniyor, setOnizleniyor] = useState(false)

  // ── Katalog yükleme ───────────────────────────────────────────────────

  const projeksiyonlariYukle = useCallback(() => {
    getJson<{ projeksiyonlar: Projeksiyon[] }>('/api/raporlar/katalog/projeksiyonlar').then((d) => setProjeksiyonlar(d.projeksiyonlar)).catch((e: Error) => setSolHata(e.message))
  }, [])
  useEffect(projeksiyonlariYukle, [projeksiyonlariYukle])
  useEffect(() => {
    getJson<{ tablolar: HubTablo[] }>('/api/raporlar/hub-tablolar').then((d) => setHubTablolar(d.tablolar)).catch((e: Error) => setSolHata(e.message))
  }, [])

  useEffect(() => {
    if (!seciliProjeksiyon) { setEntityler([]); return }
    setYukleniyor('entity')
    setEntityUyari(null)
    getJson<{ entityler: Entity[]; uyari?: string }>(`/api/raporlar/katalog/entityler?projeksiyon=${encodeURIComponent(seciliProjeksiyon)}&ara=${encodeURIComponent(entityAra)}`)
      .then((d) => { setEntityler(d.entityler); setEntityUyari(d.uyari ?? null) })
      .catch((e: Error) => setSolHata(e.message))
      .finally(() => setYukleniyor(null))
  }, [seciliProjeksiyon, entityAra])

  useEffect(() => {
    if (!seciliEntity || !seciliProjeksiyon) { setKatalogAlanlari([]); return }
    getJson<{ alanlar: KatalogAlan[] }>(`/api/raporlar/katalog/alanlar?projeksiyon=${encodeURIComponent(seciliProjeksiyon)}&entity=${encodeURIComponent(seciliEntity.entity)}`)
      .then((d) => setKatalogAlanlari(d.alanlar)).catch((e: Error) => setSolHata(e.message))
  }, [seciliEntity, seciliProjeksiyon])

  useEffect(() => {
    if (!seciliTablo) { setHubKolonlar([]); return }
    getJson<{ kolonlar: HubKolon[] }>(`/api/raporlar/hub-tablolar?tablo=${encodeURIComponent(seciliTablo)}`).then((d) => setHubKolonlar(d.kolonlar)).catch((e: Error) => setSolHata(e.message))
  }, [seciliTablo])

  // Arama (debounce)
  useEffect(() => {
    if (arama.trim().length < 2) { setAramaSonuclari(null); return }
    const t = setTimeout(() => {
      getJson<{ sonuclar: AramaSonucu[] }>(`/api/raporlar/katalog/ara?q=${encodeURIComponent(arama.trim())}`).then((d) => setAramaSonuclari(d.sonuclar)).catch((e: Error) => setSolHata(e.message))
    }, 300)
    return () => clearTimeout(t)
  }, [arama])

  // Mevcut kaynakların alan listelerini getir (join/eşleme açılır listeleri için)
  useEffect(() => {
    for (const k of kaynaklar) {
      if (kaynakAlanlari[k.ad]) continue
      if (k.tip === 'ifs-odata') {
        // Katalogdaki EntityType adını bilmiyoruz (kaynakta set adı var); seçili alanlar yeterli, yoksa boş.
        if (k.select?.length) setKaynakAlanlari((m) => ({ ...m, [k.ad]: k.select ?? [] }))
      } else if (k.tasarim?.tablo) {
        const tablo = k.tasarim.tablo
        getJson<{ kolonlar: HubKolon[] }>(`/api/raporlar/hub-tablolar?tablo=${encodeURIComponent(tablo)}`)
          .then((d) => setKaynakAlanlari((m) => ({ ...m, [k.ad]: d.kolonlar.map((c) => c.ad) }))).catch(() => {})
      }
    }
  }, [kaynaklar, kaynakAlanlari])

  async function katalogYukle(projeksiyon: string) {
    setYukleniyor(`yukle:${projeksiyon}`)
    setSolHata(null)
    try {
      const r = await fetch('/api/raporlar/katalog/yukle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projeksiyon }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`)
      projeksiyonlariYukle()
      if (seciliProjeksiyon === projeksiyon) setEntityAra((s) => s + '')
    } catch (e) { setSolHata(e instanceof Error ? e.message : String(e)) }
    finally { setYukleniyor(null) }
  }

  // ── Kaynak işlemleri ──────────────────────────────────────────────────

  const kaynakAdlari = useMemo(() => new Set(kaynaklar.map((k) => k.ad)), [kaynaklar])

  function ifsKaynakEkle(entity: Entity, entitySet: string) {
    const takma = takmaAdUret(entity.entity, kaynakAdlari)
    const anahtarlar = katalogAlanlari.filter((a) => a.anahtarMi).map((a) => a.alan)
    const k: KaynakIfs = { ad: takma, tip: 'ifs-odata', projeksiyon: seciliProjeksiyon, entitySet, select: anahtarlar, top: 500 }
    setKaynaklar((l) => [...l, k])
    setKaynakAlanlari((m) => ({ ...m, [takma]: katalogAlanlari.map((a) => a.alan) }))
    setAcikKaynak(takma)
  }

  function hubKaynakEkle(tablo: string) {
    const takma = takmaAdUret(tablo, kaynakAdlari)
    const tasarim = { tablo, alanlar: [] as string[], where: '' }
    const { sorgu, parametreler } = postgresSorgu(tasarim)
    const k: KaynakPostgres = { ad: takma, tip: 'postgres', sorgu, parametreler, tasarim }
    setKaynaklar((l) => [...l, k])
    setKaynakAlanlari((m) => ({ ...m, [takma]: hubKolonlar.map((c) => c.ad) }))
    setAcikKaynak(takma)
  }

  function kaynakGuncelle(i: number, degisim: (k: Kaynak) => Kaynak) {
    setKaynaklar((l) => l.map((k, j) => (j === i ? degisim(k) : k)))
  }

  function kaynakAdDegistir(i: number, yeniAd: string) {
    const eski = kaynaklar[i].ad
    if (!yeniAd || yeniAd === eski) return
    kaynakGuncelle(i, (k) => ({ ...k, ad: yeniAd }))
    setKaynakAlanlari((m) => { const { [eski]: alanlar, ...kalan } = m; return alanlar ? { ...kalan, [yeniAd]: alanlar } : kalan })
    const yolDegistir = (y: string) => (y.startsWith(`${eski}.`) ? `${yeniAd}.${y.slice(eski.length + 1)}` : y)
    setBirlestir((l) => l.map((b) => ({ ...b, sol: yolDegistir(b.sol), sag: yolDegistir(b.sag) })))
    setAlanEslemeleri((l) => l.map((e) => ({ ...e, yol: yolDegistir(e.yol) })))
    if (acikKaynak === eski) setAcikKaynak(yeniAd)
  }

  function kaynakSil(i: number) {
    const adi = kaynaklar[i].ad
    setKaynaklar((l) => l.filter((_, j) => j !== i))
    setBirlestir((l) => l.filter((b) => !b.sol.startsWith(`${adi}.`) && !b.sag.startsWith(`${adi}.`)))
    setAlanEslemeleri((l) => l.filter((e) => !e.yol.startsWith(`${adi}.`)))
  }

  function ifsAlanToggle(i: number, alan: string, secili: boolean) {
    kaynakGuncelle(i, (k) => {
      if (k.tip !== 'ifs-odata') return k
      const s = new Set(k.select ?? [])
      if (secili) s.add(alan); else s.delete(alan)
      return { ...k, select: [...s] }
    })
  }

  function hubTasarimGuncelle(i: number, degisim: (t: NonNullable<KaynakPostgres['tasarim']>) => NonNullable<KaynakPostgres['tasarim']>) {
    kaynakGuncelle(i, (k) => {
      if (k.tip !== 'postgres' || !k.tasarim) return k
      const tasarim = degisim(k.tasarim)
      const { sorgu, parametreler } = postgresSorgu(tasarim)
      return { ...k, tasarim, sorgu, parametreler }
    })
  }

  /** Kaynağın join/eşleme listelerinde sunulacak alanları: seçili alanlar (varsa) yoksa katalogdakiler. */
  const kaynakSecenekleri = useCallback((k: Kaynak): string[] => {
    if (k.tip === 'ifs-odata' && k.select?.length) return k.select
    if (k.tip === 'postgres' && k.tasarim?.alanlar.length) return k.tasarim.alanlar
    return kaynakAlanlari[k.ad] ?? []
  }, [kaynakAlanlari])

  const tumYollar = useMemo(() => kaynaklar.flatMap((k) => kaynakSecenekleri(k).map((a) => `${k.ad}.${a}`)), [kaynaklar, kaynakSecenekleri])

  function tumAlanlariEsle(k: Kaynak) {
    const mevcutCikti = new Set(alanEslemeleri.map((e) => e.cikti))
    const mevcutYol = new Set(alanEslemeleri.map((e) => e.yol))
    const yeni: AlanEsleme[] = []
    for (const a of kaynakSecenekleri(k)) {
      const yol = `${k.ad}.${a}`
      if (mevcutYol.has(yol)) continue
      let cikti = a.replace(/[^A-Za-z0-9_]/g, '_')
      if (mevcutCikti.has(cikti)) cikti = `${k.ad}_${cikti}`
      mevcutCikti.add(cikti)
      yeni.push({ cikti, yol })
    }
    setAlanEslemeleri((l) => [...l, ...yeni])
  }

  // ── Parametre tespiti ─────────────────────────────────────────────────

  const parametreAdlari = useMemo(() => {
    const s = new Set<string>()
    for (const k of kaynaklar) {
      const metin = k.tip === 'ifs-odata' ? (k.filtre ?? '') : (k.tasarim?.where ?? '')
      for (const m of metin.matchAll(YER_TUTUCU)) s.add(m[1])
      if (k.tip === 'postgres') for (const p of k.parametreler ?? []) s.add(p)
    }
    return [...s]
  }, [kaynaklar])

  // ── Tanım + kaydet + önizle ───────────────────────────────────────────

  const tanim = useMemo<VeriSetiTanim>(() => ({
    kaynaklar,
    birlestir,
    alanlar: Object.fromEntries(alanEslemeleri.filter((e) => e.cikti && e.yol).map((e) => [e.cikti, e.yol])),
  }), [kaynaklar, birlestir, alanEslemeleri])

  async function kaydet() {
    setKaydediliyor(true)
    setKayitHata(null); setKayitHatalari([]); setKayitMesaj(null)
    try {
      const r = await fetch(mevcut ? `/api/raporlar/veri-setleri/${mevcut.id}` : '/api/raporlar/veri-setleri', {
        method: mevcut ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad, aciklama, tanim }),
      })
      const d = await r.json()
      if (!r.ok) { setKayitHata(d.error ?? `HTTP ${r.status}`); setKayitHatalari(d.hatalar ?? []); return }
      setKayitMesaj('Kaydedildi')
      if (!mevcut) router.replace(`/raporlar/veri-setleri/${d.veriSeti.id}`)
    } catch (e) { setKayitHata(e instanceof Error ? e.message : String(e)) }
    finally { setKaydediliyor(false) }
  }

  async function onizle() {
    setOnizleniyor(true)
    setOnizlemeHata(null)
    try {
      const parametreler = Object.fromEntries(parametreAdlari.map((p) => [p, paramDegerleri[p] ?? { tip: 'metin', deger: '' }]))
      const r = await fetch('/api/raporlar/veri-setleri/onizle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tanim, parametreler }) })
      const d = await r.json()
      if (!r.ok) { setOnizleme(null); setOnizlemeHata([d.error, ...(d.hatalar ?? [])].filter(Boolean).join(' · ')); return }
      setOnizleme(d)
    } catch (e) { setOnizleme(null); setOnizlemeHata(e instanceof Error ? e.message : String(e)) }
    finally { setOnizleniyor(false) }
  }

  const onizlemeKolonlari = useMemo(() => (onizleme?.satirlar.length ? Object.keys(onizleme.satirlar[0]) : []), [onizleme])
  const filtreliTablolar = useMemo(() => hubTablolar.filter((t) => !hubAra || t.ad.toLowerCase().includes(hubAra.toLowerCase())), [hubTablolar, hubAra])

  // ── Görünüm ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ÜST */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <GeriRozet href="/raporlar/veri-setleri">Veri Setleri</GeriRozet>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-3">
            <Database className="h-6 w-6" style={{ color: NAVY }} />
            {mevcut ? 'Veri Seti Düzenle' : 'Yeni Veri Seti'}
            {mevcut && mevcut.sablonSayisi > 0 && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{mevcut.sablonSayisi} şablon kullanıyor</Badge>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {kayitMesaj && <span className="text-sm text-green-700">{kayitMesaj}</span>}
          <Button onClick={kaydet} disabled={kaydediliyor || !ad.trim() || kaynaklar.length === 0} style={{ backgroundColor: NAVY }}>
            {kaydediliyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Kaydet
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-[1fr_2fr]">
          <div className="space-y-1.5">
            <Label htmlFor="vs-ad">Veri seti adı <span className="text-red-600">*</span></Label>
            <Input id="vs-ad" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="is_emri_uretim" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vs-aciklama">Açıklama</Label>
            <Input id="vs-aciklama" value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Ne için kullanılır?" />
          </div>
        </CardContent>
      </Card>
      {(kayitHata || kayitHatalari.length > 0) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="font-medium">{kayitHata}</div>
          {kayitHatalari.length > 0 && <ul className="list-disc ml-5 mt-1">{kayitHatalari.map((h, i) => <li key={i}>{h}</li>)}</ul>}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[300px_1fr_380px]">
        {/* SOL — Katalog */}
        <Card className="xl:sticky xl:top-4 self-start max-h-[calc(100vh-6rem)] flex flex-col">
          <CardHeader className="pb-2"><CardTitle className="text-base">Veri kataloğu</CardTitle></CardHeader>
          <CardContent className="space-y-3 overflow-y-auto text-sm">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-3 text-muted-foreground" />
              <Input className="pl-8" placeholder="Alan / entity ara (≥2 harf)" value={arama} onChange={(e) => setArama(e.target.value)} />
            </div>
            {solHata && <div className="text-xs text-red-700 flex items-start gap-1"><span className="flex-1">{solHata}</span><button onClick={() => setSolHata(null)}><X className="h-3 w-3" /></button></div>}

            {aramaSonuclari ? (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{aramaSonuclari.length} sonuç {aramaSonuclari.length >= 50 && '(ilk 50)'}</div>
                {aramaSonuclari.map((s, i) => (
                  <button key={i} className="w-full text-left rounded px-2 py-1 hover:bg-muted" title="Projeksiyon ve entity'yi seç"
                    onClick={() => { setKaynakTip('ifs'); setSeciliProjeksiyon(s.kaynakAd); setEntityAra(''); setSeciliEntity({ entity: s.entity, alanSayisi: 0, entitySetleri: [] }); setArama('') }}>
                    <div className="font-mono text-xs">{s.alan} <span className="text-muted-foreground">({s.veriTipi})</span></div>
                    <div className="text-[11px] text-muted-foreground">{s.kaynakAd} › {s.entity}</div>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="flex gap-1">
                  <Button size="sm" variant={kaynakTip === 'ifs' ? 'default' : 'outline'} onClick={() => setKaynakTip('ifs')} style={kaynakTip === 'ifs' ? { backgroundColor: NAVY } : undefined}>IFS</Button>
                  <Button size="sm" variant={kaynakTip === 'hub' ? 'default' : 'outline'} onClick={() => setKaynakTip('hub')} style={kaynakTip === 'hub' ? { backgroundColor: NAVY } : undefined}>Hub tabloları</Button>
                </div>

                {kaynakTip === 'ifs' ? (
                  <div className="space-y-2">
                    <NativeSelect value={seciliProjeksiyon} onChange={(e) => { setSeciliProjeksiyon(e.target.value); setSeciliEntity(null); setEntityAra('') }}>
                      <option value="">Projeksiyon seçin…</option>
                      {projeksiyonlar.map((p) => <option key={p.ad} value={p.ad}>{p.ad}{p.yuklendi ? ` (${p.entitySayisi})` : ' — yüklenmemiş'}</option>)}
                    </NativeSelect>
                    {seciliProjeksiyon && (() => {
                      const p = projeksiyonlar.find((x) => x.ad === seciliProjeksiyon)
                      if (!p) return null
                      return (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{p.yuklendi ? `${p.entitySayisi} entity` : 'Katalogda yok'}</span>
                          {katalogYukleyebilir && (
                            <Button size="sm" variant="outline" className="h-7" disabled={yukleniyor?.startsWith('yukle:')} onClick={() => katalogYukle(p.ad)}>
                              {yukleniyor === `yukle:${p.ad}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}{p.yuklendi ? 'Yenile' : 'Yükle'}
                            </Button>
                          )}
                        </div>
                      )
                    })()}
                    {seciliProjeksiyon && (
                      <>
                        <Input placeholder="Entity süz…" value={entityAra} onChange={(e) => setEntityAra(e.target.value)} className="h-8" />
                        {entityUyari && <div className="text-[11px] text-amber-700">{entityUyari}</div>}
                        <div className="max-h-64 overflow-y-auto border rounded">
                          {yukleniyor === 'entity' && <div className="p-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 inline animate-spin mr-1" />Yükleniyor…</div>}
                          {entityler.map((e) => (
                            <div key={e.entity}>
                              <button className={`w-full text-left px-2 py-1 flex items-center gap-1 hover:bg-muted ${seciliEntity?.entity === e.entity ? 'bg-muted font-medium' : ''}`}
                                onClick={() => setSeciliEntity(seciliEntity?.entity === e.entity ? null : e)}>
                                {seciliEntity?.entity === e.entity ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span className="flex-1 font-mono text-xs truncate">{e.entity}</span>
                                <span className="text-[11px] text-muted-foreground">{e.alanSayisi}</span>
                              </button>
                              {seciliEntity?.entity === e.entity && (
                                <div className="pl-5 pr-2 pb-2 space-y-1">
                                  {e.entitySetleri.length === 0
                                    ? <div className="text-[11px] text-amber-700">EntitySet adı bulunamadı — kaynak eklendikten sonra elle girin.</div>
                                    : e.entitySetleri.map((set) => (
                                      <Button key={set} size="sm" variant="outline" className="h-7 w-full justify-start font-mono text-xs" onClick={() => ifsKaynakEkle(e, set)}>
                                        <Plus className="h-3 w-3 mr-1" />{set}
                                      </Button>
                                    ))}
                                  {e.entitySetleri.length === 0 && (
                                    <Button size="sm" variant="outline" className="h-7 w-full justify-start text-xs" onClick={() => ifsKaynakEkle(e, e.entity + 's')}><Plus className="h-3 w-3 mr-1" />Kaynak olarak ekle</Button>
                                  )}
                                  <div className="max-h-40 overflow-y-auto text-[11px] font-mono text-muted-foreground">
                                    {katalogAlanlari.map((a) => <div key={a.alan}>{a.anahtarMi ? '🔑 ' : ''}{a.alan} <span className="opacity-60">{a.veriTipi}</span></div>)}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {seciliProjeksiyon && entityler.length === 0 && yukleniyor !== 'entity' && <div className="p-2 text-xs text-muted-foreground">Entity yok{katalogYukleyebilir ? ' — "Yükle" ile kataloğa alın' : ''}.</div>}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input placeholder="Tablo süz…" value={hubAra} onChange={(e) => setHubAra(e.target.value)} className="h-8" />
                    <div className="max-h-80 overflow-y-auto border rounded">
                      {filtreliTablolar.map((t) => (
                        <div key={t.ad}>
                          <button className={`w-full text-left px-2 py-1 flex items-center gap-1 hover:bg-muted ${seciliTablo === t.ad ? 'bg-muted font-medium' : ''}`} onClick={() => setSeciliTablo(seciliTablo === t.ad ? '' : t.ad)}>
                            {seciliTablo === t.ad ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <span className="flex-1 font-mono text-xs truncate">{t.ad}</span>
                            <span className="text-[11px] text-muted-foreground">{t.kolonSayisi}</span>
                          </button>
                          {seciliTablo === t.ad && (
                            <div className="pl-5 pr-2 pb-2 space-y-1">
                              <Button size="sm" variant="outline" className="h-7 w-full justify-start text-xs" onClick={() => hubKaynakEkle(t.ad)}><Plus className="h-3 w-3 mr-1" />Kaynak olarak ekle</Button>
                              <div className="max-h-40 overflow-y-auto text-[11px] font-mono text-muted-foreground">
                                {hubKolonlar.map((c) => <div key={c.ad}>{c.ad} <span className="opacity-60">{c.veriTipi}</span></div>)}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ORTA — Kaynaklar ve birleştirme */}
        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Kaynaklar <span className="text-muted-foreground font-normal text-sm">({kaynaklar.length})</span></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {kaynaklar.length === 0 && <p className="text-sm text-muted-foreground">Sol panelden bir entity veya tablo ekleyin. İlk kaynak taban kaynaktır; diğerleri ona birleştirilir.</p>}
              {kaynaklar.map((k, i) => {
                const acik = acikKaynak === k.ad
                const secenekler = kaynakAlanlari[k.ad] ?? []
                return (
                  <div key={i} className="border rounded-md">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button onClick={() => setAcikKaynak(acik ? null : k.ad)} className="text-muted-foreground">{acik ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                      <Input className="h-8 w-40 font-mono text-xs" value={k.ad} onChange={(e) => kaynakAdDegistir(i, e.target.value.replace(/[^A-Za-z0-9_]/g, ''))} title="Takma ad" />
                      <Badge variant="outline" className="font-normal">{k.tip === 'ifs-odata' ? 'IFS' : 'Hub'}</Badge>
                      <span className="font-mono text-xs truncate flex-1 text-muted-foreground">
                        {k.tip === 'ifs-odata' ? `${k.projeksiyon} › ${k.entitySet}` : (k.tasarim?.tablo ?? 'SQL')}
                        {' · '}{k.tip === 'ifs-odata' ? `${k.select?.length ?? 0} alan` : `${k.tasarim ? k.tasarim.alanlar.length || 'tüm' : '?'} kolon`}
                      </span>
                      {i === 0 && <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">taban</Badge>}
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => kaynakSil(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    {acik && (
                      <div className="border-t px-3 py-3 space-y-3 text-sm">
                        {k.tip === 'ifs-odata' ? (
                          <>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <div className="space-y-1"><Label className="text-xs">Projeksiyon</Label><Input className="h-8 font-mono text-xs" value={k.projeksiyon} onChange={(e) => kaynakGuncelle(i, (x) => ({ ...x, projeksiyon: e.target.value } as Kaynak))} /></div>
                              <div className="space-y-1"><Label className="text-xs">EntitySet</Label><Input className="h-8 font-mono text-xs" value={k.entitySet} onChange={(e) => kaynakGuncelle(i, (x) => ({ ...x, entitySet: e.target.value } as Kaynak))} /></div>
                              <div className="space-y-1"><Label className="text-xs">$top (≤5000)</Label><Input className="h-8" type="number" value={k.top ?? 500} onChange={(e) => kaynakGuncelle(i, (x) => ({ ...x, top: Number(e.target.value) || 500 } as Kaynak))} /></div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Alanlar ($select) — {k.select?.length ?? 0} seçili</Label>
                              {secenekler.length === 0 ? (
                                <Textarea className="font-mono text-xs" rows={2} value={(k.select ?? []).join(', ')} onChange={(e) => kaynakGuncelle(i, (x) => ({ ...x, select: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } as Kaynak))} placeholder="Katalog alan listesi yok — virgülle yazın" />
                              ) : (
                                <div className="max-h-44 overflow-y-auto border rounded p-2 grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1">
                                  {secenekler.map((a) => (
                                    <label key={a} className="flex items-center gap-1.5 font-mono text-xs cursor-pointer">
                                      <Checkbox checked={(k.select ?? []).includes(a)} onCheckedChange={(v) => ifsAlanToggle(i, a, v === true)} />{a}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Filtre (OData $filter, {'{p.ad}'} yer tutucusu)</Label>
                              <Textarea className="font-mono text-xs" rows={2} value={k.filtre ?? ''} onChange={(e) => kaynakGuncelle(i, (x) => ({ ...x, filtre: e.target.value } as Kaynak))} placeholder="Contract eq {p.contract} and RevisedDueDate ge {p.baslangic}" />
                            </div>
                          </>
                        ) : k.tasarim ? (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Kolonlar — {k.tasarim.alanlar.length || 'tümü'}</Label>
                              <div className="max-h-44 overflow-y-auto border rounded p-2 grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1">
                                {secenekler.map((a) => (
                                  <label key={a} className="flex items-center gap-1.5 font-mono text-xs cursor-pointer">
                                    <Checkbox checked={k.tasarim!.alanlar.includes(a)} onCheckedChange={(v) => hubTasarimGuncelle(i, (t) => ({ ...t, alanlar: v === true ? [...t.alanlar, a] : t.alanlar.filter((x) => x !== a) }))} />{a}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">WHERE (SQL, {'{p.ad}'} yer tutucusu → $n)</Label>
                              <Textarea className="font-mono text-xs" rows={2} value={k.tasarim.where ?? ''} onChange={(e) => hubTasarimGuncelle(i, (t) => ({ ...t, where: e.target.value }))} placeholder={'"createdAt" >= {p.baslangic} AND "ifsOrderNo" IS NOT NULL'} />
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground break-all">{k.sorgu}</div>
                          </>
                        ) : (
                          <div className="space-y-1">
                            <Label className="text-xs">SQL (ham; $1,$2… → parametreler: {(k.parametreler ?? []).join(', ') || '—'})</Label>
                            <Textarea className="font-mono text-xs" rows={4} value={k.sorgu} onChange={(e) => kaynakGuncelle(i, (x) => ({ ...x, sorgu: e.target.value } as Kaynak))} />
                            <Input className="h-8 font-mono text-xs" value={(k.parametreler ?? []).join(',')} onChange={(e) => kaynakGuncelle(i, (x) => ({ ...x, parametreler: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } as Kaynak))} placeholder="parametre adları: baslangic,bitis" />
                          </div>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => tumAlanlariEsle(k)}><Plus className="h-3 w-3 mr-1" />Alanlarını çıktıya ekle</Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Birleştirme</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={kaynaklar.length < 2} onClick={() => setBirlestir((l) => [...l, { sol: '', sag: '', tip: 'left' }])}><Plus className="h-3 w-3 mr-1" />Satır</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {birlestir.length === 0 && <p className="text-sm text-muted-foreground">{kaynaklar.length < 2 ? 'Birleştirme için en az iki kaynak gerekir.' : 'Her ek kaynak için bir satır: sol = daha önce birleşmiş kaynak alanı, sağ = eklenecek kaynağın alanı.'}</p>}
              {birlestir.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                  <NativeSelect className="h-8 text-xs font-mono" value={b.sol} onChange={(e) => setBirlestir((l) => l.map((x, j) => (j === i ? { ...x, sol: e.target.value } : x)))}>
                    <option value="">sol alan…</option>{tumYollar.map((y) => <option key={y} value={y}>{y}</option>)}
                  </NativeSelect>
                  <NativeSelect className="h-8 text-xs w-24" value={b.tip} onChange={(e) => setBirlestir((l) => l.map((x, j) => (j === i ? { ...x, tip: e.target.value as Birlestirme['tip'] } : x)))}>
                    <option value="left">left</option><option value="inner">inner</option>
                  </NativeSelect>
                  <NativeSelect className="h-8 text-xs font-mono" value={b.sag} onChange={(e) => setBirlestir((l) => l.map((x, j) => (j === i ? { ...x, sag: e.target.value } : x)))}>
                    <option value="">sağ alan…</option>{tumYollar.map((y) => <option key={y} value={y}>{y}</option>)}
                  </NativeSelect>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => setBirlestir((l) => l.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Çıktı alanları <span className="text-muted-foreground font-normal text-sm">({alanEslemeleri.length})</span></CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAlanEslemeleri((l) => [...l, { cikti: '', yol: '' }])}><Plus className="h-3 w-3 mr-1" />Alan</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {alanEslemeleri.length === 0 && <p className="text-sm text-muted-foreground">Raporda kullanılacak alanlar: çıktı adı ↔ kaynak.alan. Kaynak kartındaki "Alanlarını çıktıya ekle" ile toplu doldurabilirsiniz.</p>}
              {alanEslemeleri.map((e, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Input className="h-8 font-mono text-xs" value={e.cikti} placeholder="ciktiAdi" onChange={(ev) => setAlanEslemeleri((l) => l.map((x, j) => (j === i ? { ...x, cikti: ev.target.value.replace(/[^A-Za-z0-9_]/g, '') } : x)))} />
                  <NativeSelect className="h-8 text-xs font-mono" value={e.yol} onChange={(ev) => setAlanEslemeleri((l) => l.map((x, j) => (j === i ? { ...x, yol: ev.target.value } : x)))}>
                    <option value="">kaynak.alan…</option>{tumYollar.map((y) => <option key={y} value={y}>{y}</option>)}{e.yol && !tumYollar.includes(e.yol) && <option value={e.yol}>{e.yol}</option>}
                  </NativeSelect>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => setAlanEslemeleri((l) => l.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* SAĞ — Önizleme */}
        <Card className="xl:sticky xl:top-4 self-start max-h-[calc(100vh-6rem)] flex flex-col min-w-0">
          <CardHeader className="pb-2"><CardTitle className="text-base">Önizleme</CardTitle></CardHeader>
          <CardContent className="space-y-3 overflow-y-auto text-sm">
            {parametreAdlari.length > 0 ? (
              <div className="space-y-2">
                {parametreAdlari.map((p) => {
                  const v = paramDegerleri[p] ?? { tip: 'metin' as ParamTip, deger: '' }
                  const set = (y: Partial<typeof v>) => setParamDegerleri((m) => ({ ...m, [p]: { ...v, ...y } }))
                  return (
                    <div key={p} className="grid grid-cols-[1fr_auto] gap-1 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs font-mono">{'{p.' + p + '}'}</Label>
                        {v.tip === 'tarih'
                          ? <DateField id={`vs-p-${p}`} value={v.deger} onChange={(deger) => set({ deger })} takvim />
                          : <Input className="h-8" type={v.tip === 'sayi' ? 'number' : 'text'} value={v.deger} onChange={(e) => set({ deger: e.target.value })} />}
                      </div>
                      <NativeSelect className="h-8 w-24 text-xs" value={v.tip} onChange={(e) => set({ tip: e.target.value as ParamTip })}>
                        <option value="metin">metin</option><option value="sayi">sayı</option><option value="tarih">tarih</option>
                      </NativeSelect>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-xs text-muted-foreground">Parametre yok (filtrelerde {'{p.ad}'} kullanınca burada görünür).</p>}
            <Button onClick={onizle} disabled={onizleniyor || kaynaklar.length === 0} className="w-full" style={{ backgroundColor: NAVY }}>
              {onizleniyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Önizle (ilk 20 satır)
            </Button>
            {onizlemeHata && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 break-words">{onizlemeHata}</div>}
            {onizleme && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {onizleme.kaynakIstatistik.map((k) => <span key={k.ad} className="mr-2">{k.ad}: {k.satir} satır / {k.sureMs} ms</span>)}
                  <span>· birleşik {onizleme.toplamSatir} satır · {onizleme.toplamSureMs} ms</span>
                  {onizleme.not && <div className="text-[11px] mt-0.5">{onizleme.not}</div>}
                </div>
                {onizleme.satirlar.length === 0 ? <p className="text-xs text-muted-foreground">Satır dönmedi.</p> : (
                  <div className="overflow-auto border rounded max-h-[50vh]">
                    <table className="text-[11px] whitespace-nowrap">
                      <thead className="bg-muted sticky top-0"><tr>{onizlemeKolonlari.map((c) => <th key={c} className="px-2 py-1 text-left font-mono">{c}</th>)}</tr></thead>
                      <tbody>{onizleme.satirlar.map((s, i) => <tr key={i} className="border-t">{onizlemeKolonlari.map((c) => <td key={c} className="px-2 py-0.5 max-w-[200px] truncate" title={hucreMetni(s[c])}>{hucreMetni(s[c])}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
