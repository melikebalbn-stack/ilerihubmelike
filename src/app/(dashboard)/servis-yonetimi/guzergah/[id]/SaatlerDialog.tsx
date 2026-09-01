'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { GuzergahDurak, GuzergahDurakSaat, SeferDilimi } from './types'

export function SaatlerDialog({
  guzergahId,
  guzergahDurak,
  dilimler,
  canManage,
  canPassive,
  canRestore,
  onOpenChange,
  onSaved,
}: {
  guzergahId: string
  guzergahDurak: GuzergahDurak | null
  dilimler: SeferDilimi[]
  canManage: boolean
  canPassive: boolean
  canRestore: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [saatler, setSaatler] = useState<Record<string, string>>({})
  const [hata, setHata] = useState<string | null>(null)
  const [pasifleriGoster, setPasifleriGoster] = useState(false)
  const [tumSaatler, setTumSaatler] = useState<GuzergahDurakSaat[]>([])

  const guzergahDurakId = guzergahDurak?.id

  useEffect(() => {
    if (!guzergahDurak) {
      setSaatler({})
      setPasifleriGoster(false)
      setTumSaatler([])
      return
    }
    const baslangic: Record<string, string> = {}
    for (const s of guzergahDurak.saatler) baslangic[s.dilimId] = s.saat
    setSaatler(baslangic)
    setTumSaatler(guzergahDurak.saatler)
  }, [guzergahDurak])

  const yukleTumSaatler = useCallback(async () => {
    if (!guzergahDurakId) return
    const res = await fetch(`/api/servis-yonetimi/guzergah/${guzergahId}/durak?saatlerPasifDahil=true`)
    const json = await res.json()
    if (!res.ok || !json.ok) return
    const guncelDurak = (json.data as GuzergahDurak[]).find((d) => d.id === guzergahDurakId)
    setTumSaatler(guncelDurak?.saatler || [])
  }, [guzergahId, guzergahDurakId])

  useEffect(() => {
    if (pasifleriGoster) yukleTumSaatler()
  }, [pasifleriGoster, yukleTumSaatler])

  if (!guzergahDurak) {
    return <Dialog open={false} onOpenChange={onOpenChange}><DialogContent /></Dialog>
  }

  async function kaydet(dilimId: string) {
    setHata(null)
    const saat = saatler[dilimId]?.trim()
    if (!saat) return
    const res = await fetch(`/api/servis-yonetimi/guzergah-durak/${guzergahDurak!.id}/saat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dilimId, saat }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Saat kaydedilemedi.')
      return
    }
    if (pasifleriGoster) yukleTumSaatler()
    onSaved()
  }

  async function pasiflestir(saatId: string, dilimId: string) {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-durak-saat/${saatId}/pasiflestir`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Saat kaydı pasifleştirilemedi.')
      return
    }
    setSaatler((s) => ({ ...s, [dilimId]: '' }))
    if (pasifleriGoster) yukleTumSaatler()
    onSaved()
  }

  async function geriAl(saatId: string) {
    setHata(null)
    const res = await fetch(`/api/servis-yonetimi/guzergah-durak-saat/${saatId}/geri-al`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setHata(json.message || 'Saat kaydı geri alınamadı.')
      return
    }
    await yukleTumSaatler()
    onSaved()
  }

  const pasifSaatler = tumSaatler.filter((s) => !s.aktif)

  return (
    <Dialog open={!!guzergahDurak} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{guzergahDurak.durak.kod} — Dilim Saatleri</DialogTitle>
        </DialogHeader>
        {hata && <p className="text-sm text-red-600">{hata}</p>}
        <div className="space-y-3">
          {dilimler.length === 0 && (
            <p className="text-sm text-muted-foreground">Aktif sefer dilimi yok — önce Sefer Dilimleri sekmesinden ekleyin.</p>
          )}
          {dilimler.map((dilim) => {
            const mevcutSaat = guzergahDurak.saatler.find((s) => s.dilimId === dilim.id)
            return (
              <div key={dilim.id} className="flex items-center gap-2">
                <Label className="w-40 shrink-0 text-sm font-normal">
                  {dilim.kod} ({dilim.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'})
                </Label>
                <Input
                  type="time"
                  disabled={!canManage}
                  value={saatler[dilim.id] || ''}
                  onChange={(e) => setSaatler((s) => ({ ...s, [dilim.id]: e.target.value }))}
                />
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => kaydet(dilim.id)}>Kaydet</Button>
                )}
                {mevcutSaat && canPassive && (
                  <Button size="sm" variant="ghost" aria-label="Pasifleştir" onClick={() => pasiflestir(mevcutSaat.id, dilim.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 border-t pt-3">
          <Checkbox
            id="pasif-saatler-goster"
            checked={pasifleriGoster}
            onCheckedChange={(checked) => setPasifleriGoster(checked === true)}
          />
          <Label htmlFor="pasif-saatler-goster" className="text-sm font-normal">
            Pasifleri göster
          </Label>
        </div>

        {pasifleriGoster && (
          <div className="space-y-2">
            {pasifSaatler.length === 0 && (
              <p className="text-sm text-muted-foreground">Pasif saat kaydı yok.</p>
            )}
            {pasifSaatler.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border border-dashed p-2 text-sm text-muted-foreground"
              >
                <span>
                  {s.dilim.kod} ({s.dilim.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'}) — {s.saat}
                </span>
                {canRestore && (
                  <Button size="sm" variant="outline" onClick={() => geriAl(s.id)}>
                    Geri Al
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
