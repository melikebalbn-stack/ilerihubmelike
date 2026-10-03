'use client'

import { Button } from '@/components/ui/button'

// Pasifleştir / Geri Al düğmesi — doğru yetkiyle: Pasifleştir yalnız
// `servis.passive`, Geri Al yalnız `servis.restore` ile görünür. (Eskiden ikisi de
// `servis.tanim.manage`'e bağlıydı: idari-isler rolü düğmeyi görüyor ama API 403
// veriyordu.) Güzergâh detay sayfasındaki canPassive/canRestore deseniyle aynı.
export function PasifGeriAlButonlari({
  aktif,
  canPassive,
  canRestore,
  onPasiflestir,
  onGeriAl,
}: {
  aktif: boolean
  canPassive: boolean
  canRestore: boolean
  onPasiflestir: () => void
  onGeriAl: () => void
}) {
  if (aktif) {
    return canPassive ? (
      <Button size="sm" className="h-7 px-2" variant="destructive" onClick={onPasiflestir}>
        Pasifleştir
      </Button>
    ) : null
  }
  return canRestore ? (
    <Button size="sm" className="h-7 px-2" variant="outline" onClick={onGeriAl}>
      Geri Al
    </Button>
  ) : null
}
