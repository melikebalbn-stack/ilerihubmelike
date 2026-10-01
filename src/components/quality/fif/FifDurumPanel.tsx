'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { FIF_DURUM_ETIKET as DURUM_ETIKET, FIF_DURUM_RENK as DURUM_RENK } from '@/lib/quality/fif-durum-etiket'


/** pasifSebep doluysa buton PASİF gösterilir (ör. "Tüm faaliyetler kapatılmalı"). */
type Gecis = { hedef: string; etiket: string; pasifSebep?: string }

/**
 * Durum paneli: mevcut adım + KİMDE BEKLİYOR + yapılabilecek geçişler.
 * Geçmiş ayrı "Geçmiş" bölümünde (FifGecmisPanel). Yeni akışta ETKINLIK → KAPANDI
 * "Tamamen Kapat" onay penceresiyle gönderilir; yayılım/KYS kararı bu adımda DEĞİL,
 * KSS kapanış kontrolünde (formdaki Kapanış Değerlendirmesi) — hub/main gibi.
 */
export function FifDurumPanel({
  fifId, durum, gecisler, kimde, yeniAkis,
}: {
  fifId: string; durum: string; gecisler: Gecis[]; kimde: string; yeniAkis: boolean
}) {
  const router = useRouter()
  const [modal, setModal] = useState<Gecis | null>(null)
  const [neden, setNeden] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [kapanisAcik, setKapanisAcik] = useState(false)

  // Red geçişleri + IPTAL: neden zorunlu. Liste durum/route.ts RED_GECISLERI ile aynı
  // olmalı — KSS red'leri eksikken pencere açılmıyor, API 400 dönüyordu.
  function nedenZorunlu(g: Gecis): boolean {
    if (g.hedef === 'IPTAL') return true
    if (durum === 'ONAY_BEKLIYOR' && g.hedef === 'TASLAK') return true
    if (durum === 'KSS_KAYIT_BEKLIYOR' && g.hedef === 'TASLAK') return true
    if (durum === 'KAPATMA_BEKLIYOR' && g.hedef === 'FAALIYET') return true
    if (durum === 'KSS_KAPANIS_BEKLIYOR' && g.hedef === 'FAALIYET') return true
    return false
  }
  const tamamenKapatMi = (g: Gecis) => yeniAkis && durum === 'ETKINLIK' && g.hedef === 'KAPANDI'

  async function uygula(g: Gecis, ek: { aciklama?: string } = {}) {
    setGonderiliyor(true); setHata(null)
    try {
      const r = await fetch(`/api/kalite/fif/${fifId}/durum`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hedef: g.hedef,
          aciklama: ek.aciklama || undefined,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setHata(d.error ?? 'Geçiş başarısız'); setGonderiliyor(false); return }
      setModal(null); setNeden(''); setKapanisAcik(false)
      setGonderiliyor(false)
      // IPTAL sonrası kayıt işlemsiz kalır; listeye dön. Diğer geçişlerde detayda kal.
      if (g.hedef === 'IPTAL') { toast.success('FİF iptal edildi'); router.push('/kalite/fif') }
      else if (d.kayitNo && durum === 'KSS_KAYIT_BEKLIYOR') toast.success(`Kayda alındı: ${d.kayitNo}`)
      router.refresh()
    } catch { setHata('Ağ hatası'); setGonderiliyor(false) }
  }

  function tikla(g: Gecis) {
    setHata(null)
    if (tamamenKapatMi(g)) setKapanisAcik(true)
    else if (nedenZorunlu(g)) { setModal(g); setNeden('') }
    else uygula(g)
  }

  const kapanisGecis = gecisler.find(tamamenKapatMi)

  return (
    <div className="rounded-md border bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${DURUM_RENK[durum] ?? 'bg-slate-100'}`}>
          {DURUM_ETIKET[durum] ?? durum}
        </span>
        <span className="text-sm text-slate-600">
          <span className="text-slate-400">Kimde bekliyor:</span> <span className="font-medium">{kimde}</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {gecisler.length === 0 ? (
          <p className="text-xs text-slate-400">Bu durumda yapabileceğiniz bir işlem yok.</p>
        ) : gecisler.map((g) => (
          <div key={g.hedef} className="flex flex-col items-start gap-0.5">
            <Button size="sm" variant={g.hedef === 'IPTAL' ? 'outline' : 'default'}
              className={g.hedef === 'IPTAL' ? 'text-red-600 border-red-300' : 'bg-[#1B4F72] hover:bg-[#1B4F72]/90'}
              onClick={() => tikla(g)} disabled={gonderiliyor || !!g.pasifSebep} title={g.pasifSebep}>
              {g.etiket}
            </Button>
            {g.pasifSebep && <span className="text-[11px] text-amber-700">{g.pasifSebep}</span>}
          </div>
        ))}
      </div>

      {hata && !modal && !kapanisAcik && <p className="text-sm text-red-600">{hata}</p>}

      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => !gonderiliyor && setModal(null)}>
          <div className="bg-white rounded-md p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-[#1B4F72]">{modal.etiket} — gerekçe</h4>
            <Textarea rows={3} value={neden} onChange={(e) => setNeden(e.target.value)} placeholder="Gerekçe (zorunlu)" />
            {hata && <p className="text-sm text-red-600">{hata}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setModal(null)} disabled={gonderiliyor}>Vazgeç</Button>
              <Button size="sm" className="bg-[#1B4F72]" disabled={gonderiliyor || !neden.trim()} onClick={() => uygula(modal, { aciklama: neden })}>Onayla</Button>
            </div>
          </div>
        </div>
      )}

      {kapanisGecis && (
        <Dialog open={kapanisAcik} onOpenChange={(v) => !gonderiliyor && setKapanisAcik(v)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-[#1B4F72]">FİF&apos;i tamamen kapat</DialogTitle>
              <DialogDescription>
                Tüm faaliyetlerin etkinliği onaylandı. FİF &quot;Kapandı&quot; olur; bu işlem geri alınamaz.
              </DialogDescription>
            </DialogHeader>
            {hata && <p className="text-sm text-red-600">{hata}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setKapanisAcik(false)} disabled={gonderiliyor}>Vazgeç</Button>
              <Button className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
                disabled={gonderiliyor}
                onClick={() => uygula(kapanisGecis)}>
                {gonderiliyor ? 'Kapatılıyor…' : 'Tamamen Kapat'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
export { DURUM_ETIKET, DURUM_RENK }
