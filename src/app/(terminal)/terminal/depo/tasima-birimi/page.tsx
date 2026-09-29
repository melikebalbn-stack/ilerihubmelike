import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { TasimaBirimiClient } from './_client'

export const dynamic = 'force-dynamic'

// Taşıma birimi (palet) işlemleri. Guard: depo.terminal.use | admin.system.manage.
// ?palet=N → doğrudan "Taşı" modunda o palet yüklü açılır (Stok Bilgisi kartından "Palet Taşı'ya git").
export default async function TasimaBirimiPage({ searchParams }: { searchParams: Promise<{ palet?: string }> }) {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  const ham = (await searchParams).palet ?? ''
  const palet = /^\d+$/.test(ham) ? Number(ham) : null
  return <TasimaBirimiClient baslangicPalet={palet && Number.isSafeInteger(palet) ? palet : null} />
}
