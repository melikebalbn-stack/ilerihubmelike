import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { MalzemeTalebiClient } from './_client'

export const dynamic = 'force-dynamic'

// Malzeme Talebi (sarf malzeme çıkışı). Guard: depo.terminal.use | admin.system.manage.
export default async function MalzemeTalebiPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <MalzemeTalebiClient />
}
