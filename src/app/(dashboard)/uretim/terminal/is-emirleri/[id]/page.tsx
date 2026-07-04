import { requirePermission } from '@/lib/auth/require-permission'
import { MOCK_IS_EMIRLERI } from '@/lib/uretim/terminal-mock'
import { IsEmriDetayClient } from './_client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

// Üretim Terminali — iş emri detay/başlat (T2). Guard geçici (admin.system.manage).
// Veri mock; kayıt id ile MOCK_IS_EMIRLERI'nden bulunur.
export default async function IsEmriDetayPage({ params }: PageProps) {
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
    <IsEmriDetayClient
      operatorName={session.user.name ?? 'Operatör'}
      isEmri={isEmri}
    />
  )
}
