'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { BagimlilikOnayBekleyen } from '../_lib/usePasifGeriAl'

// A4 — pasifleştirmeden önce bağlı AKTİF kayıtlar gösterilir; kullanıcı açıkça
// onaylamadan işlem yapılmaz. Bağlı kayıtlar OTOMATİK kapatılmaz.
// KVKK: kişi içeren gruplarda (personel/şoför) yalnız sayı gösterilir.
export function BagimlilikOnayDialog({
  bekleyen,
  onayla,
  vazgec,
}: {
  bekleyen: BagimlilikOnayBekleyen | null
  onayla: () => void
  vazgec: () => void
}) {
  return (
    <Dialog open={!!bekleyen} onOpenChange={(o) => !o && vazgec()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Bağlı aktif kayıtlar var</DialogTitle></DialogHeader>
        {bekleyen && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bu kayıt pasifleştirilirse aşağıdaki aktif kayıtlar <strong>aktif kalır</strong> (otomatik kapatılmaz) ve
              gözden geçirilmelidir.
            </p>
            <ul className="space-y-2 rounded-md border p-3 text-sm" aria-label="Bağlı aktif kayıtlar">
              {bekleyen.bagimliliklar.map((g) => (
                <li key={g.tur}>
                  <span className="font-medium">{g.etiket}: {g.sayi}</span>
                  {g.ornekler.length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {g.ornekler.join(', ')}
                      {g.sayi > g.ornekler.length ? ` ve ${g.sayi - g.ornekler.length} tane daha` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Onayınız ve bağlı kayıt özeti işlem geçmişine yazılır.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={vazgec}>Vazgeç</Button>
          <Button variant="destructive" onClick={onayla}>Yine de Pasifleştir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
