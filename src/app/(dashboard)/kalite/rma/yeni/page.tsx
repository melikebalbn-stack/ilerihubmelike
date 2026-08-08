import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { canManageRma } from '@/lib/quality/rma-access'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { RmaFormClient } from '@/components/quality/rma/RmaFormClient'

export const dynamic = 'force-dynamic'

/** Yeni RMA/SMA kaydı — yalnız canManageRma. Oturumsuz → /login. */
export default async function RmaYeniPage() {
  const { session, error } = await requireUser()
  if (error) redirect('/login')
  if (!canManageRma(session)) return <YetkisizErisim permission="rma.manage" />

  return <RmaFormClient initial={null} canManage />
}
