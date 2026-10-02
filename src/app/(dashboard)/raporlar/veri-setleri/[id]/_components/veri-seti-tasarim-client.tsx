'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronDown, ChevronRight, Database, Download, List, Loader2, Maximize2, Pencil, Play, Plus, Save, Search, Sparkles, Trash2, X } from 'lucide-react'
import type { Birlestirme, Kaynak, KaynakIfs, KaynakPostgres, VeriSetiTanim } from '@/lib/rapor/tipler'
import { GeriRozet } from '../../../_components/rozet-link'
import { apiGet, apiGonder, hataListesi, hataMetni, hataYapisi } from '../../../_components/api'
import HataKutusu from '../../../_components/hata-kutusu'
import type { CevrilmisHata } from '@/lib/rapor/hata-cevir'
import { birlestirmeAnahtariMi, enIyiAnahtarEslesmesi, referansMi } from '@/lib/rapor/katalog-siniflama'

const NAVY = '#1B4F72'

// ── Tipler ──────────────────────────────────────────────────────────────

interface Props {
  katalogYukleyebilir: boolean
  mevcut?: { id: string; ad: string; aciklama: string; tanim: VeriSetiTanim; sablonSayisi: number }
}

interface Projeksiyon { ad: string; yuklendi: boolean; entitySayisi: number }
interface Entity { entity: string; alanSayisi: number; entitySetleri: string[]; etiket?: string | null }
interface KatalogAlan { alan: string; veriTipi: string; anahtarMi: boolean; etiket?: string | null }
interface HubTablo { ad: string; kolonSayisi: number }
interface HubKolon { ad: string; veriTipi: string }
interface AramaSonucu { kaynakAd: string; entity: string; alan: string; veriTipi: string; etiket?: string | null; entityEtiket?: string | null; entityAlanSayisi?: number }
interface AramaEntity { kaynakAd: string; entity: string; etiket: string | null; alanSayisi: number; etiketEslesme: boolean }
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

/** Tüm GET çağrıları ortak yardımcıdan geçer (405/HTML/boş yanıtta anlaşılır mesaj). */
const getJson = <T,>(url: string) => apiGet<T>(url)

/** "Contract eq 'X'" veya "Contract eq {p.x}" — parametreli hâl de site koşulu sayılır (mükerrer eklenmesin). */
const CONTRACT_RE = /(?:^|\s+and\s+)?\bContract\s+eq\s+('[^']*'|\{p\.[A-Za-z_][A-Za-z0-9_]*\})(?:\s+and\s+)?/i

/** Filtredeki "Contract eq '…'" koşulunu okur. */
function filtredekiSite(filtre: string | undefined): string {
  const v = CONTRACT_RE.exec(filtre ?? '')?.[1] ?? ''
  return v.startsWith("'") ? v.slice(1, -1) : v // '{p.x}' ham döner
}

/** Filtreden Contract koşulunu söküp (varsa) yeni site koşulunu başa "and" ile ekler; elle yazılanı korur. */
function filtreyeSiteUygula(filtre: string | undefined, site: string): string {
  let kalan = (filtre ?? '').replace(CONTRACT_RE, (m) => (/^\s+and\s+.*\s+and\s+$/i.test(m) ? ' and ' : '')).trim()
  kalan = kalan.replace(/^and\s+/i, '').replace(/\s+and$/i, '').trim()
  if (!site) return kalan
  return kalan ? `Contract eq '${site}' and ${kalan}` : `Contract eq '${site}'`
}

const FILTRE_ORNEKLERI = ["ObjState eq 'Released'", 'RevisedDueDate ge 2026-01-01', "PartNo eq 'X'"]

/** `$1,$2…` biçimli sorguyu {p.ad} yer tutucularına geri çevirir (kayıtlı ham-SQL kaynaklarını düzenlemek için). */
function sorgudanMetin(sorgu: string, parametreler: string[] | undefined): string {
  return sorgu.replace(/\$(\d+)/g, (m, n: string) => { const ad = parametreler?.[Number(n) - 1]; return ad ? `{p.${ad}}` : m })
}

/** Satır numaralı, monospace SQL kutusu (textarea; editör kütüphanesi yok). */
function SqlKutusu({ deger, onChange, placeholder }: { deger: string; onChange: (v: string) => void; placeholder?: string }) {
  const gutterRef = useRef<HTMLDivElement>(null)
  const satirSayisi = Math.max(6, deger.split('\n').length)
  return (
    <div className="flex rounded-md border border-input bg-background overflow-hidden font-mono text-xs">
      <div ref={gutterRef} className="select-none bg-muted/60 text-muted-foreground text-right px-2 py-1.5 overflow-hidden leading-5" aria-hidden>
        {Array.from({ length: satirSayisi }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea
        className="flex-1 min-h-[9rem] resize-y bg-transparent px-2 py-1.5 leading-5 outline-none whitespace-pre"
        rows={satirSayisi}
        spellCheck={false}
        value={deger}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop }}
      />
    </div>
  )
}

/** Alan seçim listesi: arama kutusu, seçililer daima üstte, sayaç + temizle. */
function AlanSecici({ secenekler, secili, onToggle, onTemizle }: { secenekler: string[]; secili: string[]; onToggle: (alan: string, secili: boolean) => void; onTemizle: () => void }) {
  const [ara, setAra] = useState('')
  const seciliSet = new Set(secili)
  const q = ara.trim().toLocaleLowerCase('tr-TR')
  const seciliListe = secenekler.filter((a) => seciliSet.has(a))
  const digerleri = secenekler.filter((a) => !seciliSet.has(a) && (!q || a.toLocaleLowerCase('tr-TR').includes(q)))
  const satir = (a: string) => (
    <label key={a} className="flex items-center gap-1.5 font-mono text-xs cursor-pointer">
      <Checkbox checked={seciliSet.has(a)} onCheckedChange={(v) => onToggle(a, v === true)} />{a}
    </label>
  )
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input className="h-8 text-xs" placeholder={`Alan ara… (${secenekler.length})`} value={ara} onChange={(e) => setAra(e.target.value)} />
        <span className="text-xs text-muted-foreground whitespace-nowrap">Seçili: {secili.length}</span>
        {secili.length > 0 && <button type="button" className="text-xs text-red-600 hover:underline whitespace-nowrap" onClick={onTemizle}>Seçimi temizle</button>}
      </div>
      <div className="max-h-56 overflow-y-auto border rounded p-2 space-y-2">
        {seciliListe.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1 pb-2 border-b">{seciliListe.map(satir)}</div>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1">
          {digerleri.map(satir)}
          {digerleri.length === 0 && <span className="text-xs text-muted-foreground col-span-3">{q ? 'Eşleşen alan yok' : 'Tüm alanlar seçili'}</span>}
        </div>
      </div>
    </div>
  )
}

const hucreMetni = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

// ── Bileşen ─────────────────────────────────────────────────────────────

