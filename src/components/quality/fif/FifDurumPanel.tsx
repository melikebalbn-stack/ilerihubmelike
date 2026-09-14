'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const DURUM_ETIKET: Record<string, string> = {
  TASLAK: 'Taslak', ONAY_BEKLIYOR: 'Onay Bekliyor', FAALIYET: 'Faaliyet',
  KAPATMA_BEKLIYOR: 'Kapatma Bekliyor', ETKINLIK: 'Etkinlik', KAPANDI: 'Kapandı', IPTAL: 'İptal',
}
const DURUM_RENK: Record<string, string> = {
  TASLAK: 'bg-slate-100 text-slate-700', ONAY_BEKLIYOR: 'bg-amber-100 text-amber-800',
  FAALIYET: 'bg-blue-100 text-blue-800', KAPATMA_BEKLIYOR: 'bg-amber-100 text-amber-800',
  ETKINLIK: 'bg-indigo-100 text-indigo-800', KAPANDI: 'bg-green-100 text-green-800', IPTAL: 'bg-red-100 text-red-700',
}

type Gecis = { hedef: string; etiket: string }
type GecmisSatir = { id: string; eskiDurum: string | null; yeniDurum: string; userAd: string | null; aciklama: string | null; createdAt: string }

/** Açıklama (neden) ZORUNLU olan geçişler: red'ler + IPTAL. */
const NEDEN_GEREKEN = new Set(['TASLAK', 'IPTAL']) // TASLAK'a dönüş = red; ayrıca KAPATMA_BEKLIYOR→FAALIYET red (aşağıda durumla ayrıştırılır)

export function FifDurumPanel({
  fifId, durum, gecisler, gecmis,
}: { fifId: string; durum: string; gecisler: Gecis[]; gecmis: GecmisSatir[] }) {
  const router = useRouter()
  const [modal, setModal] = useState<Gecis | null>(null)
  const [neden, setNeden] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [sekme, setSekme] = useState<'islem' | 'gecmis'>('islem')

  // Red = mevcut FAALIYET/ONAY_BEKLIYOR'dan geri dönüş; IPTAL. Bunlarda neden zorunlu.
  function nedenZorunlu(g: Gecis): boolean {
    if (g.hedef === 'IPTAL') return true
    if (durum === 'ONAY_BEKLIYOR' && g.hedef === 'TASLAK') return true
    if (durum === 'KAPATMA_BEKLIYOR' && g.hedef === 'FAALIYET') return true
    return false
  }

  async function uygula(g: Gecis, aciklama?: string) {
    setGonderiliyor(true); setHata(null)
    try {
      const r = await fetch(`/api/kalite/fif/${fifId}/durum`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hedef: g.hedef, aciklama: aciklama || undefined }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setHata(d.error ?? 'Geçiş başarısız'); setGonderiliyor(false); return }
      setModal(null); setNeden(''); router.refresh()
    } catch { setHata('Ağ hatası'); setGonderiliyor(false) }
  }

  function tikla(g: Gecis) {
    if (nedenZorunlu(g)) { setModal(g); setNeden(''); setHata(null) }
    else uygula(g)
  }

  return (
    <div className="rounded-md border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${DURUM_RENK[durum] ?? 'bg-slate-100'}`}>
            {DURUM_ETIKET[durum] ?? durum}
          </span>
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={() => setSekme('islem')} className={sekme === 'islem' ? 'font-semibold text-[#1B4F72]' : 'text-slate-400'}>İşlemler</button>
          <button onClick={() => setSekme('gecmis')} className={sekme === 'gecmis' ? 'font-semibold text-[#1B4F72]' : 'text-slate-400'}>Geçmiş ({gecmis.length})</button>
        </div>
      </div>

      {sekme === 'islem' ? (
        <div className="flex flex-wrap gap-2">
          {gecisler.length === 0 ? (
            <p className="text-xs text-slate-400">Bu durumda yapabileceğiniz bir işlem yok.</p>
          ) : gecisler.map((g) => (
            <Button key={g.hedef} size="sm" variant={g.hedef === 'IPTAL' ? 'outline' : 'default'}
              className={g.hedef === 'IPTAL' ? 'text-red-600 border-red-300' : 'bg-[#1B4F72] hover:bg-[#1B4F72]/90'}
              onClick={() => tikla(g)} disabled={gonderiliyor}>
              {g.etiket}
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-1 text-xs">
          {gecmis.length === 0 ? <p className="text-slate-400">Geçmiş yok.</p> : gecmis.map((h) => (
            <div key={h.id} className="flex gap-2 border-t py-1">
              <span className="text-slate-400 w-32 shrink-0">{new Date(h.createdAt).toLocaleString('tr-TR')}</span>
              <span className="font-medium">{h.eskiDurum ? `${DURUM_ETIKET[h.eskiDurum] ?? h.eskiDurum} → ` : ''}{DURUM_ETIKET[h.yeniDurum] ?? h.yeniDurum}</span>
              <span className="text-slate-500">{h.userAd ?? ''}{h.aciklama ? ` — ${h.aciklama}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {hata && sekme === 'islem' && <p className="text-sm text-red-600">{hata}</p>}

      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => !gonderiliyor && setModal(null)}>
          <div className="bg-white rounded-md p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-[#1B4F72]">{modal.etiket} — gerekçe</h4>
            <Textarea rows={3} value={neden} onChange={(e) => setNeden(e.target.value)} placeholder="Gerekçe (zorunlu)" />
            {hata && <p className="text-sm text-red-600">{hata}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setModal(null)} disabled={gonderiliyor}>Vazgeç</Button>
              <Button size="sm" className="bg-[#1B4F72]" disabled={gonderiliyor || !neden.trim()} onClick={() => uygula(modal, neden)}>Onayla</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export { DURUM_ETIKET, DURUM_RENK }
