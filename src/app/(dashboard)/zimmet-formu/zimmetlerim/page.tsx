import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { ZimmetlerimListesi } from './ZimmetlerimListesi'

export const dynamic = 'force-dynamic'

export default async function ZimmetlerimPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('zimmet-formu.view')
  if (!canView) redirect('/dashboard')

  return <ZimmetlerimListesi />
}
