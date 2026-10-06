'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Yon = 'GIRIS' | 'CIKIS'
type Okuyucu = { id: string; kapiId: string; okuyucuNo: number; yon: Yon; puantajaDahil: boolean; aktif: boolean }
type Kapi = { id: string; cihazId: string; kapiNo: number; ad: string; grup: string | null; aktif: boolean; okuyucular: Okuyucu[] }
type Cihaz = {
  id: string
  kod: string
  ad: string
  marka: string
  model: string
  host: string
  envOnek: string
  seriNo: string | null
  firmware: string | null
  aktif: boolean
  sonGorulmeAt: string | null
  kimlikTanimli: boolean
  kapilar: Kapi[]
  _count: { gecisler: number }
}
type Saglik = {
  ok: boolean
  kontrolAt: string
  sureMs: number
  bilgi?: { cihazAdi?: string; model?: string; seriNo?: string; firmware?: string; firmwareTarihi?: string; mac?: string }
  saat?: { cihazSaatiHam: string; saatModu?: string; sapmaSn: number; esikSn: number; uyari: boolean }
  hata?: { kod: string; mesaj: string }
}

const YON_ETIKET: Record<Yon, string> = { GIRIS: 'Giriş', CIKIS: 'Çıkış' }
const HATA_ETIKET: Record<string, string> = {
  YAPILANDIRMA: 'Yapılandırma eksik',
  ZAMAN_ASIMI: 'Zaman aşımı',
  BAGLANTI_REDDEDILDI: 'Bağlantı reddedildi',
  ULASILAMIYOR: 'Ulaşılamıyor',
  KIMLIK: 'Kimlik doğrulama',
  YETKI: 'Yetki yok',
  HTTP: 'HTTP hatası',
  GECERSIZ_YANIT: 'Geçersiz yanıt',
  DESTEKLENMIYOR: 'Desteklenmiyor',
  BILINMEYEN: 'Beklenmeyen hata',
}

const tarihSaat = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '—'

async function istek(url: string, method: string, govde?: unknown): Promise<{ ok: boolean; veri: Record<string, unknown> }> {
  try {
    const r = await fetch(url, {
      method,
      headers: govde !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: govde !== undefined ? JSON.stringify(govde) : undefined,
      cache: 'no-store',
    })
    const veri = (await r.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: r.ok && veri.ok !== false, veri }
  } catch {
    return { ok: false, veri: { error: 'Sunucuya ulaşılamadı' } }
  }
}

