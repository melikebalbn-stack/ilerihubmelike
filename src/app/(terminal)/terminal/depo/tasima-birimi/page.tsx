import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { TasimaBirimiClient } from './_client'

export const dynamic = 'force-dynamic'

// Taşıma birimi (palet) işlemleri. Guard: depo.terminal.use | admin.system.manage.
export default async function TasimaBirimiPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <TasimaBirimiClient />
}