export default function VeriSetiTasarimClient({ katalogYukleyebilir, mevcut }: Props) {
  const router = useRouter()

  // Üst
  const [ad, setAd] = useState(mevcut?.ad ?? '')
  const [aciklama, setAciklama] = useState(mevcut?.aciklama ?? '')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [kayitHata, setKayitHata] = useState<CevrilmisHata | null>(null)
  const [kayitHatalari, setKayitHatalari] = useState<string[]>([])
  const [kayitMesaj, setKayitMesaj] = useState<string | null>(null)

  // Orta — tanım
  const [kaynaklar, setKaynaklar] = useState<Kaynak[]>(mevcut?.tanim.kaynaklar ?? [])
  const [birlestir, setBirlestir] = useState<Birlestirme[]>(mevcut?.tanim.birlestir ?? [])
  const [alanEslemeleri, setAlanEslemeleri] = useState<AlanEsleme[]>(Object.entries(mevcut?.tanim.alanlar ?? {}).map(([cikti, yol]) => ({ cikti, yol })))
  /** kaynak takma adı → seçilebilir alan listesi (IFS katalog / Hub kolon). */
  const [kaynakAlanlari, setKaynakAlanlari] = useState<Record<string, string[]>>({})
  const [acikKaynak, setAcikKaynak] = useState<string | null>(null)
  /** Tek kaynakta takma ad kutusu gizli; "Gelişmiş" ile açılır. ≥2 kaynakta hep görünür. */
  const [gelismis, setGelismis] = useState(false)
  const [siteler, setSiteler] = useState<{ varsayilan: string; siteler: { contract: string; aciklama: string }[] }>({ varsayilan: '', siteler: [] })
  const [katalogAlanAra, setKatalogAlanAra] = useState('')
  /** Etiket düzenleme: hangi alan (sol panel) + geçici metin. */
  const [etiketDuzenle, setEtiketDuzenle] = useState<{ alan: string; metin: string } | null>(null)
  /** Değerler dialogu: hangi alan + satırlar (etiket kutuları). */
  const [degerlerAlani, setDegerlerAlani] = useState<{ entity: string; alan: string; alanEtiket: string | null } | null>(null)
  const [degerSatirlari, setDegerSatirlari] = useState<{ deger: string; etiket: string; kaynak: string; degisti?: boolean }[]>([])
  const [degerDurum, setDegerDurum] = useState<{ yukleniyor?: boolean; aiCalisiyor?: boolean; kaydediliyor?: boolean; hata?: CevrilmisHata | null; not?: string | null }>({})
  const [yeniDeger, setYeniDeger] = useState('')
  const [topluAi, setTopluAi] = useState<{ acik: boolean; calisiyor?: boolean; sonuc?: string | null }>({ acik: false })
  const [entityEtiketDuzenle, setEntityEtiketDuzenle] = useState<{ entity: string; metin: string } | null>(null)
  const [aramaEntityler, setAramaEntityler] = useState<AramaEntity[]>([])
  const [referansGoster, setReferansGoster] = useState(false)
  const [aramaReferansAcik, setAramaReferansAcik] = useState(false)
  const [onizlemeBuyuk, setOnizlemeBuyuk] = useState(false)
  /** AI Rapor'dan "veri setine ekle" ile gelindiyse üst bilgi şeridi (?ekle=kaynakAd|entity|alan). */
  const [oneriSerit, setOneriSerit] = useState<{ kaynakAd: string; entity: string; alan: string; raporId?: string; kod?: string; takma?: string; birlestirme?: string } | null>(null)
  const oneriUygulandi = useRef(false)

  // Sol — katalog
  const [arama, setArama] = useState('')
  const [aramaSonuclari, setAramaSonuclari] = useState<AramaSonucu[] | null>(null)
  const [kaynakTip, setKaynakTip] = useState<'ifs' | 'hub' | 'sql'>('ifs')
  /** SQL kaynağı deneme sonuçları (takma ad → sonuç). */
  const [sqlDeneme, setSqlDeneme] = useState<Record<string, { kolonlar: string[]; satirlar: Record<string, unknown>[]; toplamSatir: number; sureMs: number; uyari?: string; hata?: CevrilmisHata; calisiyor?: boolean }>>({})
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
  /** Listede olmayan (IFS'te yeni açılmış) projeksiyonu adıyla kataloğa çekmek için. */
  const [yeniProjeksiyon, setYeniProjeksiyon] = useState('')
  const [solHata, setSolHata] = useState<CevrilmisHata | null>(null)

  // Sağ — önizleme
  const [paramDegerleri, setParamDegerleri] = useState<Record<string, { tip: ParamTip; deger: string }>>({})
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null)
  const [onizlemeHata, setOnizlemeHata] = useState<CevrilmisHata | null>(null)
  const [onizleniyor, setOnizleniyor] = useState(false)

  // ── Katalog yükleme ───────────────────────────────────────────────────

  const projeksiyonlariYukle = useCallback(() => {
    getJson<{ projeksiyonlar: Projeksiyon[] }>('/api/raporlar/katalog/projeksiyonlar').then((d) => setProjeksiyonlar(d.projeksiyonlar)).catch((e) => setSolHata(hataYapisi(e)))
  }, [])
  useEffect(projeksiyonlariYukle, [projeksiyonlariYukle])
  useEffect(() => {
    getJson<{ tablolar: HubTablo[] }>('/api/raporlar/hub-tablolar').then((d) => setHubTablolar(d.tablolar)).catch((e) => setSolHata(hataYapisi(e)))
    getJson<{ varsayilan: string; siteler: { contract: string; aciklama: string }[] }>('/api/raporlar/katalog/siteler').then((d) => setSiteler({ varsayilan: d.varsayilan, siteler: d.siteler })).catch(() => {})
  }, [])

  useEffect(() => {
    if (!seciliProjeksiyon) { setEntityler([]); return }
    setYukleniyor('entity')
    setEntityUyari(null)
    getJson<{ entityler: Entity[]; uyari?: string }>(`/api/raporlar/katalog/entityler?projeksiyon=${encodeURIComponent(seciliProjeksiyon)}&ara=${encodeURIComponent(entityAra)}`)
      .then((d) => { setEntityler(d.entityler); setEntityUyari(d.uyari ?? null) })
      .catch((e) => setSolHata(hataYapisi(e)))
      .finally(() => setYukleniyor(null))
  }, [seciliProjeksiyon, entityAra])

  useEffect(() => {
    if (!seciliEntity || !seciliProjeksiyon) { setKatalogAlanlari([]); return }
    getJson<{ alanlar: KatalogAlan[] }>(`/api/raporlar/katalog/alanlar?projeksiyon=${encodeURIComponent(seciliProjeksiyon)}&entity=${encodeURIComponent(seciliEntity.entity)}`)
      .then((d) => setKatalogAlanlari(d.alanlar)).catch((e) => setSolHata(hataYapisi(e)))
  }, [seciliEntity, seciliProjeksiyon])

  useEffect(() => {
    if (!seciliTablo) { setHubKolonlar([]); return }
    getJson<{ kolonlar: HubKolon[] }>(`/api/raporlar/hub-tablolar?tablo=${encodeURIComponent(seciliTablo)}`).then((d) => setHubKolonlar(d.kolonlar)).catch((e) => setSolHata(hataYapisi(e)))
  }, [seciliTablo])

  // Arama (debounce)
  useEffect(() => {
    if (arama.trim().length < 2) { setAramaSonuclari(null); return }
    const t = setTimeout(() => {
      getJson<{ sonuclar: AramaSonucu[]; entityler: AramaEntity[] }>(`/api/raporlar/katalog/ara?q=${encodeURIComponent(arama.trim())}`).then((d) => { setAramaSonuclari(d.sonuclar); setAramaEntityler(d.entityler ?? []); setAramaReferansAcik(false) }).catch((e) => setSolHata(hataYapisi(e)))
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

  /**
   * IFS $metadata → katalog. `sec` ile yeni eklenen projeksiyon yüklenince seçili hale gelir
   * (listedekiler koddaki sabitten DEĞİL, katalogdan da geliyor; bir kez yüklemek kalıcı).
   */
  async function katalogYukle(projeksiyon: string, sec = false) {
    setYukleniyor(`yukle:${projeksiyon}`)
    setSolHata(null)
    try {
      await apiGonder('/api/raporlar/katalog/yukle', 'POST', { projeksiyon })
      projeksiyonlariYukle()
      if (sec) { setSeciliProjeksiyon(projeksiyon); setSeciliEntity(null); setYeniProjeksiyon('') }
      if (seciliProjeksiyon === projeksiyon) setEntityAra((s) => s + '')
    } catch (e) { setSolHata(hataYapisi(e)) }
    finally { setYukleniyor(null) }
  }

  // ── Kaynak işlemleri ──────────────────────────────────────────────────

  const kaynakAdlari = useMemo(() => new Set(kaynaklar.map((k) => k.ad)), [kaynaklar])

  function ifsKaynakEkle(entity: Entity, entitySet: string, secenek?: { projeksiyon?: string; ekAlan?: string }) {
    const takma = takmaAdUret(entity.entity, kaynakAdlari)
    const projeksiyon = secenek?.projeksiyon ?? seciliProjeksiyon
    const ekAlan = secenek?.ekAlan
    const uygula = (alanlar: KatalogAlan[]) => {
      // Alan listesi henüz yüklenmemişken eklenen kaynak listesiz kalmasın: liste gelince tamamla.
      setKaynakAlanlari((m) => ({ ...m, [takma]: alanlar.map((a) => a.alan) }))
      const contractVar = alanlar.some((a) => a.alan.toLowerCase() === 'contract')
      setKaynaklar((l) => l.map((x) => {
        if (x.ad !== takma || x.tip !== 'ifs-odata') return x
        const anahtarlar = alanlar.filter((a) => a.anahtarMi).map((a) => a.alan)
        const select = [...new Set([...anahtarlar, ...(x.select ?? []), ...(ekAlan ? [ekAlan] : [])])] // anahtarlar + varsa aramadan gelen alan
        const filtre = !x.filtre && contractVar && siteler.varsayilan ? `Contract eq '${siteler.varsayilan}'` : x.filtre
        return { ...x, select, filtre }
      }))
    }
    const k: KaynakIfs = { ad: takma, tip: 'ifs-odata', projeksiyon, entitySet, select: ekAlan ? [ekAlan] : [], top: 500 }
    setKaynaklar((l) => [...l, k])
    setAcikKaynak(takma)
    if (!secenek?.projeksiyon && katalogAlanlari.length) uygula(katalogAlanlari)
    else getJson<{ alanlar: KatalogAlan[] }>(`/api/raporlar/katalog/alanlar?projeksiyon=${encodeURIComponent(projeksiyon)}&entity=${encodeURIComponent(entity.entity)}`).then((d) => uygula(d.alanlar)).catch((e) => setSolHata(hataYapisi(e)))
  }

  /** Arama sonucundan doğrudan kaynak: EntitySet adı entityler ucundan ($metadata) çözülür, alan seçili gelir. */
  async function aramaSonucundanEkle(s: AramaSonucu) {
    setSolHata(null)
    try {
      const d = await getJson<{ entityler: Entity[] }>(`/api/raporlar/katalog/entityler?projeksiyon=${encodeURIComponent(s.kaynakAd)}&ara=${encodeURIComponent(s.entity)}`)
      const e = d.entityler.find((x) => x.entity === s.entity) ?? { entity: s.entity, alanSayisi: 0, entitySetleri: [] }
      const set = e.entitySetleri.find((x) => !x.startsWith('Reference_')) ?? e.entitySetleri[0] ?? `${s.entity}s`
      if (!e.entitySetleri.length) setSolHata({ baslik: 'EntitySet adı bulunamadı', agirlik: 'uyari', aciklama: `${s.kaynakAd} › ${s.entity} için $metadata'da set adı yok; '${set}' varsayıldı.`, cozum: 'Kaynak kartındaki "EntitySet" kutusundan doğru adı yazın (IFS listesinde Reference_ ile başlamayan set).', teknikDetay: `${s.kaynakAd} › ${s.entity}: entitySetleri boş` })
      ifsKaynakEkle(e, set, { projeksiyon: s.kaynakAd, ekAlan: s.alan || undefined })
      setKaynakTip('ifs'); setSeciliProjeksiyon(s.kaynakAd); setEntityAra(''); setSeciliEntity(e); setArama('')
    } catch (e) { setSolHata(hataYapisi(e)) }
  }

  /** Veri setinde hâlihazırda çekilen (kaynak takma adı, alan) çiftleri — otomatik birleştirme için. */
  const mevcutAlanCiftleri = useCallback(() => {
    const ciftler: { kaynak: string; alan: string }[] = []
    const gorulen = new Set<string>()
    const ekle = (kaynak: string, alan: string) => {
      const a = `${kaynak}.${alan}`
      if (gorulen.has(a)) return
      gorulen.add(a); ciftler.push({ kaynak, alan })
    }
    for (const k of kaynaklar) {
      if (k.tip === 'ifs-odata') for (const a of k.select ?? []) ekle(k.ad, a)
      else for (const a of k.tasarim?.alanlar ?? []) ekle(k.ad, a)
    }
    for (const e of alanEslemeleri) {
      const [kaynak, ...kalan] = e.yol.split('.')
      if (kaynak && kalan.length) ekle(kaynak, kalan.join('.'))
    }
    return ciftler
  }, [kaynaklar, alanEslemeleri])

  /**
   * AI Rapor önerisini uygular: entity'yi kaynak olarak ekler (anahtarlar + istenen alan seçili),
   * alanı çıktıya eşler ve ad eşleşmesi varsa birleştirme satırını ÖNERİR. Hiçbir şey KAYDEDİLMEZ.
   */
  async function oneriyiUygula(o: { kaynakAd: string; entity: string; alan: string }) {
    setSolHata(null)
    try {
      const [entityYanit, alanYanit] = await Promise.all([
        getJson<{ entityler: Entity[] }>(`/api/raporlar/katalog/entityler?projeksiyon=${encodeURIComponent(o.kaynakAd)}&ara=${encodeURIComponent(o.entity)}`),
        getJson<{ alanlar: KatalogAlan[] }>(`/api/raporlar/katalog/alanlar?projeksiyon=${encodeURIComponent(o.kaynakAd)}&entity=${encodeURIComponent(o.entity)}`),
      ])
      const e = entityYanit.entityler.find((x) => x.entity === o.entity) ?? { entity: o.entity, alanSayisi: 0, entitySetleri: [] }
      const entitySet = e.entitySetleri.find((x) => !x.startsWith('Reference_')) ?? e.entitySetleri[0] ?? `${o.entity}s`
      if (!e.entitySetleri.length) setSolHata({ baslik: 'EntitySet adı bulunamadı', agirlik: 'uyari', aciklama: `${o.kaynakAd} › ${o.entity} için $metadata'da set adı yok; '${entitySet}' varsayıldı.`, cozum: 'Kaynak kartındaki "EntitySet" kutusundan doğru adı yazın.', teknikDetay: `${o.kaynakAd} › ${o.entity}: entitySetleri boş` })

      const anahtarlar = alanYanit.alanlar.filter((a) => a.anahtarMi).map((a) => a.alan)
      // Otomatik birleştirmede site/şirket kolonları kullanılmaz (satır patlaması).
      const birlestirmeAdaylari = anahtarlar.filter(birlestirmeAnahtariMi)
      const secilen = [...new Set([...anahtarlar, ...(o.alan ? [o.alan] : [])])]
      const takma = takmaAdUret(o.entity, new Set(kaynaklar.map((k) => k.ad)))
      const contractVar = alanYanit.alanlar.some((a) => a.alan.toLowerCase() === 'contract')
      const yeni: KaynakIfs = {
        ad: takma, tip: 'ifs-odata', projeksiyon: o.kaynakAd, entitySet, select: secilen, top: 500,
        ...(contractVar && siteler.varsayilan ? { filtre: `Contract eq '${siteler.varsayilan}'` } : {}),
      }
      setKaynaklar((l) => [...l, yeni])
      setKaynakAlanlari((m) => ({ ...m, [takma]: alanYanit.alanlar.map((a) => a.alan) }))
      setAcikKaynak(takma)
      setKaynakTip('ifs'); setSeciliProjeksiyon(o.kaynakAd); setSeciliEntity(e); setEntityAra(''); setArama('')

      // Çıktı alanı: istenen alan rapora düşsün.
      if (o.alan) {
        setAlanEslemeleri((l) => {
          const yol = `${takma}.${o.alan}`
          if (l.some((x) => x.yol === yol)) return l
          const mevcutCikti = new Set(l.map((x) => x.cikti))
          let cikti = o.alan.replace(/[^A-Za-z0-9_]/g, '_')
          cikti = cikti[0].toLowerCase() + cikti.slice(1)
          if (mevcutCikti.has(cikti)) cikti = `${takma}_${cikti}`
          return [...l, { cikti, yol }]
        })
      }

      // Birleştirme önerisi: yeni kaynağın anahtarları ↔ mevcut alanlar (ad eşitliği/sonek).
      let birlestirmeMetni: string | undefined
      const mevcut = mevcutAlanCiftleri()
      for (const anahtar of birlestirmeAdaylari) {
        const es = enIyiAnahtarEslesmesi(mevcut, anahtar, o.entity)
        if (!es) continue
        const sol = `${es.kaynak}.${es.alan}`, sag = `${takma}.${anahtar}`
        setBirlestir((l) => (l.some((b) => b.sol === sol && b.sag === sag) ? l : [...l, { sol, sag, tip: 'left' as const }]))
        birlestirmeMetni = `${sol} ↔ ${sag}`
        break
      }
      setOneriSerit((s2) => (s2 ? { ...s2, takma, birlestirme: birlestirmeMetni } : s2))
    } catch (e) { setSolHata(hataYapisi(e)) }
  }

  // AI Rapor'dan gelen öneri bağlantısı: ?ekle=kaynakAd|entity|alan&rapor=<id>&kod=<kod>
  // (useSearchParams yerine window: Suspense sınırı gerektirmesin, tek seferlik okuma.)
  useEffect(() => {
    if (oneriUygulandi.current) return
    const p = new URLSearchParams(window.location.search)
    const ham = p.get('ekle')
    if (!ham) return
    const [kaynakAd, entity, alan] = ham.split('|')
    if (!kaynakAd || !entity) return
    oneriUygulandi.current = true
    setOneriSerit({ kaynakAd, entity, alan: alan ?? '', raporId: p.get('rapor') ?? undefined, kod: p.get('kod') ?? undefined })
    void oneriyiUygula({ kaynakAd, entity, alan: alan ?? '' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Katalog değerleri (rapor_katalog_deger) ───────────────────────────
  /** Alanın değerlerini aç: enum değerleri katalogdan gelir; yoksa elle eklenebilir. */
  async function degerleriAc(alan: string, alanEtiket: string | null) {
    if (!seciliEntity) return
    setDegerlerAlani({ entity: seciliEntity.entity, alan, alanEtiket })
    setDegerSatirlari([]); setYeniDeger(''); setDegerDurum({ yukleniyor: true })
    try {
      const d = await getJson<{ degerler: { deger: string; etiket: string | null; kaynak: string }[]; not?: string }>(`/api/raporlar/katalog/degerler?kaynakAd=${encodeURIComponent(seciliProjeksiyon)}&entity=${encodeURIComponent(seciliEntity.entity)}&alan=${encodeURIComponent(alan)}`)
      setDegerSatirlari(d.degerler.map((x) => ({ deger: x.deger, etiket: x.etiket ?? '', kaynak: x.kaynak })))
      setDegerDurum({ not: d.not ?? null })
    } catch (e) { setDegerDurum({ hata: hataYapisi(e) }) }
  }

  /** AI önerileri kutulara yazılır — KAYDEDİLMEZ. Elle düzeltilmiş (ELLE) satırların üzerine yazılmaz. */
  async function degerleriAiDoldur() {
    if (!degerlerAlani) return
    setDegerDurum((d) => ({ ...d, aiCalisiyor: true, hata: null }))
    try {
      const d = await apiGonder<{ cevriler?: Record<string, Record<string, string>>; not?: string }>('/api/raporlar/katalog/degerler/ai', 'POST', { kaynakAd: seciliProjeksiyon, entity: degerlerAlani.entity, alan: degerlerAlani.alan })
      const oneriler: Record<string, string> = d.cevriler?.[`${seciliProjeksiyon}|${degerlerAlani.entity}|${degerlerAlani.alan}`] ?? {}
      const sayi = Object.keys(oneriler).length
      setDegerSatirlari((l) => l.map((x) => (x.kaynak === 'ELLE' && x.etiket ? x : oneriler[x.deger] ? { ...x, etiket: oneriler[x.deger], kaynak: 'AI', degisti: true } : x)))
      setDegerDurum((s2) => ({ ...s2, aiCalisiyor: false, not: sayi ? `${sayi} öneri dolduruldu — kontrol edip Kaydet deyin.` : (d.not ?? 'Yeni öneri gelmedi.') }))
    } catch (e) { setDegerDurum((s2) => ({ ...s2, aiCalisiyor: false, hata: hataYapisi(e) })) }
  }

  async function degerleriKaydet() {
    if (!degerlerAlani) return
    setDegerDurum((d) => ({ ...d, kaydediliyor: true, hata: null }))
    try {
      const d = await apiGonder<{ degerler: { deger: string; etiket: string | null; kaynak: string }[] }>('/api/raporlar/katalog/degerler', 'PUT', {
        kaynakAd: seciliProjeksiyon, entity: degerlerAlani.entity, alan: degerlerAlani.alan, eksikleriSil: true,
        // Elle değiştirilen satır 'ELLE' olur → sonraki AI doldurmaları üzerine yazmaz.
        degerler: degerSatirlari.map((x) => ({ deger: x.deger, etiket: x.etiket.trim() || null, kaynak: x.degisti && x.kaynak !== 'AI' ? 'ELLE' : (x.kaynak as 'ENUM' | 'AI' | 'ELLE') })),
      })
      setDegerSatirlari(d.degerler.map((x) => ({ deger: x.deger, etiket: x.etiket ?? '', kaynak: x.kaynak })))
      setDegerDurum({ not: 'Kaydedildi.' })
    } catch (e) { setDegerDurum((s2) => ({ ...s2, kaydediliyor: false, hata: hataYapisi(e) })) }
    finally { setDegerDurum((s2) => ({ ...s2, kaydediliyor: false })) }
  }

  /** Veri setindeki TÜM IFS kaynaklarının enum alanları için tek seferde AI çevirisi (onaylı). */
  async function topluAiCalistir() {
    setTopluAi({ acik: true, calisiyor: true })
    try {
      // Kaynak takma adı → projeksiyon; alan adları çıktı eşlemesinden (kaynak.alan) türetilir.
      const hedefler: { kaynakAd: string; entity: string; alan: string }[] = []
      for (const k of kaynaklar) {
        if (k.tip !== 'ifs-odata') continue
        const e = await getJson<{ entityler: Entity[] }>(`/api/raporlar/katalog/entityler?projeksiyon=${encodeURIComponent(k.projeksiyon)}&ara=`)
        const entity = e.entityler.find((x) => x.entitySetleri.includes(k.entitySet))?.entity
        if (!entity) continue
        for (const alan of k.select ?? []) hedefler.push({ kaynakAd: k.projeksiyon, entity, alan })
      }
      if (!hedefler.length) { setTopluAi({ acik: true, calisiyor: false, sonuc: 'IFS kaynağı/alanı bulunamadı.' }); return }
      const d = await apiGonder<{ cevriler: Record<string, Record<string, string>>; gonderilenDeger?: number; atlanan?: number }>('/api/raporlar/katalog/degerler/ai', 'POST', { alanlar: hedefler.slice(0, 40) })
      // Öneriler doğrudan kaydedilir (toplu akışta tek tek onay pratik değil); kaynak='AI', ELLE satırlar korunur.
      let kaydedilen = 0
      for (const [anahtar, cevri] of Object.entries(d.cevriler)) {
        const [kaynakAd, entity, alan] = anahtar.split('|')
        const mevcut = await getJson<{ degerler: { deger: string; etiket: string | null; kaynak: string }[] }>(`/api/raporlar/katalog/degerler?kaynakAd=${encodeURIComponent(kaynakAd)}&entity=${encodeURIComponent(entity)}&alan=${encodeURIComponent(alan)}`)
        const govde = mevcut.degerler.map((x) => (x.kaynak === 'ELLE' && x.etiket ? { deger: x.deger, etiket: x.etiket, kaynak: 'ELLE' as const } : cevri[x.deger] ? { deger: x.deger, etiket: cevri[x.deger], kaynak: 'AI' as const } : { deger: x.deger, etiket: x.etiket, kaynak: (x.kaynak as 'ENUM' | 'AI' | 'ELLE') }))
        // Tek tek kaydet: biri patlarsa toplu akış sürsün, sayaç artmasın.
        try {
          await apiGonder('/api/raporlar/katalog/degerler', 'PUT', { kaynakAd, entity, alan, degerler: govde })
          kaydedilen += Object.keys(cevri).length
        } catch { /* bu alan atlandı */ }
      }
      setTopluAi({ acik: true, calisiyor: false, sonuc: `${kaydedilen} değer etiketlendi (${d.gonderilenDeger ?? 0} gönderildi, ${d.atlanan ?? 0} atlandı).` })
    } catch (e) { setTopluAi({ acik: true, calisiyor: false, sonuc: hataMetni(e) }) }
  }

  /** Türkçe etiket kaydet (rapor.katalog). Boş → siler. */
  async function etiketKaydet(alan: string, etiket: string) {
    setEtiketDuzenle(null)
    try {
      const d = await apiGonder<{ etiket: string | null }>('/api/raporlar/katalog/etiket', 'PATCH', { kaynakAd: seciliProjeksiyon, entity: seciliEntity?.entity, alan, etiket: etiket.trim() || null })
      setKatalogAlanlari((l) => l.map((a) => (a.alan === alan ? { ...a, etiket: d.etiket } : a)))
    } catch (e) { setSolHata(hataYapisi(e)) }
  }

  /** Entity Türkçe etiketi kaydet (rapor.katalog). Boş → siler. */
  async function entityEtiketKaydet(entity: string, etiket: string) {
    setEntityEtiketDuzenle(null)
    try {
      const d = await apiGonder<{ etiket: string | null }>('/api/raporlar/katalog/entity-etiket', 'PATCH', { kaynakAd: seciliProjeksiyon, entity, etiket: etiket.trim() || null })
      setEntityler((l) => l.map((e) => (e.entity === entity ? { ...e, etiket: d.etiket } : e)))
    } catch (e) { setSolHata(hataYapisi(e)) }
  }

  /** Arama sonuçları entity'ye göre gruplu; sıra: etiket eşleşmesi → ana tablo (referans değil) → alan sayısı. */
  const aramaGruplari = useMemo(() => {
    if (!aramaSonuclari) return null
    type Grup = { kaynakAd: string; entity: string; etiket: string | null; alanSayisi: number; etiketEslesme: boolean; referans: boolean; alanlar: AramaSonucu[] }
    const m = new Map<string, Grup>()
    for (const e of aramaEntityler) m.set(`${e.kaynakAd}|${e.entity}`, { ...e, referans: referansMi(e.entity), alanlar: [] })
    for (const s of aramaSonuclari) {
      const k = `${s.kaynakAd}|${s.entity}`
      const g = m.get(k) ?? { kaynakAd: s.kaynakAd, entity: s.entity, etiket: s.entityEtiket ?? null, alanSayisi: s.entityAlanSayisi ?? 0, etiketEslesme: false, referans: referansMi(s.entity), alanlar: [] }
      g.alanlar.push(s); m.set(k, g)
    }
    const sirala = (a: Grup, b: Grup) => Number(b.etiketEslesme) - Number(a.etiketEslesme) || b.alanlar.length - a.alanlar.length || b.alanSayisi - a.alanSayisi || a.entity.localeCompare(b.entity)
    const hepsi = [...m.values()]
    return { ana: hepsi.filter((g) => !g.referans).sort(sirala), referans: hepsi.filter((g) => g.referans).sort(sirala) }
  }, [aramaSonuclari, aramaEntityler])

  function hubKaynakEkle(tablo: string) {
    const takma = takmaAdUret(tablo, kaynakAdlari)
    const tasarim = { tablo, alanlar: [] as string[], where: '' }
    const { sorgu, parametreler } = postgresSorgu(tasarim)
    const k: KaynakPostgres = { ad: takma, tip: 'postgres', sorgu, parametreler, tasarim }
    setKaynaklar((l) => [...l, k])
    setKaynakAlanlari((m) => ({ ...m, [takma]: hubKolonlar.map((c) => c.ad) }))
    setAcikKaynak(takma)
  }

  function sqlKaynakEkle() {
    const takma = takmaAdUret('sorgu', kaynakAdlari)
    const sqlMetin = 'SELECT\n  \nFROM \nWHERE '
    const { sql, parametreler } = whereDerle(sqlMetin)
    const k: KaynakPostgres = { ad: takma, tip: 'postgres', sorgu: sql, parametreler, sqlMetin }
    setKaynaklar((l) => [...l, k])
    setAcikKaynak(takma)
  }

  /** SQL metni değişince {p.x} → $n çevrilip sorgu + parametreler türetilir (Hub WHERE ile aynı fonksiyon). */
  function sqlMetinGuncelle(i: number, sqlMetin: string) {
    kaynakGuncelle(i, (k) => {
      if (k.tip !== 'postgres') return k
      const { sql, parametreler } = whereDerle(sqlMetin)
      return { ...k, sqlMetin, sorgu: sql, parametreler }
    })
  }

  /** "Sorguyu dene": READ ONLY + 30 sn korumalı uçta ilk 20 satır; dönen kolonlar kaynağın alan listesi olur. */
  async function sqlDene(k: KaynakPostgres) {
    setSqlDeneme((m) => ({ ...m, [k.ad]: { ...(m[k.ad] ?? { kolonlar: [], satirlar: [], toplamSatir: 0, sureMs: 0 }), calisiyor: true, hata: undefined } }))
    try {
      const degerler = Object.fromEntries((k.parametreler ?? []).map((p) => [p, paramDegerleri[p] ?? { tip: 'metin', deger: '' }]))
      const d = await apiGonder<{ kolonlar: string[]; satirlar: Record<string, unknown>[]; toplamSatir: number; sureMs: number; uyari?: string }>('/api/raporlar/veri-setleri/sql-dene', 'POST', { sorgu: k.sorgu, parametreler: k.parametreler ?? [], degerler })
      setSqlDeneme((m) => ({ ...m, [k.ad]: { kolonlar: d.kolonlar, satirlar: d.satirlar, toplamSatir: d.toplamSatir, sureMs: d.sureMs, uyari: d.uyari } }))
      if (d.kolonlar.length) setKaynakAlanlari((m) => ({ ...m, [k.ad]: d.kolonlar }))
    } catch (e) {
      setSqlDeneme((m) => ({ ...m, [k.ad]: { ...(m[k.ad] ?? { kolonlar: [], satirlar: [], toplamSatir: 0, sureMs: 0 }), calisiyor: false, hata: hataYapisi(e) } }))
    }
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
      const d = await apiGonder<{ veriSeti: { id: string } }>(
        mevcut ? `/api/raporlar/veri-setleri/${mevcut.id}` : '/api/raporlar/veri-setleri',
        mevcut ? 'PUT' : 'POST',
        { ad, aciklama, tanim },
      )
      setKayitMesaj('Kaydedildi')
      if (!mevcut) router.replace(`/raporlar/veri-setleri/${d.veriSeti.id}`)
    } catch (e) { setKayitHata(hataYapisi(e)); setKayitHatalari(hataListesi(e)) }
    finally { setKaydediliyor(false) }
  }

  async function onizle() {
    setOnizleniyor(true)
    setOnizlemeHata(null)
    try {
      const parametreler = Object.fromEntries(parametreAdlari.map((p) => [p, paramDegerleri[p] ?? { tip: 'metin', deger: '' }]))
      const d = await apiGonder<Onizleme>('/api/raporlar/veri-setleri/onizle', 'POST', { tanim, parametreler })
      setOnizleme(d)
    } catch (e) { setOnizleme(null); setOnizlemeHata(hataYapisi(e)) }
    finally { setOnizleniyor(false) }
  }

  const onizlemeKolonlari = useMemo(() => (onizleme?.satirlar.length ? Object.keys(onizleme.satirlar[0]) : []), [onizleme])
  const filtreliTablolar = useMemo(() => hubTablolar.filter((t) => !hubAra || t.ad.toLowerCase().includes(hubAra.toLowerCase())), [hubTablolar, hubAra])

  /** Tek arama grubu: entity başlığı (etiket, alan sayısı, projeksiyon) + eşleşen alanlar. */
  const aramaGrubu = (g: { kaynakAd: string; entity: string; etiket: string | null; alanSayisi: number; etiketEslesme: boolean; alanlar: AramaSonucu[] }) => (
    <div key={`${g.kaynakAd}|${g.entity}`} className={`border rounded ${g.etiketEslesme ? 'border-[#1B4F72]/50' : ''}`}>
      <button type="button" className="w-full text-left px-2 py-1.5 bg-muted/60 hover:bg-muted flex items-center gap-2" title="Entity'yi kaynak olarak ekle (anahtar alanlarla)"
        onClick={() => aramaSonucundanEkle({ kaynakAd: g.kaynakAd, entity: g.entity, alan: '', veriTipi: '' })}>
        <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs font-medium">{g.entity}</span>
        {g.etiket && <span className="text-xs text-[#1B4F72] font-medium">— {g.etiket}</span>}
        <span className="text-[10px] text-muted-foreground">{g.alanSayisi || g.alanlar.length} alan</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{g.kaynakAd}</span>
      </button>
      {g.alanlar.map((s, i) => (
        <button key={i} className="w-full text-left px-2 py-1 hover:bg-muted flex items-center gap-1.5 border-t" title="Bu entity'yi kaynak olarak ekle, alan seçili gelsin" onClick={() => aramaSonucundanEkle(s)}>
          <span className="w-3" />
          <span className="font-mono text-xs">{s.alan}{s.etiket ? <span className="font-sans text-muted-foreground"> — {s.etiket}</span> : null}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">{s.veriTipi}</span>
        </button>
      ))}
    </div>
  )

  // ── Görünüm ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* AI Rapor önerisinden gelindi (?ekle=…) — hiçbir şey kaydedilmedi, kullanıcı Kaydet'e basacak */}
      {oneriSerit && (
        <div className="rounded-md border border-[#2AA5C7]/50 bg-[#F2F9FC] px-4 py-3 text-sm text-[#1B4F72] flex flex-wrap items-center gap-x-3 gap-y-1">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>
            <b>{oneriSerit.kod ?? 'Rapor'}</b> raporundan geldin:{' '}
            {oneriSerit.takma
              ? <><span className="font-mono">{oneriSerit.entity}.{oneriSerit.alan}</span> alanı <span className="font-mono">{oneriSerit.takma}</span> kaynağı olarak eklendi{oneriSerit.birlestirme ? <> ve <span className="font-mono">{oneriSerit.birlestirme}</span> birleştirmesi önerildi</> : ' (birleştirme satırını elle kurman gerekebilir)'}. <b>Kaydet</b>&apos;e bas ve rapora dön.</>
              : <>öneri uygulanıyor…</>}
          </span>
          {oneriSerit.raporId && (
            <a href={`/raporlar/${oneriSerit.raporId}`} className="ml-auto inline-flex items-center gap-1 font-medium hover:underline">
              Rapora dön<ChevronRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
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
      <HataKutusu hata={kayitHata} maddeler={kayitHatalari} />

      <div className={`grid gap-4 ${aramaGruplari ? 'xl:grid-cols-[640px_1fr_380px]' : 'xl:grid-cols-[300px_1fr_380px]'}`}>
        {/* SOL — Katalog */}
        <Card className="xl:sticky xl:top-4 self-start max-h-[calc(100vh-6rem)] flex flex-col">
          <CardHeader className="pb-2"><CardTitle className="text-base">Veri kataloğu</CardTitle></CardHeader>
          <CardContent className="space-y-3 overflow-y-auto text-sm">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-3 text-muted-foreground" />
              <Input className="pl-8" placeholder="Alan / entity ara (≥2 harf)" value={arama} onChange={(e) => setArama(e.target.value)} />
            </div>
            {solHata && (
              <div className="relative">
                <HataKutusu hata={solHata} kucuk />
                <button type="button" className="absolute right-1.5 top-1.5 opacity-60 hover:opacity-100" title="Kapat" onClick={() => setSolHata(null)}><X className="h-3 w-3" /></button>
              </div>
            )}

            {aramaGruplari ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">{aramaGruplari.ana.length} ana tablo · {aramaGruplari.referans.length} referans · {aramaSonuclari?.length ?? 0} alan{(aramaSonuclari?.length ?? 0) >= 200 && ' (ilk 200)'} — alan adı/etiketi ve entity adı/etiketinde arandı</div>
                {aramaGruplari.ana.length === 0 && aramaGruplari.referans.length === 0 && <div className="text-xs text-muted-foreground">Sonuç yok.</div>}
                {aramaGruplari.ana.map((g) => aramaGrubu(g))}
                {aramaGruplari.referans.length > 0 && (
                  <div className="border rounded border-dashed">
                    <button type="button" className="w-full text-left px-2 py-1.5 text-xs flex items-center gap-1 text-muted-foreground hover:bg-muted" onClick={() => setAramaReferansAcik((a) => !a)}>
                      {aramaReferansAcik ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      Referans tabloları ({aramaGruplari.referans.length}) — Lov/Virtual/Query, ana veri tablosu değil
                    </button>
                    {aramaReferansAcik && <div className="p-2 space-y-2">{aramaGruplari.referans.map((g) => aramaGrubu(g))}</div>}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex gap-1">
                  <Button size="sm" variant={kaynakTip === 'ifs' ? 'default' : 'outline'} onClick={() => setKaynakTip('ifs')} style={kaynakTip === 'ifs' ? { backgroundColor: NAVY } : undefined}>IFS</Button>
                  <Button size="sm" variant={kaynakTip === 'hub' ? 'default' : 'outline'} onClick={() => setKaynakTip('hub')} style={kaynakTip === 'hub' ? { backgroundColor: NAVY } : undefined}>Hub tabloları</Button>
                  <Button size="sm" variant={kaynakTip === 'sql' ? 'default' : 'outline'} onClick={() => setKaynakTip('sql')} style={kaynakTip === 'sql' ? { backgroundColor: NAVY } : undefined}>SQL</Button>
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
                    {katalogYukleyebilir && (
                      <div className="rounded border border-dashed border-slate-200 p-2 space-y-1">
                        <p className="text-[11px] text-muted-foreground m-0">
                          Listede yok mu? IFS&apos;teki projeksiyon adını yazıp ekle — bir kez yüklenir, sonra listede kalır.
                        </p>
                        <div className="flex gap-1">
                          <Input
                            placeholder="ör. ShopOrderOperationsHandling" value={yeniProjeksiyon} className="h-8 text-xs"
                            onChange={(e) => setYeniProjeksiyon(e.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
                            onKeyDown={(e) => { if (e.key === 'Enter' && yeniProjeksiyon) { e.preventDefault(); katalogYukle(yeniProjeksiyon, true) } }}
                          />
                          <Button
                            size="sm" variant="outline" className="h-8 shrink-0"
                            disabled={!yeniProjeksiyon || !!yukleniyor?.startsWith('yukle:')}
                            onClick={() => katalogYukle(yeniProjeksiyon, true)}
                          >
                            {yukleniyor === `yukle:${yeniProjeksiyon}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}Ekle
                          </Button>
                        </div>
                      </div>
                    )}
                    {seciliProjeksiyon && (
                      <>
                        <Input placeholder="Entity süz…" value={entityAra} onChange={(e) => setEntityAra(e.target.value)} className="h-8" />
                        {entityUyari && <div className="text-[11px] text-amber-700">{entityUyari}</div>}
                        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                          <Checkbox checked={referansGoster} onCheckedChange={(v) => setReferansGoster(v === true)} />
                          Referans tablolarını göster ({entityler.filter((e) => referansMi(e.entity, e.entitySetleri)).length})
                        </label>
                        <div className="max-h-64 overflow-y-auto border rounded">
                          {yukleniyor === 'entity' && <div className="p-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 inline animate-spin mr-1" />Yükleniyor…</div>}
                          {entityler.filter((e) => referansGoster || !referansMi(e.entity, e.entitySetleri) || seciliEntity?.entity === e.entity).map((e) => (
                            <div key={e.entity} className="group/entity">
                              <div className={`flex items-center gap-1 pr-1 hover:bg-muted ${seciliEntity?.entity === e.entity ? 'bg-muted font-medium' : ''}`}>
                                <button className="flex-1 min-w-0 text-left px-2 py-1 flex items-center gap-1" onClick={() => setSeciliEntity(seciliEntity?.entity === e.entity ? null : e)}>
                                  {seciliEntity?.entity === e.entity ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                  {entityEtiketDuzenle?.entity === e.entity ? (
                                    <input autoFocus className="h-6 flex-1 rounded border px-1 text-[11px]" value={entityEtiketDuzenle.metin} placeholder="Türkçe etiket" onClick={(ev) => ev.stopPropagation()} onChange={(ev) => setEntityEtiketDuzenle({ entity: e.entity, metin: ev.target.value })}
                                      onKeyDown={(ev) => { if (ev.key === 'Enter') entityEtiketKaydet(e.entity, entityEtiketDuzenle.metin); if (ev.key === 'Escape') setEntityEtiketDuzenle(null) }} onBlur={() => entityEtiketKaydet(e.entity, entityEtiketDuzenle.metin)} />
                                  ) : (
                                    <span className="flex-1 min-w-0 truncate text-xs"><span className="font-mono">{e.entity}</span>{e.etiket ? <span className="text-[#1B4F72]"> — {e.etiket}</span> : null}</span>
                                  )}
                                  <span className="text-[11px] text-muted-foreground">{e.alanSayisi}</span>
                                </button>
                                {katalogYukleyebilir && entityEtiketDuzenle?.entity !== e.entity && (
                                  <button type="button" className="opacity-0 group-hover/entity:opacity-100 text-muted-foreground hover:text-foreground shrink-0" title="Entity Türkçe etiketi" onClick={() => setEntityEtiketDuzenle({ entity: e.entity, metin: e.etiket ?? '' })}><Pencil className="h-3 w-3" /></button>
                                )}
                              </div>
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
                                  {katalogAlanlari.length > 12 && <Input className="h-7 text-xs" placeholder={`Alan ara… (${katalogAlanlari.length})`} value={katalogAlanAra} onChange={(ev) => setKatalogAlanAra(ev.target.value)} />}
                                  <div className="max-h-40 overflow-y-auto text-[11px] font-mono text-muted-foreground">
                                    {katalogAlanlari.filter((a) => { const q = katalogAlanAra.trim().toLocaleLowerCase('tr-TR'); return !q || a.alan.toLocaleLowerCase('tr-TR').includes(q) || (a.etiket ?? '').toLocaleLowerCase('tr-TR').includes(q) }).map((a) => (
                                      <div key={a.alan} className="flex items-center gap-1 group/alan">
                                        {etiketDuzenle?.alan === a.alan ? (
                                          <input autoFocus className="h-6 flex-1 rounded border px-1 text-[11px] font-sans" value={etiketDuzenle.metin} placeholder="Türkçe etiket" onChange={(ev) => setEtiketDuzenle({ alan: a.alan, metin: ev.target.value })}
                                            onKeyDown={(ev) => { if (ev.key === 'Enter') etiketKaydet(a.alan, etiketDuzenle.metin); if (ev.key === 'Escape') setEtiketDuzenle(null) }} onBlur={() => etiketKaydet(a.alan, etiketDuzenle.metin)} />
                                        ) : (
                                          <span className="truncate flex-1">{a.anahtarMi ? '🔑 ' : ''}{a.alan}{a.etiket ? <span className="font-sans text-slate-600"> — {a.etiket}</span> : null} <span className="opacity-60">{a.veriTipi}</span></span>
                                        )}
                                        {katalogYukleyebilir && etiketDuzenle?.alan !== a.alan && (
                                          <>
                                            <button type="button" className="opacity-0 group-hover/alan:opacity-100 text-muted-foreground hover:text-foreground shrink-0" title="Türkçe etiket" onClick={() => setEtiketDuzenle({ alan: a.alan, metin: a.etiket ?? '' })}><Pencil className="h-3 w-3" /></button>
                                            <button type="button" className="opacity-0 group-hover/alan:opacity-100 text-muted-foreground hover:text-foreground shrink-0" title="Değerler ve Türkçe karşılıkları" onClick={() => degerleriAc(a.alan, a.etiket ?? null)}><List className="h-3 w-3" /></button>
                                          </>
                                        )}
                                      </div>
                                    ))}
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
                ) : kaynakTip === 'sql' ? (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <Button size="sm" variant="outline" className="h-8 w-full justify-start text-xs" onClick={sqlKaynakEkle}><Plus className="h-3 w-3 mr-1" />SQL sorgusu ekle</Button>
                    <p>Hub Postgres üzerinde serbest SELECT/WITH sorgusu. <span className="font-mono">{'{p.ad}'}</span> yer tutucuları parametreye dönüşür; sorgu salt okuma işleminde, 30 sn sınırıyla koşar.</p>
                    <p>Dönen kolonlar "Sorguyu dene" sonrası kaynağın alan listesi olur (birleştirme ve çıktı alanlarında seçilebilir).</p>
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
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Kaynaklar <span className="text-muted-foreground font-normal text-sm">({kaynaklar.length})</span></CardTitle>
              {katalogYukleyebilir && kaynaklar.some((k) => k.tip === 'ifs-odata') && (
                <Button size="sm" variant="outline" className="h-7 text-xs" title="Seçili alanların katalog değerlerini AI ile Türkçeleştir" onClick={() => setTopluAi({ acik: true })}><Sparkles className="h-3 w-3 mr-1" />Tümünü AI ile doldur</Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {kaynaklar.length === 0 && <p className="text-sm text-muted-foreground">Sol panelden bir entity veya tablo ekleyin. İlk kaynak taban kaynaktır; diğerleri ona birleştirilir.</p>}
              {kaynaklar.map((k, i) => {
                const acik = acikKaynak === k.ad
                const secenekler = kaynakAlanlari[k.ad] ?? []
                return (
                  <div key={i} className="border rounded-md">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button onClick={() => setAcikKaynak(acik ? null : k.ad)} className="text-muted-foreground">{acik ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                      {(kaynaklar.length > 1 || gelismis) ? (
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs whitespace-nowrap" htmlFor={`takma-${i}`}>Takma ad</Label>
                          <Input id={`takma-${i}`} className="h-8 w-36 font-mono text-xs" value={k.ad} onChange={(e) => kaynakAdDegistir(i, e.target.value.replace(/[^A-Za-z0-9_]/g, ''))} title="Birleştirmede bu kaynağa verilen kısa isim" />
                          <span className="text-[11px] text-muted-foreground hidden lg:inline">Birleştirmede bu kaynağa verilen kısa isim</span>
                        </div>
                      ) : (
                        <button type="button" className="text-[11px] text-muted-foreground hover:underline whitespace-nowrap" onClick={() => setGelismis(true)} title={`Takma ad: ${k.ad}`}>Gelişmiş</button>
                      )}
                      <Badge variant="outline" className="font-normal">{k.tip === 'ifs-odata' ? 'IFS' : 'Hub'}</Badge>
                      <span className="font-mono text-xs truncate flex-1 text-muted-foreground">
                        {k.tip === 'ifs-odata' ? `${k.projeksiyon} › ${k.entitySet}` : (k.tasarim?.tablo ?? 'SQL')}
                        {' · '}{k.tip === 'ifs-odata' ? `${k.select?.length ?? 0} alan` : k.tasarim ? `${k.tasarim.alanlar.length || 'tüm'} kolon` : `${kaynakAlanlari[k.ad]?.length ?? '?'} kolon`}
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
                                <AlanSecici secenekler={secenekler} secili={k.select ?? []} onToggle={(a, v) => ifsAlanToggle(i, a, v)} onTemizle={() => kaynakGuncelle(i, (x) => ({ ...x, select: [] } as Kaynak))} />
                              )}
                            </div>
                            {(secenekler.length === 0 || secenekler.some((a) => a.toLowerCase() === 'contract')) && (
                              <div className="space-y-1">
                                <Label className="text-xs">IFS Site (Contract)</Label>
                                <NativeSelect className="h-8 text-xs w-64" value={filtredekiSite(k.filtre)} onChange={(e) => kaynakGuncelle(i, (x) => ({ ...x, filtre: filtreyeSiteUygula((x as KaynakIfs).filtre, e.target.value) } as Kaynak))}>
                                  <option value="">Tümü (site filtresi yok)</option>
                                  {siteler.siteler.map((st) => <option key={st.contract} value={st.contract}>{st.contract}{st.aciklama ? ` — ${st.aciklama}` : ''}{st.contract === siteler.varsayilan ? ' (varsayılan)' : ''}</option>)}
                                  {filtredekiSite(k.filtre) && !siteler.siteler.some((st) => st.contract === filtredekiSite(k.filtre)) && <option value={filtredekiSite(k.filtre)}>{filtredekiSite(k.filtre).startsWith('{') ? `Parametre: ${filtredekiSite(k.filtre)}` : filtredekiSite(k.filtre)}</option>}
                                </NativeSelect>
                              </div>
                            )}
                            <div className="space-y-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <Label className="text-xs">Filtre ($filter, {'{p.ad}'} yer tutucusu)</Label>
                                <span className="text-[11px] text-amber-700">OData sözdizimi (SQL değil)</span>
                              </div>
                              <Textarea className="font-mono text-xs" rows={2} value={k.filtre ?? ''} onChange={(e) => kaynakGuncelle(i, (x) => ({ ...x, filtre: e.target.value } as Kaynak))} placeholder="Contract eq {p.contract} and RevisedDueDate ge {p.baslangic}" />
                              <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-1">
                                Örnek (tıklayınca eklenir):
                                {FILTRE_ORNEKLERI.map((o, oi) => (
                                  <span key={o}>{oi > 0 && ' · '}<button type="button" className="font-mono hover:underline" onClick={() => kaynakGuncelle(i, (x) => { const f = ((x as KaynakIfs).filtre ?? '').trim(); return { ...x, filtre: f ? `${f} and ${o}` : o } as Kaynak })}>{o}</button></span>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : k.tasarim ? (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Kolonlar — {k.tasarim.alanlar.length || 'tümü'}</Label>
                              <AlanSecici secenekler={secenekler} secili={k.tasarim.alanlar} onToggle={(a, v) => hubTasarimGuncelle(i, (t) => ({ ...t, alanlar: v ? [...t.alanlar, a] : t.alanlar.filter((x) => x !== a) }))} onTemizle={() => hubTasarimGuncelle(i, (t) => ({ ...t, alanlar: [] }))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">WHERE (SQL, {'{p.ad}'} yer tutucusu → $n)</Label>
                              <Textarea className="font-mono text-xs" rows={2} value={k.tasarim.where ?? ''} onChange={(e) => hubTasarimGuncelle(i, (t) => ({ ...t, where: e.target.value }))} placeholder={'"createdAt" >= {p.baslangic} AND "ifsOrderNo" IS NOT NULL'} />
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground break-all">{k.sorgu}</div>
                          </>
                        ) : (
                          <div className="space-y-2">
                            {(() => {
                              const metin = k.sqlMetin ?? sorgudanMetin(k.sorgu, k.parametreler)
                              const d = sqlDeneme[k.ad]
                              return (
                                <>
                                  <div className="flex items-baseline justify-between gap-2">
                                    <Label className="text-xs">SQL sorgusu ({'{p.ad}'} yer tutucusu → $n; parametreler: {(k.parametreler ?? []).join(', ') || '—'})</Label>
                                    <span className="text-[11px] text-muted-foreground">yalnız SELECT/WITH · tek ifade · salt okuma · 30 sn</span>
                                  </div>
                                  <SqlKutusu deger={metin} onChange={(v) => sqlMetinGuncelle(i, v)} placeholder={'SELECT "ifsOrderNo", SUM("qtyComplete")::int AS iyi\nFROM ipro_production_log\nWHERE "createdAt" >= {p.baslangic}\nGROUP BY 1'} />
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={d?.calisiyor} onClick={() => sqlDene(k)}>
                                      {d?.calisiyor ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}Sorguyu dene (ilk 20 satır)
                                    </Button>
                                    {(k.parametreler ?? []).length > 0 && <span className="text-[11px] text-muted-foreground">Parametre değerleri sağdaki Önizleme panelinden alınır.</span>}
                                    {d && !d.calisiyor && !d.hata && <span className="text-[11px] text-muted-foreground ml-auto">{d.toplamSatir} satır · {d.sureMs} ms · {d.kolonlar.length} kolon</span>}
                                  </div>
                                  <HataKutusu hata={d?.hata} kucuk />
                                  {d?.uyari && <div className="text-[11px] text-amber-700">{d.uyari}</div>}
                                  {d && d.kolonlar.length > 0 && (
                                    <>
                                      <div className="text-[11px] text-muted-foreground">Kolonlar (kaynağın alan listesi): <span className="font-mono">{d.kolonlar.join(', ')}</span></div>
                                      <div className="overflow-auto border rounded max-h-48">
                                        <table className="text-[11px] whitespace-nowrap">
                                          <thead className="bg-muted sticky top-0"><tr>{d.kolonlar.map((c) => <th key={c} className="px-2 py-1 text-left font-mono">{c}</th>)}</tr></thead>
                                          <tbody>{d.satirlar.map((s, ri) => <tr key={ri} className="border-t">{d.kolonlar.map((c) => <td key={c} className="px-2 py-0.5 max-w-[160px] truncate" title={hucreMetni(s[c])}>{hucreMetni(s[c])}</td>)}</tr>)}</tbody>
                                        </table>
                                      </div>
                                    </>
                                  )}
                                </>
                              )
                            })()}
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
            <HataKutusu hata={onizlemeHata} />
            {onizleme && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {onizleme.kaynakIstatistik.map((k) => <span key={k.ad} className="mr-2">{k.ad}: {k.satir} satır / {k.sureMs} ms</span>)}
                  <span>· birleşik {onizleme.toplamSatir} satır · {onizleme.toplamSureMs} ms</span>
                  {onizleme.not && <div className="text-[11px] mt-0.5">{onizleme.not}</div>}
                </div>
                {onizleme.satirlar.length === 0 ? <p className="text-xs text-muted-foreground">Satır dönmedi.</p> : (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setOnizlemeBuyuk(true)}><Maximize2 className="h-3.5 w-3.5 mr-1" />Büyüt ({onizleme.satirlar.length} satır · {onizlemeKolonlari.length} kolon)</Button>
                    <div className="overflow-auto border rounded max-h-[40vh]">
                      <table className="text-[11px] whitespace-nowrap">
                        <thead className="bg-muted sticky top-0"><tr>{onizlemeKolonlari.map((c) => <th key={c} className="px-2 py-1 text-left font-mono">{c}</th>)}</tr></thead>
                        <tbody>{onizleme.satirlar.map((s, i) => <tr key={i} className="border-t">{onizlemeKolonlari.map((c) => <td key={c} className="px-2 py-0.5 max-w-[160px] truncate" title={hucreMetni(s[c])}>{hucreMetni(s[c])}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                    {/* buraya taşındı: değerler dialogu bileşenin sonunda */}
                    <Dialog open={onizlemeBuyuk} onOpenChange={setOnizlemeBuyuk}>
                      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] flex flex-col p-4 gap-3">
                        <DialogHeader className="shrink-0">
                          <DialogTitle className="text-base">Önizleme — {onizleme.satirlar.length} satır (birleşik {onizleme.toplamSatir}) · {onizlemeKolonlari.length} kolon · {onizleme.toplamSureMs} ms</DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 min-h-0 overflow-auto border rounded">
                          <table className="text-xs whitespace-nowrap min-w-full">
                            <thead className="bg-muted sticky top-0 z-10">
                              <tr><th className="px-2 py-1.5 text-right text-muted-foreground w-10 border-b">#</th>{onizlemeKolonlari.map((c) => <th key={c} className="px-3 py-1.5 text-left font-mono border-b">{c}</th>)}</tr>
                            </thead>
                            <tbody>
                              {onizleme.satirlar.map((s, i) => (
                                <tr key={i} className="border-t hover:bg-muted/40">
                                  <td className="px-2 py-1 text-right text-muted-foreground tabular-nums">{i + 1}</td>
                                  {onizlemeKolonlari.map((c) => <td key={c} className="px-3 py-1 max-w-[420px] truncate" title={hucreMetni(s[c])}>{hucreMetni(s[c])}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Değerler dialogu: ham değer + Türkçe etiket; AI ile toplu doldur, elle düzelt, kaydet. */}
      <Dialog open={!!degerlerAlani} onOpenChange={(a) => { if (!a) { setDegerlerAlani(null); setDegerDurum({}) } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              Değerler — <span className="font-mono">{degerlerAlani?.entity}.{degerlerAlani?.alan}</span>
              {degerlerAlani?.alanEtiket ? <span className="text-muted-foreground font-normal"> · {degerlerAlani.alanEtiket}</span> : null}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">Etiket YALNIZ gösterimde kullanılır: tablo, grup başlığı, grafik, Excel ve PDF. Ham veri ve süzgeç değerleri değişmez.</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={degerDurum.aiCalisiyor || !degerSatirlari.length} onClick={degerleriAiDoldur}>
                {degerDurum.aiCalisiyor ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}AI ile doldur
              </Button>
              <span className="text-[11px] text-muted-foreground">Elle düzelttiğiniz satırların üzerine yazılmaz.</span>
              {degerDurum.not && <span className="ml-auto text-[11px] text-green-700">{degerDurum.not}</span>}
            </div>
            <HataKutusu hata={degerDurum.hata} />
            {degerDurum.yukleniyor ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Yükleniyor…</div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0"><tr><th className="text-left px-2 py-1 font-medium">Ham değer</th><th className="text-left px-2 py-1 font-medium">Türkçe etiket</th><th className="px-2 py-1 w-16 font-medium">Kaynak</th><th className="w-8" /></tr></thead>
                  <tbody>
                    {degerSatirlari.map((x, i) => (
                      <tr key={x.deger} className="border-t">
                        <td className="px-2 py-1 font-mono">{x.deger}</td>
                        <td className="px-1 py-0.5"><Input className="h-7 text-xs" value={x.etiket} placeholder="—" onChange={(e) => setDegerSatirlari((l) => l.map((y, j) => (j === i ? { ...y, etiket: e.target.value, degisti: true, kaynak: y.kaynak === 'AI' && e.target.value !== y.etiket ? 'ELLE' : y.kaynak } : y)))} /></td>
                        <td className="px-2 py-1 text-center"><span className={`text-[10px] rounded-full px-1.5 py-px border ${x.kaynak === 'ELLE' ? 'border-[#1B4F72] text-[#1B4F72]' : x.kaynak === 'AI' ? 'border-[#2AA5C7] text-[#2AA5C7]' : 'border-slate-300 text-slate-500'}`}>{x.kaynak}</span></td>
                        <td className="px-1"><button type="button" className="text-red-600 hover:text-red-700" title="Satırı kaldır" onClick={() => setDegerSatirlari((l) => l.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></button></td>
                      </tr>
                    ))}
                    {degerSatirlari.length === 0 && <tr><td colSpan={4} className="px-2 py-3 text-center text-muted-foreground">Değer yok — enum olmayan alanlara elle değer ekleyebilirsiniz.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input className="h-7 text-xs w-56 font-mono" placeholder="Yeni ham değer ekle…" value={yeniDeger} onChange={(e) => setYeniDeger(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && yeniDeger.trim()) { setDegerSatirlari((l) => (l.some((x) => x.deger === yeniDeger.trim()) ? l : [...l, { deger: yeniDeger.trim(), etiket: '', kaynak: 'ELLE', degisti: true }])); setYeniDeger('') } }} />
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!yeniDeger.trim()} onClick={() => { setDegerSatirlari((l) => (l.some((x) => x.deger === yeniDeger.trim()) ? l : [...l, { deger: yeniDeger.trim(), etiket: '', kaynak: 'ELLE', degisti: true }])); setYeniDeger('') }}><Plus className="h-3 w-3 mr-1" />Ekle</Button>
              <Button size="sm" className="h-7 text-xs ml-auto" style={{ backgroundColor: NAVY }} disabled={degerDurum.kaydediliyor} onClick={degerleriKaydet}>
                {degerDurum.kaydediliyor ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}Kaydet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toplu AI onayı */}
      <Dialog open={topluAi.acik} onOpenChange={(a) => setTopluAi({ acik: a })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-base">Tüm değerleri AI ile doldur</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Bu veri setindeki IFS kaynaklarının <b>seçili alanlarının</b> katalog değerleri Claude ile Türkçeleştirilir ve kaydedilir.</p>
            <p className="text-xs text-muted-foreground">Elle düzeltilmiş (ELLE) etiketlere dokunulmaz. Etiketler yalnız gösterimi değiştirir; ham veri ve süzgeçler aynı kalır.</p>
            {topluAi.sonuc && <div className="rounded-md border bg-muted px-3 py-2 text-xs">{topluAi.sonuc}</div>}
            <div className="flex items-center gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setTopluAi({ acik: false })}>Kapat</Button>
              <Button size="sm" style={{ backgroundColor: NAVY }} disabled={topluAi.calisiyor} onClick={topluAiCalistir}>
                {topluAi.calisiyor ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}Başlat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
