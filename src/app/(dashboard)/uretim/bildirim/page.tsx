import { Suspense } from 'react'
import { OperationReportClient } from './_client'

export const dynamic = 'force-dynamic'

// Operatör üretim bildirimi (PR-A: ekran + okuma; "Bildir" PR-B'de IFS'e yazacak).
export default function UretimBildirimPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Yükleniyor…</div>
      }
    >
      <OperationReportClient />
    </Suspense>
  )
}
