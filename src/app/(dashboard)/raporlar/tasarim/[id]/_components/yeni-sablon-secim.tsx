'use client'

/**
 * /raporlar/tasarim/yeni — en üstte tür seçimi (kullanıcıya: "AI Rapor" / "Hazır Rapor").
 *  AI Rapor / 'etkilesimli' (önerilen): kod + ad + veri seti → "Oluştur" → tüm alanlar görünür varsayılan görünümle
 *    kaydedilir → doğrudan /raporlar/[id] (kullanıcı orada kurgular, "Görünümü kaydet" der).
 *  Hazır Rapor / 'belge': mevcut şablon tasarım ekranı (SablonTasarimClient).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/select'
import { FileBarChart2, FileText, LayoutTemplate, List, Loader2, MousePointerClick, Plus } from 'lucide-react'
import { varsayilanGorunum } from '@/lib/rapor/gorunum'
import { listedenTuval } from '@/lib/rapor/tuval-render'
import { veriSetiParametreleri } from '@/lib/rapor/sablon-dogrula'
import type { EtkilesimliIcerik, SablonIcerik, SablonParametre, VeriSetiTanim } from '@/lib/rapor/tipler'
import { GeriRozet } from '../../../_components/rozet-link'
import { apiGet, apiGonder, hataListesi, hataMetni } from '../../../_components/api'
import { TUR_ACIKLAMA, TUR_ADI } from '@/lib/rapor/tur-adlari'
import { KATEGORILER } from '@/lib/rapor/kategoriler'

const NAVY = '#1B4F72'

interface Props { veriSetleri: { id: string; ad: string }[]; belgeTasarim: ReactNode }

export default function YeniSablonSecim({ veriSetleri, belgeTasarim }: Props) {
  const router = useRouter()
  const [tur, setTur] = useState<'etkilesimli' | 'belge' | null>(null)
  /** Hazır Rapor için yerleşim: serbest tuval (varsayılan) ya da basit liste (eski form ekranı). */
  const [belgeYerlesim, setBelgeYerlesim] = useState<'tuval' | 'liste' | null>(null)
  const [kod, setKod] = useState('')
  const [ad, setAd] = useState('')
  const [kategori, setKategori] = useState('')
  const [veriSetiId, setVeriSetiId] = useState('')
  const [alanlar, setAlanlar] = useState<{ ad: string; veriTipi: string; etiket: string | null }[] | null>(null)
  const [tanim, setTanim] = useState<VeriSetiTanim | null>(null)
  const [olusturuluyor, setOlusturuluyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    if (!veriSetiId) { setAlanlar(null); setTanim(null); return }
    apiGet<{ alanlar?: { ad: string; veriTipi: string; etiket: string | null }[]; veriSeti?: { tanim?: VeriSetiTanim } }>(`/api/raporlar/veri-setleri/${veriSetiId}`)
      .then((d) => { setAlanlar(d.alanlar ?? []); setTanim(d.veriSeti?.tanim ?? null) })
      .catch((e) => setHata(hataMetni(e)))
  }, [veriSetiId])

  async function olustur() {
    if (!alanlar) return
    setOlusturuluyor(true); setHata(null)
    try {
      // Veri setindeki {p.x} yer tutucuları otomatik parametre olur (ad sezgisi: tarih/başlangıç/bitiş → tarih).
      const parametreler: SablonParametre[] = veriSetiParametreleri(tanim).map((p) => ({ ad: p, tip: /tarih|baslangic|bitis|date/i.test(p) ? 'tarih' : 'metin', etiket: p, zorunlu: true }))
      const icerik: EtkilesimliIcerik = { tur: 'etkilesimli', baslik: ad.trim(), kategori: kategori.trim() || undefined, parametreler, gorunum: varsayilanGorunum(alanlar) }
      const d = await apiGonder<{ sablon: { id: string } }>('/api/raporlar/sablonlar', 'POST', { kod, ad, aciklama: '', veriSetiId, icerik, durum: 'TASLAK' })
      // Ön-ek olmayan hedef → soft-nav güvenli; yine de tam yükleme (yeni sayfa server verisi).
      window.location.href = `/raporlar/${d.sablon.id}`
    } catch (e) { setHata([hataMetni(e), ...hataListesi(e)].join(' · ')); setOlusturuluyor(false) }
  }

  /** Tuval yerleşimli Hazır Rapor: ilk 5 alan Detay bandına, başlıklar Sayfa Başlığına. */
  async function tuvalOlustur() {
    if (!alanlar) return
    setOlusturuluyor(true); setHata(null)
    try {
      const parametreler: SablonParametre[] = veriSetiParametreleri(tanim).map((p) => ({ ad: p, tip: /tarih|baslangic|bitis|date/i.test(p) ? 'tarih' : 'metin', etiket: p, zorunlu: true }))
      const secilen = alanlar.slice(0, 5)
      const tuval = listedenTuval({
        baslik: ad.trim(),
        kolonlar: secilen.map((a) => ({
          alan: a.ad, baslik: a.etiket ?? a.ad, genislik: Math.floor(100 / secilen.length),
          bicim: a.veriTipi === 'sayi' ? ('#.##0' as const) : a.veriTipi === 'tarih' ? ('gg.aa.yyyy' as const) : undefined,
          altToplam: a.veriTipi === 'sayi' ? ('topla' as const) : undefined,
        })),
        genelToplam: true,
      })
      const icerik: SablonIcerik & { tur: 'belge' } = {
        tur: 'belge', baslik: ad.trim(), kategori: kategori.trim() || undefined, parametreler,
        kolonlar: secilen.map((a) => ({ alan: a.ad, baslik: a.etiket ?? a.ad })), // liste görünümü de geçerli kalsın
        yerlesim: 'tuval', tuval,
      }
      const d = await apiGonder<{ sablon: { id: string } }>('/api/raporlar/sablonlar', 'POST', { kod, ad, aciklama: '', veriSetiId, icerik, durum: 'TASLAK' })
      window.location.href = `/raporlar/tasarim/${d.sablon.id}`
    } catch (e) { setHata([hataMetni(e), ...hataListesi(e)].join(' · ')); setOlusturuluyor(false) }
  }

  if (tur === 'belge' && belgeYerlesim === 'liste') return <>{belgeTasarim}</>

  return (
    <div className="space-y-4">
      <div>
        <GeriRozet href="/raporlar">Raporlar</GeriRozet>
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-3"><FileBarChart2 className="h-6 w-6" style={{ color: NAVY }} />Yeni Rapor</h1>
        <p className="text-sm text-muted-foreground mt-1">Önce türü seçin.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
        <button type="button" onClick={() => setTur('etkilesimli')} className={`text-left rounded-lg border-2 p-4 transition-colors hover:bg-[#DCEDF5]/40 ${tur === 'etkilesimli' ? 'border-[#1B4F72] bg-[#DCEDF5]/40' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 font-semibold" style={{ color: NAVY }}><MousePointerClick className="h-5 w-5" />{TUR_ADI.etkilesimli} <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-[#2AA5C7] text-[#06222C]">önerilen</span></div>
          <p className="text-sm text-muted-foreground mt-1.5">{TUR_ACIKLAMA.etkilesimli}</p>
        </button>
        <button type="button" onClick={() => setTur('belge')} className={`text-left rounded-lg border-2 p-4 transition-colors hover:bg-slate-50 ${tur === 'belge' ? 'border-[#1B4F72] bg-slate-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 font-semibold" style={{ color: NAVY }}><FileText className="h-5 w-5" />{TUR_ADI.belge}</div>
          <p className="text-sm text-muted-foreground mt-1.5">{TUR_ACIKLAMA.belge}</p>
        </button>
      </div>

      {tur === 'belge' && (
        <Card className="max-w-3xl">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setBelgeYerlesim('tuval')} className={`text-left rounded-lg border-2 p-3 transition-colors hover:bg-[#DCEDF5]/40 ${belgeYerlesim === 'tuval' ? 'border-[#1B4F72] bg-[#DCEDF5]/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: NAVY }}><LayoutTemplate className="h-4 w-4" />Serbest tasarım (tuval) <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-[#2AA5C7] text-[#06222C]">önerilen</span></div>
                <p className="text-xs text-muted-foreground mt-1">A4 sayfa + bantlar: öğeleri sürükleyerek yerleştir — föy, form, etiket, faturalı düzenler.</p>
              </button>
              <button type="button" onClick={() => setBelgeYerlesim('liste')} className={`text-left rounded-lg border-2 p-3 transition-colors hover:bg-slate-50 ${belgeYerlesim === 'liste' ? 'border-[#1B4F72] bg-slate-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: NAVY }}><List className="h-4 w-4" />Basit liste</div>
                <p className="text-xs text-muted-foreground mt-1">Kolon listesi + gruplar; hızlı dökümler için form tabanlı ekran.</p>
              </button>
            </div>
            {belgeYerlesim === 'tuval' && (
              <>
                <div className="grid gap-3 sm:grid-cols-[160px_1fr_1fr_1fr]">
                  <div className="space-y-1.5"><Label htmlFor="b-kod">Kod <span className="text-red-600">*</span></Label><Input id="b-kod" className="font-mono" value={kod} onChange={(e) => setKod(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="URT-020" /></div>
                  <div className="space-y-1.5"><Label htmlFor="b-ad">Ad <span className="text-red-600">*</span></Label><Input id="b-ad" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="İş Emri Föyü" /></div>
                  <div className="space-y-1.5"><Label htmlFor="b-kat">Kategori</Label><Input id="b-kat" list="kategori-onerileri" value={kategori} onChange={(e) => setKategori(e.target.value)} placeholder="Üretim" /></div>
                  <div className="space-y-1.5"><Label htmlFor="b-vs">Veri seti <span className="text-red-600">*</span></Label>
                    <NativeSelect id="b-vs" value={veriSetiId} onChange={(e) => setVeriSetiId(e.target.value)}><option value="">Seçin…</option>{veriSetleri.map((v) => <option key={v.id} value={v.id}>{v.ad}</option>)}</NativeSelect>
                  </div>
                </div>
                {alanlar && <p className="text-xs text-muted-foreground">İlk {Math.min(5, alanlar.length)} alan Detay bandına yerleştirilir; tuvalde serbestçe düzenlersiniz.</p>}
                {hata && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</div>}
                <div className="flex items-center gap-2">
                  <Button onClick={tuvalOlustur} disabled={olusturuluyor || kod.length < 2 || ad.trim().length < 2 || !veriSetiId || !alanlar} style={{ backgroundColor: NAVY }}>{olusturuluyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Oluştur ve tuvali aç</Button>
                  <span className="text-xs text-muted-foreground">Taslak olarak kaydedilir; tasarımı tuvalde tamamlayıp Yayında yapın.</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tur === 'etkilesimli' && (
        <Card className="max-w-3xl">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr_1fr_1fr]">
              <div className="space-y-1.5"><Label htmlFor="y-kod">Kod <span className="text-red-600">*</span></Label><Input id="y-kod" className="font-mono" value={kod} onChange={(e) => setKod(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="URT-010" /></div>
              <div className="space-y-1.5"><Label htmlFor="y-ad">Ad <span className="text-red-600">*</span></Label><Input id="y-ad" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="İş Emri Listesi" /></div>
              <div className="space-y-1.5"><Label htmlFor="y-kat">Kategori</Label>
                <NativeSelect id="y-kat" value={kategori} onChange={(e) => setKategori(e.target.value)}>
                  <option value="">— Seçilmedi —</option>
                  {KATEGORILER.map((k) => <option key={k} value={k}>{k}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-1.5"><Label htmlFor="y-vs">Veri seti <span className="text-red-600">*</span></Label>
                <NativeSelect id="y-vs" value={veriSetiId} onChange={(e) => setVeriSetiId(e.target.value)}><option value="">Seçin…</option>{veriSetleri.map((v) => <option key={v.id} value={v.id}>{v.ad}</option>)}</NativeSelect>
              </div>
            </div>
            {alanlar && (
              <p className="text-xs text-muted-foreground">{alanlar.length} alan görünür olarak açılacak: <span className="font-mono">{alanlar.map((a) => a.ad).join(', ')}</span>{veriSetiParametreleri(tanim).length > 0 && <> · parametreler: <span className="font-mono">{veriSetiParametreleri(tanim).join(', ')}</span></>}</p>
            )}
            {hata && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</div>}
            <div className="flex items-center gap-2">
              <Button onClick={olustur} disabled={olusturuluyor || kod.length < 2 || ad.trim().length < 2 || !veriSetiId || !alanlar} style={{ backgroundColor: NAVY }}>{olusturuluyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Oluştur ve aç</Button>
              <span className="text-xs text-muted-foreground">Taslak olarak kaydedilir; ekranda kurgulayıp "Görünümü kaydet" deyin, sonra Yayında yapın.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
