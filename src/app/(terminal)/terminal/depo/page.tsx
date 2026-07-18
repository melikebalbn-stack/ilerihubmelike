import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../_shared'
import { DepoMenuClient } from './_client'

export const dynamic = 'force-dynamic'

// Depo terminal menüsü (EL-1 iskelet). Guard: depo.terminal.use | admin.system.manage.
export default async function DepoPage() {
  const { session, error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <DepoMenuClient operatorName={session.user.name ?? 'Operatör'} />
}
