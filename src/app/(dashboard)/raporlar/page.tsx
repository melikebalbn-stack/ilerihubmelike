import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import RaporListeClient from './_components/rapor-liste-client'

export const dynamic = 'force-dynamic'

// Raporlar → liste. Görüntüleme rapor.view ile açılır; "Yeni rapor" rapor.tasarla ile görünür.
export default async function RaporlarPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (!canView) return <YetkisizErisim permission={PERMISSION_KEYS.RAPOR_VIEW} />

  return <RaporListeClient />
}
