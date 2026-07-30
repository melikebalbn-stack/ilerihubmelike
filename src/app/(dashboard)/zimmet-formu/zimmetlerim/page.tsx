import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { ZimmetlerimListesi } from './ZimmetlerimListesi'

export const dynamic = 'force-dynamic'

export default async function ZimmetlerimPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('zimmet-formu.view')
  if (!canView) return <YetkisizErisim permission="zimmet-formu.view" />

  return <ZimmetlerimListesi />
}