export function CihazlarClient() {
  const [cihazlar, setCihazlar] = useState<Cihaz[] | null>(null)
  const [yuklemeHatasi, setYuklemeHatasi] = useState<string | null>(null)
  const [cihazDuzen, setCihazDuzen] = useState<Partial<Cihaz> | null>(null)
  const [kapiDuzen, setKapiDuzen] = useState<Partial<Kapi> | null>(null)
  const [okuyucuDuzen, setOkuyucuDuzen] = useState<Partial<Okuyucu> | null>(null)
  const [formHata, setFormHata] = useState<string | null>(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const yukle = useCallback(async () => {
    const { ok, veri } = await istek('/api/pdks/cihazlar', 'GET')
    if (!ok) {
      setYuklemeHatasi(String(veri.error ?? 'Cihazlar alınamadı'))
      setCihazlar((c) => c ?? [])
      return
    }
    setYuklemeHatasi(null)
    setCihazlar(veri.cihazlar as Cihaz[])
  }, [])
  useEffect(() => void yukle(), [yukle])

  const kaydet = async (url: string, method: 'POST' | 'PATCH', govde: unknown, kapat: () => void) => {
    setFormHata(null)
    setKaydediliyor(true)
    const { ok, veri } = await istek(url, method, govde)
    setKaydediliyor(false)
    if (!ok) return setFormHata(String(veri.error ?? 'Kaydedilemedi'))
    kapat()
    void yukle()
  }

  const sil = async (url: string, ne: string) => {
    if (!window.confirm(`${ne} silinsin mi? Bu işlem geri alınamaz.`)) return
    const { ok, veri } = await istek(url, 'DELETE')
    if (!ok) return window.alert(String(veri.error ?? 'Silinemedi'))
    void yukle()
  }

  const dialogKapat = () => {
    setCihazDuzen(null)
    setKapiDuzen(null)
    setOkuyucuDuzen(null)
    setFormHata(null)
  }

  if (cihazlar === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {cihazlar.length} cihaz · {cihazlar.reduce((t, c) => t + c.kapilar.length, 0)} turnike
        </p>
        <Button size="sm" onClick={() => setCihazDuzen({ marka: 'HIKVISION', model: 'DS-K2604T', aktif: true })}>
          <Plus className="mr-1 h-4 w-4" /> Cihaz Ekle
        </Button>
      </div>

      {yuklemeHatasi && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{yuklemeHatasi}</div>
      )}

      {cihazlar.length === 0 && !yuklemeHatasi && (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-slate-500">
          Henüz cihaz tanımlı değil. “Cihaz Ekle” ile Hikvision panelini kaydedin.
        </div>
      )}

      {cihazlar.map((c) => (
        <CihazKarti
          key={c.id}
          cihaz={c}
          onDuzenle={() => setCihazDuzen({ ...c })}
          onSil={() => sil(`/api/pdks/cihazlar/${c.id}`, `${c.kod} cihazı`)}
          onKapiEkle={() =>
            setKapiDuzen({ cihazId: c.id, kapiNo: (c.kapilar.at(-1)?.kapiNo ?? 0) + 1, ad: '', aktif: true })
          }
          onKapiDuzenle={(k) => setKapiDuzen({ ...k })}
          onKapiSil={(k) => sil(`/api/pdks/kapilar/${k.id}`, `“${k.ad}” turnikesi`)}
          onOkuyucuEkle={(k) =>
            setOkuyucuDuzen({ kapiId: k.id, okuyucuNo: (k.okuyucular.at(-1)?.okuyucuNo ?? 0) + 1, yon: 'GIRIS', puantajaDahil: true, aktif: true })
          }
          onOkuyucuDuzenle={(o) => setOkuyucuDuzen({ ...o })}
          onOkuyucuSil={(o) => sil(`/api/pdks/okuyucular/${o.id}`, `Okuyucu ${o.okuyucuNo}`)}
          onSaglikSonrasi={yukle}
        />
      ))}

      {/* ── Cihaz dialog ── */}
      <Dialog open={!!cihazDuzen} onOpenChange={(o) => !o && dialogKapat()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cihazDuzen?.id ? `Cihaz Düzenle — ${cihazDuzen.kod}` : 'Cihaz Ekle'}</DialogTitle>
          </DialogHeader>
          {cihazDuzen && (
            <div className="space-y-3">
              {!cihazDuzen.id && (
                <div>
                  <Label>Kod</Label>
                  <Input
                    value={cihazDuzen.kod ?? ''}
                    onChange={(e) => setCihazDuzen({ ...cihazDuzen, kod: e.target.value.toUpperCase() })}
                    placeholder="HIK-ANA-1"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Kod sonradan değiştirilemez. Kimlik bilgisi env anahtarı koddan türetilir.
                  </p>
                </div>
              )}
              <div>
                <Label>Ad</Label>
                <Input value={cihazDuzen.ad ?? ''} onChange={(e) => setCihazDuzen({ ...cihazDuzen, ad: e.target.value })} placeholder="Ana Giriş Turnikeleri" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Marka</Label>
                  <Select
                    value={cihazDuzen.marka ?? 'HIKVISION'}
                    onValueChange={(v) => setCihazDuzen({ ...cihazDuzen, marka: v })}
                    disabled={!!cihazDuzen.id}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIKVISION">Hikvision</SelectItem>
                      <SelectItem value="GEOVISION">GeoVision (arşiv)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>Model</Label>
                  <Input value={cihazDuzen.model ?? ''} onChange={(e) => setCihazDuzen({ ...cihazDuzen, model: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Host (IP[:port])</Label>
                <Input value={cihazDuzen.host ?? ''} onChange={(e) => setCihazDuzen({ ...cihazDuzen, host: e.target.value })} placeholder="10.0.50.10" />
                <p className="mt-1 text-xs text-slate-500">Yalnız özel ağ IPv4 adresi. Varsayılan port 80 (ISAPI/HTTP).</p>
              </div>
              <div className="flex items-center justify-between">
                <Label>Aktif</Label>
                <Switch checked={cihazDuzen.aktif ?? true} onCheckedChange={(v) => setCihazDuzen({ ...cihazDuzen, aktif: v })} />
              </div>
              {formHata && <p className="text-sm text-red-600">{formHata}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={dialogKapat}>İptal</Button>
            <Button
              disabled={kaydediliyor}
              onClick={() => {
                if (!cihazDuzen) return
                const { id, kod, ad, marka, model, host, aktif } = cihazDuzen
                void kaydet(
                  id ? `/api/pdks/cihazlar/${id}` : '/api/pdks/cihazlar',
                  id ? 'PATCH' : 'POST',
                  id ? { ad, model, host, aktif } : { kod, ad, marka, model, host, aktif },
                  dialogKapat,
                )
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Turnike dialog ── */}
      <Dialog open={!!kapiDuzen} onOpenChange={(o) => !o && dialogKapat()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{kapiDuzen?.id ? 'Turnike Düzenle' : 'Turnike Ekle'}</DialogTitle></DialogHeader>
          {kapiDuzen && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-28">
                  <Label>Turnike no</Label>
                  <Input
                    type="number"
                    min={1}
                    value={kapiDuzen.kapiNo ?? ''}
                    onChange={(e) => setKapiDuzen({ ...kapiDuzen, kapiNo: Number(e.target.value) })}
                  />
                  <p className="mt-1 text-xs text-slate-500">Paneldeki kapı (door) no.</p>
                </div>
                <div className="flex-1">
                  <Label>Ad</Label>
                  <Input value={kapiDuzen.ad ?? ''} onChange={(e) => setKapiDuzen({ ...kapiDuzen, ad: e.target.value })} placeholder="Turnike 1" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Aktif</Label>
                <Switch checked={kapiDuzen.aktif ?? true} onCheckedChange={(v) => setKapiDuzen({ ...kapiDuzen, aktif: v })} />
              </div>
              {formHata && <p className="text-sm text-red-600">{formHata}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={dialogKapat}>İptal</Button>
            <Button
              disabled={kaydediliyor}
              onClick={() => {
                if (!kapiDuzen) return
                const { id, cihazId, kapiNo, ad, aktif } = kapiDuzen
                void kaydet(
                  id ? `/api/pdks/kapilar/${id}` : '/api/pdks/kapilar',
                  id ? 'PATCH' : 'POST',
                  id ? { kapiNo, ad, aktif } : { cihazId, kapiNo, ad, aktif },
                  dialogKapat,
                )
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Okuyucu dialog ── */}
      <Dialog open={!!okuyucuDuzen} onOpenChange={(o) => !o && dialogKapat()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{okuyucuDuzen?.id ? 'Okuyucu Düzenle' : 'Okuyucu Ekle'}</DialogTitle></DialogHeader>
          {okuyucuDuzen && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-28">
                  <Label>Okuyucu no</Label>
                  <Input
                    type="number"
                    min={1}
                    value={okuyucuDuzen.okuyucuNo ?? ''}
                    onChange={(e) => setOkuyucuDuzen({ ...okuyucuDuzen, okuyucuNo: Number(e.target.value) })}
                  />
                </div>
                <div className="flex-1">
                  <Label>Yön</Label>
                  <Select value={okuyucuDuzen.yon ?? 'GIRIS'} onValueChange={(v) => setOkuyucuDuzen({ ...okuyucuDuzen, yon: v as Yon })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GIRIS">Giriş</SelectItem>
                      <SelectItem value="CIKIS">Çıkış</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {okuyucuDuzen.id && (
                <p className="text-xs text-amber-700">
                  Yön değişikliği geçmiş geçişleri etkilemez; yalnız bundan sonra alınan olaylar yeni yönle yazılır.
                </p>
              )}
              <div className="flex items-center justify-between">
                <Label>Puantaja dahil</Label>
                <Switch
                  checked={okuyucuDuzen.puantajaDahil ?? true}
                  onCheckedChange={(v) => setOkuyucuDuzen({ ...okuyucuDuzen, puantajaDahil: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Aktif</Label>
                <Switch checked={okuyucuDuzen.aktif ?? true} onCheckedChange={(v) => setOkuyucuDuzen({ ...okuyucuDuzen, aktif: v })} />
              </div>
              {formHata && <p className="text-sm text-red-600">{formHata}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={dialogKapat}>İptal</Button>
            <Button
              disabled={kaydediliyor}
              onClick={() => {
                if (!okuyucuDuzen) return
                const { id, kapiId, okuyucuNo, yon, puantajaDahil, aktif } = okuyucuDuzen
                void kaydet(
                  id ? `/api/pdks/okuyucular/${id}` : '/api/pdks/okuyucular',
                  id ? 'PATCH' : 'POST',
                  id ? { okuyucuNo, yon, puantajaDahil, aktif } : { kapiId, okuyucuNo, yon, puantajaDahil, aktif },
                  dialogKapat,
                )
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Cihaz kartı ──────────────────────────────────────────────────────────────

function CihazKarti({
  cihaz: c,
  onDuzenle,
  onSil,
  onKapiEkle,
  onKapiDuzenle,
  onKapiSil,
  onOkuyucuEkle,
  onOkuyucuDuzenle,
  onOkuyucuSil,
  onSaglikSonrasi,
}: {
  cihaz: Cihaz
  onDuzenle: () => void
  onSil: () => void
  onKapiEkle: () => void
  onKapiDuzenle: (k: Kapi) => void
  onKapiSil: (k: Kapi) => void
  onOkuyucuEkle: (k: Kapi) => void
  onOkuyucuDuzenle: (o: Okuyucu) => void
  onOkuyucuSil: (o: Okuyucu) => void
  onSaglikSonrasi: () => void
}) {
  const [saglik, setSaglik] = useState<Saglik | null>(null)
  const [testEdiliyor, setTestEdiliyor] = useState(false)

  const baglantiTesti = async () => {
    setTestEdiliyor(true)
    const { veri } = await istek(`/api/pdks/cihazlar/${c.id}/saglik`, 'POST')
    setTestEdiliyor(false)
    if (typeof veri.ok === 'boolean' && 'kontrolAt' in veri) {
      setSaglik(veri as unknown as Saglik)
      if (veri.ok) onSaglikSonrasi()
    } else {
      setSaglik({
        ok: false,
        kontrolAt: new Date().toISOString(),
        sureMs: 0,
        hata: { kod: 'BILINMEYEN', mesaj: String(veri.error ?? 'Bağlantı testi yapılamadı') },
      })
    }
  }

  return (
    <Card className={c.aktif ? '' : 'opacity-70'}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              {c.kod}
              <span className="font-normal text-slate-600">— {c.ad}</span>
              <Badge variant={c.aktif ? 'default' : 'secondary'}>{c.aktif ? 'Aktif' : 'Pasif'}</Badge>
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              {c.marka} {c.model} · <span className="font-mono">{c.host}</span> · {c._count.gecisler} geçiş kaydı
            </p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onDuzenle} title="Düzenle"><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={onSil} title="Sil"><Trash2 className="h-4 w-4 text-red-600" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Sağlık */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Son görülme</dt>
              <dd>{tarihSaat(c.sonGorulmeAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Seri no</dt>
              <dd className="font-mono text-xs">{c.seriNo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Firmware</dt>
              <dd className="font-mono text-xs">{c.firmware ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Kimlik bilgisi (env)</dt>
              <dd>
                {c.kimlikTanimli ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700"><KeyRound className="h-3.5 w-3.5" /> Tanımlı</span>
                ) : (
                  <span className="text-amber-700" title={`${c.envOnek}_USER / ${c.envOnek}_PASS`}>
                    Eksik: <span className="font-mono text-xs">{c.envOnek}_USER/_PASS</span>
                  </span>
                )}
              </dd>
            </div>
          </dl>
          <div className="flex items-start">
            <Button variant="outline" size="sm" onClick={baglantiTesti} disabled={testEdiliyor || c.marka !== 'HIKVISION'}>
              {testEdiliyor ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Activity className="mr-1 h-4 w-4" />}
              {testEdiliyor ? 'Test ediliyor…' : 'Bağlantı Testi'}
            </Button>
          </div>
        </div>

        {saglik && <SaglikSonucKarti s={saglik} />}

        {/* Turnikeler */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Turnikeler ve okuyucular</h3>
            <Button variant="ghost" size="sm" onClick={onKapiEkle}><Plus className="mr-1 h-4 w-4" /> Turnike Ekle</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2">No</th>
                  <th className="px-3 py-2">Ad</th>
                  <th className="px-3 py-2">Okuyucular</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {c.kapilar.map((k) => (
                  <tr key={k.id} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">{k.kapiNo}</td>
                    <td className="px-3 py-2">{k.ad}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {k.okuyucular.map((o) => (
                          <span
                            key={o.id}
                            className={`group inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
                              o.yon === 'GIRIS' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-sky-50 text-sky-800'
                            } ${o.aktif ? '' : 'opacity-50'}`}
                          >
                            O{o.okuyucuNo} · {YON_ETIKET[o.yon]}
                            {!o.puantajaDahil && <span title="Puantaja dahil değil">·P✕</span>}
                            <button onClick={() => onOkuyucuDuzenle(o)} className="ml-0.5 opacity-60 hover:opacity-100" title="Düzenle">
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button onClick={() => onOkuyucuSil(o)} className="opacity-60 hover:opacity-100" title="Sil">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() => onOkuyucuEkle(k)}
                          className="inline-flex items-center rounded-md border border-dashed px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
                        >
                          <Plus className="mr-0.5 h-3 w-3" /> Okuyucu
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={k.aktif ? 'default' : 'secondary'}>{k.aktif ? 'Aktif' : 'Pasif'}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => onKapiDuzenle(k)} title="Düzenle"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onKapiSil(k)} title="Sil"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </td>
                  </tr>
                ))}
                {c.kapilar.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Turnike tanımı yok</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SaglikSonucKarti({ s }: { s: Saglik }) {
  if (!s.ok) {
    return (
      <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div>
          <p className="font-medium text-red-800">
            Bağlantı başarısız — {HATA_ETIKET[s.hata?.kod ?? ''] ?? s.hata?.kod}
          </p>
          <p className="text-red-700">{s.hata?.mesaj}</p>
          <p className="mt-1 text-xs text-red-600/80">{tarihSaat(s.kontrolAt)} · {(s.sureMs / 1000).toFixed(1)} sn</p>
        </div>
      </div>
    )
  }
  return (
    <div className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm sm:grid-cols-2">
      <div className="flex gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-medium text-emerald-800">Bağlantı başarılı · {s.sureMs} ms</p>
          <p className="text-emerald-800/90">
            {s.bilgi?.model} · seri <span className="font-mono text-xs">{s.bilgi?.seriNo ?? '—'}</span>
          </p>
          <p className="text-emerald-800/90">Firmware {s.bilgi?.firmware ?? '—'} {s.bilgi?.firmwareTarihi ?? ''}</p>
        </div>
      </div>
      {s.saat && (
        <div className={`flex gap-3 ${s.saat.uyari ? 'text-amber-800' : 'text-emerald-800'}`}>
          {s.saat.uyari ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : <Clock className="mt-0.5 h-5 w-5 shrink-0" />}
          <div>
            <p className="font-medium">
              Saat sapması {s.saat.sapmaSn > 0 ? '+' : ''}{s.saat.sapmaSn} sn
              {s.saat.uyari && ` — eşik ±${s.saat.esikSn} sn aşıldı, NTP ayarını kontrol edin`}
            </p>
            <p className="text-xs opacity-80">Cihaz: {s.saat.cihazSaatiHam} · mod: {s.saat.saatModu ?? '—'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
