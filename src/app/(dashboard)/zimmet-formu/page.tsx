import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { ZimmetFormuClient } from './ZimmetFormuClient'

export const dynamic = 'force-dynamic'

export default async function ZimmetFormuPage() {
  const { user, error } = await requireUser()
  if (error) redirect('/login')

  const canCreate = await hasPermission('zimmet-formu.create')
  if (!canCreate) return <YetkisizErisim permission="zimmet-formu.create" />

  return <ZimmetFormuClient teslimEdenAdi={user.name ?? user.email} />
}
