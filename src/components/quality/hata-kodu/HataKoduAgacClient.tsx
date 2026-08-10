'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { normalizeTr } from '@/lib/normalize-tr'
import { HataKoduFormDialog } from './HataKoduFormDialog'
import type { HataKoduRow } from './types'

type Durum = 'aktif' | 'pasif' | 'tumu'

type SatirProps = {
  r: HataKoduRow
  /** Bölüm satırında: alt kod sayısı rozeti — BİLGİ amaçlı, tıklanmaz. */
  altSayisi?: number
  /** Hata kodu satırında: ait olduğu bölüm ("100 Satış") ya da "Genel". */
  bolumEtiketi?: string
  canManage: boolean
  gecisBekliyor: boolean
  onDuzenle: () => void
  onAktifDegistir: (yeni: boolean) => void
}

/**
 * Tek satır — bölüm ve hata kodu aynı görsel dili paylaşır. Girinti YOK, katlama YOK;
 * fark yalnız yan sütunlarda: bölümde alt kod rozeti, kodda ait olduğu bölüm etiketi.
 *
 * Modül seviyesinde: ana bileşenin İÇİNDE tanımlansaydı her render'da yeni bir
 * bileşen tipi üretilir ve 126 satırın tamamı (Switch'ler dahil) yeniden mount
 * edilirdi — arama kutusuna her harfte tıklama/odak kaybı demek.
 */
