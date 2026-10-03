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
            {bekleyen.zincirleme ? (
              <p className="text-sm text-muted-foreground">
                Onaylarsanız aşağıdaki kayıtlar firmayla <strong>birlikte pasifleşir / kapanır</strong> (atamalar bugünün
                tarihiyle kapatılır). Tek işlemde yapılır ve hepsi işlem geçmişine yazılır.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Bu kayıt pasifleştirilirse aşağıdaki aktif kayıtlar <strong>aktif kalır</strong> (otomatik kapatılmaz) ve
                gözden geçirilmelidir.
              </p>
            )}
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
            {bekleyen.notlar.map((not) => (
              <p key={not} className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">{not}</p>
            ))}
            <p className="text-xs text-muted-foreground">
              Onayınız ve bağlı kayıt özeti işlem geçmişine yazılır.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={vazgec}>Vazgeç</Button>
          <Button variant="destructive" onClick={onayla}>
            {bekleyen?.zincirleme ? 'Firmayı ve Bağlı Kayıtları Pasifleştir' : 'Yine de Pasifleştir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
