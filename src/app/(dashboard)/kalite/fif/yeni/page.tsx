import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { FifFormClient } from '@/components/quality/fif/FifFormClient'

export const dynamic = 'force-dynamic'

/** Yeni FİF — oturumu olan herkes TASLAK açabilir. Oturumsuz → /login. */
export default async function FifYeniPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-[#1B4F72] mb-6">Yeni FİF</h1>
      <FifFormClient initial={null} />
    </div>
  )
}
