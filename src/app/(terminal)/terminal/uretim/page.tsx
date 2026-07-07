import { requirePermission } from '@/lib/auth/require-permission'
import { MOCK_IS_MERKEZI } from '@/lib/uretim/terminal-mock'
import { TerminalMenuClient } from './_client'

export const dynamic = 'force-dynamic'

// Üretim Terminali — ana menü (T1). Guard geçici: /uretim/bildirim ile aynı
// admin.system.manage kontrolü. IFS çağrısı YOK, iş merkezi mock.
export default async function UretimTerminalPage() {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  return (
    <TerminalMenuClient
      operatorName={session.user.name ?? 'Operatör'}
      isMerkezi={MOCK_IS_MERKEZI}
    />
  )
}
