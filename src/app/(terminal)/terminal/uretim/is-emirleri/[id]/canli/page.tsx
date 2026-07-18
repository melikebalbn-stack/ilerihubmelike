import { requirePermission } from '@/lib/auth/require-permission'
import { MOCK_CANLI_DURUM, MOCK_IS_EMIRLERI } from '@/lib/uretim/terminal-mock'
import { CanliTakipClient } from './_client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

// Üretim Terminali — canlı (PLC) takip (T2). Guard geçici (admin.system.manage).
// Veri mock: MOCK_CANLI_DURUM + id ile bulunan TerminalIsEmri.
export default async function CanliTakipPage({ params }: PageProps) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  const { id } = await params
  const isEmri = MOCK_IS_EMIRLERI.find((e) => e.id === id) ?? null

  return (
    <CanliTakipClient
      operatorName={session.user.name ?? 'Operatör'}
      isEmri={isEmri}
      canli={MOCK_CANLI_DURUM}
    />
  )
}
