import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import VeriSetiListeClient from './_components/veri-seti-liste-client'

export const dynamic = 'force-dynamic'

// Rapor tasarımcısı → veri setleri listesi (rapor.tasarla).
export default async function VeriSetleriPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(PERMISSION_KEYS.RAPOR_TASARLA))) return <YetkisizErisim permission={PERMISSION_KEYS.RAPOR_TASARLA} />
  return <VeriSetiListeClient />
}
