import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { SevkiyatClient } from './_client'

export const dynamic = 'force-dynamic'

// Sevkiyat toplama (IFS Shipment — okut, bitir). Guard: depo.terminal.use | admin.system.manage.
export default async function SevkiyatPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <SevkiyatClient />
}
