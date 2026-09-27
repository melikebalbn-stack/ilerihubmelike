import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { SayimClient } from './_client'

export const dynamic = 'force-dynamic'

// Sayım (IFS sayım raporu — kör sayım; onay ofiste). Guard: depo.terminal.use | admin.system.manage.
export default async function SayimPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <SayimClient />
}
