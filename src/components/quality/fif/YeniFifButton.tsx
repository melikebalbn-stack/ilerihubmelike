'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** "Yeni FİF": boş TASLAK oluşturur (POST) ve doğrudan detaya gider. */
export function YeniFifButton() {
  const router = useRouter()
  const [mesgul, setMesgul] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  async function olustur() {
    setMesgul(true); setHata(null)
    try {
      // Yalnız tür varsayılanı; sorumlu bölüm/tespit detayda doldurulur.
      const r = await fetch('/api/kalite/fif', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tur: 'DUZELTICI' }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.item?.id) { setHata(d.error ?? 'Taslak oluşturulamadı'); setMesgul(false); return }
      router.push(`/kalite/fif/${d.item.id}`)
    } catch { setHata('Ağ hatası'); setMesgul(false) }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={olustur} disabled={mesgul} className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 shrink-0 inline-flex items-center gap-1">
        <Plus className="h-4 w-4 shrink-0" />
        {mesgul ? 'Oluşturuluyor…' : 'Yeni FİF'}
      </Button>
      {hata && <span className="text-xs text-red-600">{hata}</span>}
    </div>
  )
}
