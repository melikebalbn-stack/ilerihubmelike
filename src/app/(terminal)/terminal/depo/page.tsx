import { requirePermission } from '@/lib/auth/require-permission'
import { DepoMenuClient } from './_client'

export const dynamic = 'force-dynamic'

// Depo terminal menüsü (EL-1 iskelet). Guard: admin.system.manage.
export default async function DepoPage() {
  const { session, error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  return <DepoMenuClient operatorName={session.user.name ?? 'Operatör'} />
}
