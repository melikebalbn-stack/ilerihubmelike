import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { MOCK_CANLI_DURUM, MOCK_IS_EMIRLERI } from '@/lib/uretim/terminal-mock'
import { CanliTakipClient } from './_client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

// Üretim Terminali — canlı (PLC) takip (T2). Guard: ipro.view | ipro.admin.
// Veri mock: MOCK_CANLI_DURUM + id ile bulunan TerminalIsEmri.
export default async function CanliTakipPage({ params }: PageProps) {
  const { session, error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canAdmin = await hasPermission('ipro.admin')
  if (!canView && !canAdmin) return <YetkisizErisim permission="ipro.view" />

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
