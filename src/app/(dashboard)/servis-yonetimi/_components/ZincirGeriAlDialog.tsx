'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ZincirGeriAlSecim } from '../_lib/usePasifGeriAl'

// A5 — firma geri alınırken: "Birlikte pasifleşen N kayıt da geri alınsın mı?"
// Yalnız O zincirleme işlemle pasifleşenler geri gelir; önceden ayrıca pasifleştirilmiş
// kayıtlara dokunulmaz. Kapatılan atamalar geri ALINMAZ (yalnız bilgi).
export function ZincirGeriAlDialog({
  secim,
  birlikte,
  yalnizFirma,
  vazgec,
}: {
  secim: ZincirGeriAlSecim | null
  birlikte: () => void
  yalnizFirma: () => void
  vazgec: () => void
}) {
  const o = secim?.onizleme
  const toplam = o ? o.geriAlinabilirArac + o.geriAlinabilirSofor : 0
  return (
    <Dialog open={!!secim} onOpenChange={(a) => !a && vazgec()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Birlikte pasifleşen {toplam} kayıt da geri alınsın mı?</DialogTitle>
        </DialogHeader>
        {o && (
          <div className="space-y-3 text-sm">
            <ul className="space-y-1 rounded-md border p-3" aria-label="Birlikte geri alınabilecek kayıtlar">
              {o.geriAlinabilirArac > 0 && <li>Araç: {o.geriAlinabilirArac}</li>}
              {o.geriAlinabilirSofor > 0 && <li>Şoför: {o.geriAlinabilirSofor}</li>}
            </ul>
            <p className="text-xs text-muted-foreground">
              Yalnızca bu firmayla birlikte pasifleşenler geri gelir; daha önce ayrıca pasifleştirilmiş kayıtlara
              dokunulmaz.
            </p>
            {o.kapananAtama > 0 && (
              <p className="rounded-md bg-amber-50 p-2 text-amber-800">
                Bu işlemle {o.kapananAtama} varsayılan atama kapatılmıştı; atamalar <strong>geri alınmaz</strong>,
                gerekirse güzergâh detayından yeniden atanır.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={vazgec}>Vazgeç</Button>
          <Button variant="outline" onClick={yalnizFirma}>Yalnız Firmayı Geri Al</Button>
          <Button onClick={birlikte}>Birlikte Geri Al</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
