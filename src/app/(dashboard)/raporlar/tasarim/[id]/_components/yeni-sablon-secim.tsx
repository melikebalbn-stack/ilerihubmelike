'use client'

/**
 * /raporlar/tasarim/yeni — en üstte tür seçimi.
 *  Etkileşimli (önerilen): kod + ad + veri seti → "Oluştur" → tüm alanlar görünür varsayılan görünümle
 *    kaydedilir → doğrudan /raporlar/[id] (kullanıcı orada kurgular, "Görünümü kaydet" der).
 *  Basılı belge: mevcut şablon tasarım ekranı (SablonTasarimClient).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/select'
import { FileBarChart2, FileText, Loader2, MousePointerClick, Plus } from 'lucide-react'
import { varsayilanGorunum } from '@/lib/rapor/gorunum'
import { veriSetiParametreleri } from '@/lib/rapor/sablon-dogrula'
import type { EtkilesimliIcerik, SablonParametre, VeriSetiTanim } from '@/lib/rapor/tipler'
import { GeriRozet } from '../../../_components/rozet-link'

const NAVY = '#1B4F72'

interface Props { veriSetleri: { id: string; ad: string }[]; belgeTasarim: ReactNode }

export default function YeniSablonSecim({ veriSetleri, belgeTasarim }: Props) {
  const router = useRouter()
  const [tur, setTur] = useState<'etkilesimli' | 'belge' | null>(null)
  const [kod, setKod] = useState('')
  const [ad, setAd] = useState('')
  const [veriSetiId, setVeriSetiId] = useState('')
  const [alanlar, setAlanlar] = useState<{ ad: string; veriTipi: string; etiket: string | null }[] | null>(null)
  const [tanim, setTanim] = useState<VeriSetiTanim | null>(null)
  const [olusturuluyor, setOlusturuluyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    if (!veriSetiId) { setAlanlar(null); setTanim(null); return }
    fetch(`/api/raporlar/veri-setleri/${veriSetiId}`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`); setAlanlar(d.alanlar ?? []); setTanim(d.veriSeti?.tanim ?? null) }).catch((e: Error) => setHata(e.message))
  }, [veriSetiId])

  async function olustur() {
    if (!alanlar) return
    setOlusturuluyor(true); setHata(null)
    try {
      // Veri setindeki {p.x} yer tutucuları otomatik parametre olur (ad sezgisi: tarih/başlangıç/bitiş → tarih).
      const parametreler: SablonParametre[] = veriSetiParametreleri(tanim).map((p) => ({ ad: p, tip: /tarih|baslangic|bitis|date/i.test(p) ? 'tarih' : 'metin', etiket: p, zorunlu: true }))
      const icerik: EtkilesimliIcerik = { tur: 'etkilesimli', baslik: ad.trim(), parametreler, gorunum: varsayilanGorunum(alanlar) }
      const r = await fetch('/api/raporlar/sablonlar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kod, ad, aciklama: '', veriSetiId, icerik, durum: 'TASLAK' }) })
      const d = await r.json()
      if (!r.ok) throw new Error([d.error, ...(d.hatalar ?? [])].filter(Boolean).join(' · '))
      // Ön-ek olmayan hedef → soft-nav güvenli; yine de tam yükleme (yeni sayfa server verisi).
      window.location.href = `/raporlar/${d.sablon.id}`
    } catch (e) { setHata(e instanceof Error ? e.message : String(e)); setOlusturuluyor(false) }
  }

  if (tur === 'belge') return <>{belgeTasarim}</>

  return (
    <div className="space-y-4">
      <div>
        <GeriRozet href="/raporlar">Raporlar</GeriRozet>
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-3"><FileBarChart2 className="h-6 w-6" style={{ color: NAVY }} />Yeni Rapor</h1>
        <p className="text-sm text-muted-foreground mt-1">Önce türü seçin.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
        <button type="button" onClick={() => setTur('etkilesimli')} className={`text-left rounded-lg border-2 p-4 transition-colors hover:bg-[#DCEDF5]/40 ${tur === 'etkilesimli' ? 'border-[#1B4F72] bg-[#DCEDF5]/40' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 font-semibold" style={{ color: NAVY }}><MousePointerClick className="h-5 w-5" />Etkileşimli rapor <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-[#2AA5C7] text-[#06222C]">önerilen</span></div>
          <p className="text-sm text-muted-foreground mt-1.5">Ekranda kolon aç/kapa, sürükleyerek grupla, sırala, süz, toplam/ortalama, grafik. Görünüm kaydedilir; Excel aynı görünümle iner.</p>
        </button>
        <button type="button" onClick={() => setTur('belge')} className="text-left rounded-lg border-2 border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50">
          <div className="flex items-center gap-2 font-semibold" style={{ color: NAVY }}><FileText className="h-5 w-5" />Basılı belge</div>
          <p className="text-sm text-muted-foreground mt-1.5">A4 yazdırmaya uygun sabit düzen: kolon genişlikleri, 3 seviye grup, koşullu biçim, sayfa altı. Şablon tasarım ekranında kurgulanır.</p>
        </button>
      </div>

      {tur === 'etkilesimli' && (
        <Card className="max-w-3xl">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr_1fr]">
              <div className="space-y-1.5"><Label htmlFor="y-kod">Kod <span className="text-red-600">*</span></Label><Input id="y-kod" className="font-mono" value={kod} onChange={(e) => setKod(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="URT-010" /></div>
              <div className="space-y-1.5"><Label htmlFor="y-ad">Ad <span className="text-red-600">*</span></Label><Input id="y-ad" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="İş Emri Listesi" /></div>
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
