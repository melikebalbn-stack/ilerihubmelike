import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { TopluTasimaClient } from './_client'

export const dynamic = 'force-dynamic'

// Toplu Taşıma (IFS TRDST stok transfer fişi). Guard: depo.terminal.use | admin.system.manage.
export default async function TopluTasimaPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <TopluTasimaClient />
}
