import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { OffboardingFormClient } from '@/components/offboarding/OffboardingFormClient'

export const dynamic = 'force-dynamic'

export default async function NewOffboardingPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canCreate = await hasPermission('offboarding.create')
  if (!canCreate) redirect('/dashboard')

  return (
    <OffboardingFormClient mode="new" canEdit={canCreate} canApprove={false} canDelete={false} />
  )
}
