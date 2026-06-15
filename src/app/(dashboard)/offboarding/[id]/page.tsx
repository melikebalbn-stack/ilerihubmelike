import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { OffboardingFormClient } from '@/components/offboarding/OffboardingFormClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OffboardingDetailPage({ params }: PageProps) {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('offboarding.view')
  if (!canView) redirect('/dashboard')

  const [canEdit, canApprove, canDelete] = await Promise.all([
    hasPermission('offboarding.edit'),
    hasPermission('offboarding.approve'),
    hasPermission('offboarding.delete'),
  ])

  const { id } = await params

  return (
    <OffboardingFormClient
      mode="edit"
      id={id}
      canEdit={canEdit}
      canApprove={canApprove}
      canDelete={canDelete}
    />
  )
}
