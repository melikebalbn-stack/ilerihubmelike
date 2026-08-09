'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react'
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
  /** 0 = başlık/genel, 1 = alt kod (girintili) */
  seviye: 0 | 1
  /** Dolu ise satır bir bölüm başlığıdır (katlanabilir + rozet). */
  altSayisi?: number
  canManage: boolean
  acik: boolean
  gecisBekliyor: boolean
  onKatla: () => void
  onDuzenle: () => void
  onAktifDegistir: (yeni: boolean) => void
}

/**
 * Tek satır — başlık ve alt kod aynı görsel dili paylaşır, girinti seviyeye bağlı.
 *
 * Modül seviyesinde: ana bileşenin İÇİNDE tanımlansaydı her render'da yeni bir
 * bileşen tipi üretilir ve 126 satırın tamamı (Switch'ler dahil) yeniden mount
 * edilirdi — arama kutusuna her harfte tıklama/odak kaybı demek.
 */
function KodSatiri({
  r,
  seviye,
  altSayisi,
  canManage,
  acik,
  gecisBekliyor,
  onKatla,
  onDuzenle,
  onAktifDegistir,
}: SatirProps) {
  const baslik = altSayisi !== undefined
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 ${
        seviye === 1 ? 'pl-11' : ''
      } ${!r.aktif ? 'opacity-60' : ''}`}
    >
      {baslik ? (
        <button
          type="button"
          onClick={onKatla}
          className="shrink-0 text-slate-400 hover:text-slate-600"
          aria-label={acik ? 'Kapat' : 'Aç'}
          aria-expanded={acik}
        >
          {acik ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ) : null}

      <span
        className={`font-quality-mono tabular-nums text-sm shrink-0 w-12 ${
          baslik ? 'font-semibold text-[#1B4F72]' : 'text-slate-500'
        }`}
      >
        {r.kod}
      </span>

      <span
        className={`min-w-0 flex-1 text-sm ${baslik ? 'font-semibold text-slate-800' : 'text-slate-700'}`}
      >
        {r.ad}
      </span>

      {baslik && (
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
 * Üç grup, veri modelindeki tanımla birebir:
 *   • Genel uygunsuzluklar → üstü YOK **ve** altı YOK
 *   • Bölüm başlıkları     → üstü YOK **ve** altı VAR (kendileri de seçilebilir kod)
 *   • Alt kodlar           → üstü VAR
 */
export function HataKoduAgacClient({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<HataKoduRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [durum, setDurum] = useState<Durum>('aktif')
  const [acik, setAcik] = useState<Set<string>>(new Set())
  const [geciyor, setGeciyor] = useState<string | null>(null)

  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<HataKoduRow | null>(null)

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

  const { genel, basliklar, altlarByUst } = useMemo(() => {
    const altlarByUst = new Map<string, HataKoduRow[]>()
    for (const r of rows) {
      if (!r.ustKodId) continue
      const list = altlarByUst.get(r.ustKodId)
      if (list) list.push(r)
      else altlarByUst.set(r.ustKodId, [r])
    }
    for (const list of altlarByUst.values()) list.sort(sirala)

    const kokler = rows.filter((r) => !r.ustKodId)
    return {
      genel: kokler.filter((r) => !altlarByUst.has(r.id)).sort(sirala),
      basliklar: kokler.filter((r) => altlarByUst.has(r.id)).sort(sirala),
      altlarByUst,
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

  /**
   * Görünür başlıklar + her birinin görünür altları.
   * Başlık kendisi filtreden düşse bile görünür bir altı varsa yapısal bağlam
   * olarak gösterilir (pasifse zaten soluk çizilir) — aksi halde alt kod erişilemez olurdu.
   */
  const gorunurBasliklar = useMemo(() => {
    return basliklar
      .map((b) => {
        const tumAltlar = altlarByUst.get(b.id) ?? []
        const baslikEsler = durumGecer(b) && aramaGecer(b)
        const altlar = tumAltlar.filter(
          (c) => durumGecer(c) && (!aramaAktif || aramaGecer(c) || aramaGecer(b)),
        )
        return { baslik: b, altlar, baslikEsler }
      })
      .filter((g) => g.baslikEsler || g.altlar.length > 0)
  }, [basliklar, altlarByUst, durumGecer, aramaGecer, aramaAktif])

  const gorunurGenel = useMemo(
    () => genel.filter((r) => durumGecer(r) && aramaGecer(r)),
    [genel, durumGecer, aramaGecer],
  )

  const toplamGorunur =
    gorunurGenel.length + gorunurBasliklar.reduce((s, g) => s + 1 + g.altlar.length, 0)

  function toggleAcik(id: string) {
    setAcik((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Aramada eşleşen alt kodun üst başlığı otomatik açılır. */
  const acikMi = (id: string) => aramaAktif || acik.has(id)

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
    setFormAcik(true)
  }
  function duzenleAc(r: HataKoduRow) {
    setDuzenlenen(r)
    setFormAcik(true)
  }


  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center justify-end">
          <Button onClick={yeniAc} className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">
            <Plus className="h-4 w-4 mr-2" /> Yeni Kod Ekle
          </Button>
        </div>
      )}

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
      ) : toplamGorunur === 0 ? (
        <div className="rounded-md border border-dashed bg-slate-50 p-12 text-center">
          <Search className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-600">
            {aramaAktif || durum !== 'aktif' ? 'Filtrelere uyan kod yok' : 'Henüz kod yok'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {gorunurGenel.length > 0 && (
            <div className="rounded-md border bg-white overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Genel uygunsuzluklar
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Bölüme bağlı olmayan kodlar</p>
              </div>
              {gorunurGenel.map((r) => (
                <KodSatiri
                  key={r.id}
                  r={r}
                  seviye={0}
                  canManage={canManage}
                  acik={false}
                  gecisBekliyor={geciyor === r.id}
                  onKatla={() => {}}
                  onDuzenle={() => duzenleAc(r)}
                  onAktifDegistir={(v) => aktifDegistir(r, v)}
                />
              ))}
            </div>
          )}

          {gorunurBasliklar.length > 0 && (
            <div className="rounded-md border bg-white overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Bölümler
                </h2>
              </div>
              {gorunurBasliklar.map(({ baslik, altlar }) => (
                <div key={baslik.id}>
                  <KodSatiri
                    r={baslik}
                    seviye={0}
                    altSayisi={altlar.length}
                    canManage={canManage}
                    acik={acikMi(baslik.id)}
                    gecisBekliyor={geciyor === baslik.id}
                    onKatla={() => toggleAcik(baslik.id)}
                    onDuzenle={() => duzenleAc(baslik)}
                    onAktifDegistir={(v) => aktifDegistir(baslik, v)}
                  />
                  {acikMi(baslik.id) &&
                    altlar.map((c) => (
                      <KodSatiri
                        key={c.id}
                        r={c}
                        seviye={1}
                        canManage={canManage}
                        acik={false}
                        gecisBekliyor={geciyor === c.id}
                        onKatla={() => {}}
                        onDuzenle={() => duzenleAc(c)}
                        onAktifDegistir={(v) => aktifDegistir(c, v)}
                      />
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {canManage && (
        <HataKoduFormDialog
          open={formAcik}
          onOpenChange={setFormAcik}
          kayit={duzenlenen}
          tumKayitlar={rows}
          onKaydedildi={fetchList}
        />
      )}

    </div>
  )
}
