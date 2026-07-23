import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { ZimmetlerimListesi } from './ZimmetlerimListesi'

export const dynamic = 'force-dynamic'

export default async function ZimmetlerimPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  return <ZimmetlerimListesi />
}
