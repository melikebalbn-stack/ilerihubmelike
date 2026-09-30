'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff, Loader2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  DURUM_ACIKLAMALARI,
  DURUM_ETIKETLERI,
  MODUL_DURUMLARI,
  type ModulDurum,
} from '@/lib/modul-durum/kayit'

export interface ModulSatiri {
  anahtar: string
  etiket: string
  rota: string
  durum: ModulDurum
  pilotBolumler: string[]
}

interface Props {
  moduller: ModulSatiri[]
  bolumler: string[]
}

const DURUM_STILI: Record<ModulDurum, string> = {
  GIZLI: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  PILOT: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  ACIK: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
}

const DURUM_IKONU: Record<ModulDurum, typeof Eye> = {
  GIZLI: EyeOff,
  PILOT: Users,
  ACIK: Eye,
}

export function ModulDurumPaneli({ moduller: ilk, bolumler }: Props) {
  const [moduller, setModuller] = useState<ModulSatiri[]>(ilk)
  const [kaydediliyor, setKaydediliyor] = useState<string | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [kaydedildi, setKaydedildi] = useState<string | null>(null)

  const satiriDegistir = (anahtar: string, yama: Partial<ModulSatiri>) =>
    setModuller((ms) => ms.map((m) => (m.anahtar === anahtar ? { ...m, ...yama } : m)))

  async function kaydet(satir: ModulSatiri) {
    setHata(null)
    setKaydedildi(null)
    setKaydediliyor(satir.anahtar)
    try {
      const res = await fetch('/api/yonetim/modul-durum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anahtar: satir.anahtar,
          durum: satir.durum,
          pilotBolumler: satir.pilotBolumler,
        }),
      })
      if (!res.ok) {
        const g = (await res.json().catch(() => null)) as { error?: string } | null
        setHata(g?.error ?? 'Kaydedilemedi')
        return
      }
      setKaydedildi(satir.anahtar)
      setTimeout(() => setKaydedildi((k) => (k === satir.anahtar ? null : k)), 2500)
    } catch {
      setHata('Sunucuya ulaşılamadı')
    } finally {
      setKaydediliyor(null)
    }
  }

  if (moduller.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Kayıtlı modül yok. Yeni modül eklemek için src/lib/modul-durum/kayit.ts dosyasına bir
        satır ekleyin.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {hata && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {hata}
        </p>
      )}

      {moduller.map((m) => {
        const Ikon = DURUM_IKONU[m.durum]
        const bekliyor = kaydediliyor === m.anahtar
        return (
          <Card key={m.anahtar}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ikon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{m.etiket}</span>
                </CardTitle>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{m.rota}</p>
              </div>
              <Badge className={DURUM_STILI[m.durum]}>{DURUM_ETIKETLERI[m.durum]}</Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {MODUL_DURUMLARI.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={m.durum === d ? 'default' : 'outline'}
                    onClick={() => satiriDegistir(m.anahtar, { durum: d })}
                  >
                    {DURUM_ETIKETLERI[d]}
                  </Button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">{DURUM_ACIKLAMALARI[m.durum]}</p>

              {m.durum === 'PILOT' && (
                <div className="space-y-2 rounded-md border p-3">
                  <Label className="text-sm">Pilot bölümler</Label>
                  <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                    {bolumler.map((b) => {
                      const secili = m.pilotBolumler.includes(b)
                      return (
                        <label key={b} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={secili}
                            onCheckedChange={(v) =>
                              satiriDegistir(m.anahtar, {
                                pilotBolumler: v
                                  ? [...m.pilotBolumler, b]
                                  : m.pilotBolumler.filter((x) => x !== b),
                              })
                            }
                          />
                          <span className="truncate">{b}</span>
                        </label>
                      )
                    })}
                  </div>
                  {m.pilotBolumler.length === 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      En az bir bölüm seçin — seçim olmadan pilot kaydedilemez.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button type="button" size="sm" onClick={() => kaydet(m)} disabled={bekliyor}>
                  {bekliyor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Kaydet
                </Button>
                {kaydedildi === m.anahtar && (
                  <span className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300">
                    <Check className="h-4 w-4" /> Kaydedildi
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
