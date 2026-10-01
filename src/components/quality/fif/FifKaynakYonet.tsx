'use client'

import { useCallback, useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

type Kaynak = { id: string; ad: string; aktif: boolean; sira: number }

/**
 * "Kaynakları Yönet" (Paket 3) — FİF kaynak listesi. Yalnız KSS/manage'e
 * gösterilir (liste sayfası karar verir; API de ayrıca kontrol eder).
 * Silme YOK: kaynak pasife alınır, geçmiş FİF'lerde adı görünmeye devam eder.
 */
export function FifKaynakYonet() {
  const [acik, setAcik] = useState(false)
  const [kaynaklar, setKaynaklar] = useState<Kaynak[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [yeniAd, setYeniAd] = useState('')
  const [mesgul, setMesgul] = useState(false)
  // Satır içi düzenleme taslağı (ad/sıra) — kaydedilince sunucuya gider.
  const [taslak, setTaslak] = useState<Record<string, { ad: string; sira: string }>>({})

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    try {
      const r = await fetch('/api/kalite/fif/kaynak')
      const d = r.ok ? await r.json() : { kaynaklar: [] }
      const liste: Kaynak[] = d.kaynaklar ?? []
      setKaynaklar(liste)
      setTaslak(Object.fromEntries(liste.map((k) => [k.id, { ad: k.ad, sira: String(k.sira) }])))
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => { if (acik) yukle() }, [acik, yukle])

  async function istek(method: 'POST' | 'PATCH', govde: Record<string, unknown>, basari: string) {
    setMesgul(true)
    try {
      const r = await fetch('/api/kalite/fif/kaynak', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.error ?? 'İşlem başarısız'); return false }
      toast.success(basari)
      await yukle()
      return true
    } catch {
      toast.error('Ağ hatası')
      return false
    } finally {
      setMesgul(false)
    }
  }

  async function ekle() {
    const ad = yeniAd.trim()
    if (!ad) return
    const sira = kaynaklar.length ? Math.max(...kaynaklar.map((k) => k.sira)) + 1 : 0
    if (await istek('POST', { ad, sira }, 'Kaynak eklendi')) setYeniAd('')
  }

  async function kaydet(k: Kaynak) {
    const t = taslak[k.id]
    if (!t) return
    const sira = Number.parseInt(t.sira, 10)
    const govde: Record<string, unknown> = { id: k.id }
    if (t.ad.trim() && t.ad.trim() !== k.ad) govde.ad = t.ad.trim()
    if (Number.isFinite(sira) && sira >= 0 && sira !== k.sira) govde.sira = sira
    if (Object.keys(govde).length === 1) return
    await istek('PATCH', govde, 'Kaynak güncellendi')
  }

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings2 className="h-4 w-4" /> Kaynakları Yönet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[#1B4F72]">FİF Kaynakları</DialogTitle>
          <DialogDescription>
            Formdaki &quot;Denetleme / Kaynak&quot; listesi. Kaynak silinmez; kullanılmayacaksa pasife alın.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={yeniAd}
            onChange={(e) => setYeniAd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ekle() }}
            placeholder="Yeni kaynak adı (ör. Müşteri Şikâyeti)"
            disabled={mesgul}
          />
          <Button onClick={ekle} disabled={mesgul || !yeniAd.trim()} className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">Ekle</Button>
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">Ad</th>
                <th className="text-left px-3 py-2 w-20">Sıra</th>
                <th className="text-center px-3 py-2 w-20">Aktif</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {yukleniyor ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Yükleniyor…</td></tr>
              ) : kaynaklar.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Henüz kaynak yok</td></tr>
              ) : kaynaklar.map((k) => {
                const t = taslak[k.id] ?? { ad: k.ad, sira: String(k.sira) }
                const degisti = t.ad.trim() !== k.ad || t.sira !== String(k.sira)
                return (
                  <tr key={k.id} className={`border-t ${k.aktif ? '' : 'bg-slate-50 text-slate-400'}`}>
                    <td className="px-3 py-1.5">
                      <Input className="h-8" value={t.ad} disabled={mesgul}
                        onChange={(e) => setTaslak((p) => ({ ...p, [k.id]: { ...t, ad: e.target.value } }))} />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input className="h-8" type="number" min={0} value={t.sira} disabled={mesgul}
                        onChange={(e) => setTaslak((p) => ({ ...p, [k.id]: { ...t, sira: e.target.value } }))} />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <Switch checked={k.aktif} disabled={mesgul}
                        onCheckedChange={(v) => istek('PATCH', { id: k.id, aktif: v }, v ? 'Kaynak aktif edildi' : 'Kaynak pasife alındı')} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {degisti && (
                        <Button size="sm" variant="outline" disabled={mesgul} onClick={() => kaydet(k)}>Kaydet</Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