function KodSatiri({
  r,
  altSayisi,
  bolumEtiketi,
  canManage,
  gecisBekliyor,
  onDuzenle,
  onAktifDegistir,
}: SatirProps) {
  const bolum = altSayisi !== undefined
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 ${
        !r.aktif ? 'opacity-60' : ''
      }`}
    >
      <span
        className={`font-quality-mono tabular-nums text-sm shrink-0 w-12 ${
          bolum ? 'font-semibold text-[#1B4F72]' : 'text-slate-500'
        }`}
      >
        {r.kod}
      </span>

      <span
        className={`min-w-0 flex-1 text-sm ${bolum ? 'font-semibold text-slate-800' : 'text-slate-700'}`}
      >
        {r.ad}
      </span>

      {/* Hata kodu satırında ait olduğu bölüm */}
      {bolumEtiketi !== undefined && (
        <span className="shrink-0 text-xs text-slate-500 max-w-[14rem] truncate" title={bolumEtiketi}>
          {bolumEtiketi}
        </span>
      )}

      {/* Bölüm satırında alt kod sayısı — salt bilgi, tıklanmaz */}
      {bolum && (
        <Badge variant="outline" className="shrink-0 bg-slate-50 text-slate-600 border-slate-200">
          {altSayisi} alt kod
        </Badge>
      )}

      {/* Pasif kod SOLUK gösterilir (opacity-60), üstü çizili DEĞİL. */}
      <Badge
        variant="outline"
        className={`shrink-0 ${
          r.aktif
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'
        }`}
      >
        {r.aktif ? 'Aktif' : 'Pasif'}
      </Badge>

      {canManage && (
        <div className="shrink-0 inline-flex items-center gap-1">
          <Switch
            checked={r.aktif}
            disabled={gecisBekliyor}
            onCheckedChange={onAktifDegistir}
            aria-label={`${r.kod} aktif/pasif`}
          />
          <Button variant="ghost" size="sm" onClick={onDuzenle} title="Düzenle">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Hata kodu ağacı (KAL-KYT-15 Bölüm 1).
 *
 * Veriyi DÜZ çeker (`?duz=1`) ve grupları istemcide kurar. Ağaç ucu yerine düz
 * listenin tercih edilme sebebi: `?aktif=1` filtresi sunucuda bir başlığı düşürüp
 * altını köke çıkarabiliyor; hiyerarşiyi hep tam tutup filtreyi burada uygulayınca
 * bu kenar durum hiç oluşmuyor. Küme 126 satır — tamamı tek istekte gelir,
 * arama/filtre yeniden istek atmaz.
 *
 * İKİ AYRI DÜZ LİSTE — iç içe render YOK:
 *   • Bölümler     → tip = BOLUM, tek seviye, katlama yok
 *   • Hata Kodları → tip = KOD'un TAMAMI (bölüme bağlı olan da olmayan da),
 *                    her satırda ait olduğu bölüm sütunu ("100 Satış" / "Genel")
 *
 * `ustKodId` hiyerarşiyi taşımaya devam ediyor ama artık yalnız iki şey için
 * kullanılıyor: bölüm sütunu etiketi ve bölüm satırındaki alt kod sayısı rozeti.
 */
export function HataKoduAgacClient({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<HataKoduRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [durum, setDurum] = useState<Durum>('aktif')
  const [geciyor, setGeciyor] = useState<string | null>(null)

  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<HataKoduRow | null>(null)
  const [bolumModu, setBolumModu] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      // aktif filtresi BİLEREK gönderilmiyor — hiyerarşi tam kalsın, filtre istemcide.
      const res = await fetch('/api/quality/hata-kodu?duz=1')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setRows(json.items ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const sirala = (a: HataKoduRow, b: HataKoduRow) => a.siraNo - b.siraNo || a.kod - b.kod

  /**
   * `rowById`: bölüm sütunu etiketini çözmek için.
   * `altSayisiById`: bölüm satırındaki bilgi rozeti için (tıklanmaz).
   */
  const { bolumler, kodlar, rowById, altSayisiById } = useMemo(() => {
    const rowById = new Map<string, HataKoduRow>()
    for (const r of rows) rowById.set(r.id, r)

    const altSayisiById = new Map<string, number>()
    for (const r of rows) {
      if (!r.ustKodId) continue
      altSayisiById.set(r.ustKodId, (altSayisiById.get(r.ustKodId) ?? 0) + 1)
    }

    return {
      bolumler: rows.filter((r) => r.tip === 'BOLUM').sort(sirala),
      // ustKodId koşulu YOK — bölüme bağlı kodlar da bu listede.
      kodlar: rows.filter((r) => r.tip === 'KOD'),
      rowById,
      altSayisiById,
    }
  }, [rows])

  const aranan = q.trim()
  const nq = normalizeTr(aranan)
  const aramaAktif = aranan.length > 0

  const durumGecer = useCallback(
    (r: HataKoduRow) => (durum === 'tumu' ? true : durum === 'aktif' ? r.aktif : !r.aktif),
    [durum],
  )
  /** Kod sayı olarak, ad Türkçe-duyarlı normalize ile aranır. */
  const aramaGecer = useCallback(
    (r: HataKoduRow) =>
      !aramaAktif || String(r.kod).includes(aranan) || normalizeTr(r.ad).includes(nq),
    [aramaAktif, aranan, nq],
  )

  /** Bölüm sütunu etiketi: üstü varsa "kod ad", yoksa "Genel". */
  const bolumEtiketi = useCallback(
    (r: HataKoduRow) => {
      if (!r.ustKodId) return 'Genel'
      const p = rowById.get(r.ustKodId)
      return p ? `${p.kod} ${p.ad}` : 'Genel'
    },
    [rowById],
  )
  /** Sıralama anahtarı: bölüm kodu; Genel (üstsüz) en sona. */
  const bolumSiraKodu = useCallback(
    (r: HataKoduRow) => {
      if (!r.ustKodId) return Number.POSITIVE_INFINITY
      const p = rowById.get(r.ustKodId)
      return p ? p.kod : Number.POSITIVE_INFINITY
    },
    [rowById],
  )

  // Arama ve durum filtresi artık her listeye DOĞRUDAN uygulanır —
  // başlık/alt bağlam kuralı (altı görünür diye başlığı göster) kalktı.
  const gorunurBolumler = useMemo(
    () => bolumler.filter((r) => durumGecer(r) && aramaGecer(r)),
    [bolumler, durumGecer, aramaGecer],
  )

  const gorunurKodlar = useMemo(
    () =>
      kodlar
        .filter((r) => durumGecer(r) && aramaGecer(r))
        .sort((a, b) => bolumSiraKodu(a) - bolumSiraKodu(b) || a.kod - b.kod),
    [kodlar, durumGecer, aramaGecer, bolumSiraKodu],
  )

  const toplamGorunur = gorunurBolumler.length + gorunurKodlar.length

  async function aktifDegistir(r: HataKoduRow, yeni: boolean) {
    setGeciyor(r.id)
    // İyimser güncelleme — hata olursa geri alınır.
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, aktif: yeni } : x)))
    try {
      const res = await fetch(`/api/quality/hata-kodu/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif: yeni }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'Güncelleme başarısız')
    } catch (e) {
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, aktif: !yeni } : x)))
      toast.error(e instanceof Error ? e.message : 'Güncelleme başarısız')
    } finally {
      setGeciyor(null)
    }
  }

  function yeniAc() {
    setDuzenlenen(null)
    setBolumModu(false)
    setFormAcik(true)
  }
  /** Yeni ANA BAŞLIK — form üst kod alanı olmadan açılır, kayıt ustKodId = null gider. */
  function yeniBolumAc() {
    setDuzenlenen(null)
    setBolumModu(true)
    setFormAcik(true)
  }
  function duzenleAc(r: HataKoduRow) {
    setDuzenlenen(r)
    setBolumModu(false)
    setFormAcik(true)
  }


  return (
    <div className="space-y-4">
      {/* Filtre bar */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs text-slate-600">Ara (kod veya ad)</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="462 / kalıp hatası / kaynak…"
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Durum</Label>
            <Select value={durum} onValueChange={(v) => setDurum(v as Durum)}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="pasif">Pasif</SelectItem>
                <SelectItem value="tumu">Tümü</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {(aramaAktif || durum !== 'aktif') && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{toplamGorunur} sonuç</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('')
                setDurum('aktif')
              }}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" /> Filtreleri Temizle
            </Button>
          </div>
        )}
      </div>

      {/* Ağaç */}
      {loading ? (
        <div className="rounded-md border bg-white p-12 text-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Yükleniyor...
        </div>
      ) : err ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          Hata: {err}
        </div>
      ) : (
        /* İki kutu HER ZAMAN render edilir (boşken de): ekleme butonları kutu
           başlığında durduğu için, kutu gizlenirse ilk bölümü/kodu eklemek
           imkânsız olurdu. Boş kutu kendi satırında durumunu yazar. */
        <div className="space-y-4">
          {/* ── KUTU 1: Bölümler (düz, tek seviye) ── */}
          <div className="rounded-md border bg-white overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Bölümler
              </h2>
              {canManage && (
                <Button variant="outline" size="sm" onClick={yeniBolumAc} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Yeni Bölüm Ekle
                </Button>
              )}
            </div>
            {gorunurBolumler.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {aramaAktif || durum !== 'aktif' ? 'Filtrelere uyan bölüm yok' : 'Henüz bölüm yok'}
              </p>
            ) : (
              gorunurBolumler.map((r) => (
                <KodSatiri
                  key={r.id}
                  r={r}
                  altSayisi={altSayisiById.get(r.id) ?? 0}
                  canManage={canManage}
                  gecisBekliyor={geciyor === r.id}
                  onDuzenle={() => duzenleAc(r)}
                  onAktifDegistir={(v) => aktifDegistir(r, v)}
                />
              ))
            )}
          </div>

          {/* ── KUTU 2: Hata Kodları (TÜM tip=KOD, düz, bölüm sütunlu) ── */}
          <div className="rounded-md border bg-white overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Hata Kodları
              </h2>
              {canManage && (
                <Button
                  size="sm"
                  onClick={yeniAc}
                  className="h-7 text-xs bg-[#1B4F72] hover:bg-[#1B4F72]/90 shrink-0"
                >
                  <Plus className="h-3 w-3 mr-1" /> Yeni Kod Ekle
                </Button>
              )}
            </div>
            {gorunurKodlar.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {aramaAktif || durum !== 'aktif' ? 'Filtrelere uyan kod yok' : 'Henüz kod yok'}
              </p>
            ) : (
              gorunurKodlar.map((r) => (
                <KodSatiri
                  key={r.id}
                  r={r}
                  bolumEtiketi={bolumEtiketi(r)}
                  canManage={canManage}
                  gecisBekliyor={geciyor === r.id}
                  onDuzenle={() => duzenleAc(r)}
                  onAktifDegistir={(v) => aktifDegistir(r, v)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {canManage && (
        <HataKoduFormDialog
          open={formAcik}
          onOpenChange={setFormAcik}
          kayit={duzenlenen}
          tumKayitlar={rows}
          bolumModu={bolumModu}
          onKaydedildi={fetchList}
        />
      )}

    </div>
  )
}
