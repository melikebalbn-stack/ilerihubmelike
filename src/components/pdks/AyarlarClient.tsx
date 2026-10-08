'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

type Tanim = { key: string; grup: string; etiket: string; tip: 'bool' | 'saat' | 'tamsayi' | 'metin'; varsayilan: string; aciklama?: string }

const GRUPLAR = ['Puantaj', 'Bildirim', 'Anomali'] as const

export function AyarlarClient() {
  const [tanimlar, setTanimlar] = useState<Tanim[]>([])
  const [degerler, setDegerler] = useState<Record<string, string>>({})
  const [hata, setHata] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [kaydediyor, setKaydediyor] = useState(false)

  const oku = useCallback(() => {
    setYukleniyor(true)
    fetch('/api/pdks/ayarlar')
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setHata(j.error ?? 'Ayarlar alınamadı')
        setTanimlar(j.tanimlar)
        setDegerler(j.degerler)
      })
      .catch(() => setHata('Ayarlar alınamadı'))
      .finally(() => setYukleniyor(false))
  }, [])

  useEffect(() => oku(), [oku])

  const kaydet = () => {
    setKaydediyor(true)
    setHata(null)
    setMesaj(null)
    fetch('/api/pdks/ayarlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ degerler }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setHata(j.error ?? 'Kaydedilemedi')
        setDegerler(j.degerler)
        setMesaj('Ayarlar kaydedildi.')
      })
      .catch(() => setHata('Kaydedilemedi'))
      .finally(() => setKaydediyor(false))
  }

  const set = (key: string, v: string) => setDegerler((d) => ({ ...d, [key]: v }))

  if (yukleniyor) {
    return <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…</div>
  }

  return (
    <div className="space-y-4">
      {mesaj && <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{mesaj}</div>}
      {hata && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{hata}</div>}

      {GRUPLAR.map((grup) => {
        const alanlar = tanimlar.filter((t) => t.grup === grup)
        if (!alanlar.length) return null
        return (
          <Card key={grup}>
            <CardContent className="space-y-4 p-5">
              <h2 className="text-sm font-semibold text-[#1B4F72]">{grup}</h2>
              <div className="space-y-4">
                {alanlar.map((t) => (
                  <div key={t.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <div className="sm:w-72">
                      <div className="text-sm text-slate-800">{t.etiket}</div>
                      {t.aciklama && <div className="text-xs text-slate-400">{t.aciklama}</div>}
                    </div>
                    <div className="sm:flex-1">
                      {t.tip === 'bool' ? (
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={degerler[t.key] === 'true'}
                            onChange={(e) => set(t.key, e.target.checked ? 'true' : 'false')}
                          />
                          <span className="text-slate-500">{degerler[t.key] === 'true' ? 'Açık' : 'Kapalı'}</span>
                        </label>
                      ) : (
                        <Input
                          value={degerler[t.key] ?? ''}
                          onChange={(e) => set(t.key, e.target.value)}
                          inputMode={t.tip === 'tamsayi' ? 'numeric' : undefined}
                          placeholder={t.varsayilan}
                          className={t.tip === 'metin' ? 'w-full sm:max-w-md' : 'w-40'}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}

      <div className="flex justify-end">
        <Button onClick={kaydet} disabled={kaydediyor}>
          {kaydediyor ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Kaydet
        </Button>
      </div>
    </div>
  )
}
