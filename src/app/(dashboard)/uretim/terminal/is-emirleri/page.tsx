import { requirePermission } from '@/lib/auth/require-permission'
import { MOCK_IS_EMIRLERI, MOCK_IS_MERKEZI } from '@/lib/uretim/terminal-mock'
import { IsEmirleriClient } from './_client'

export const dynamic = 'force-dynamic'

// Üretim Terminali — iş emri listesi (T1). Guard geçici (admin.system.manage).
// Veri mock; T2'de ShopFloorService'e bağlanacak.
export default async function IsEmirleriPage() {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  return (
    <IsEmirleriClient
      operatorName={session.user.name ?? 'Operatör'}
      isMerkezi={MOCK_IS_MERKEZI.kod}
      isEmirleri={MOCK_IS_EMIRLERI}
    />
  )
}
