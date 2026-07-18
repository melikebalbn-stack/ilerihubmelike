import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { MalzemeToplamaClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Malzeme Toplama' }

// Malzeme Toplama. Guard: depo.terminal.use | admin.system.manage.
export default async function MalzemeToplamaPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <MalzemeToplamaClient />
}
