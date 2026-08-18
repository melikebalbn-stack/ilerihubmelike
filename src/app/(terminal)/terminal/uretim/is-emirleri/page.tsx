import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/require-permission'
import { type TerminalIsEmri } from '@/lib/uretim/terminal-mock'
import { getShopOrderOperations } from '@/lib/ifs/shop-order-operations'
import { IsEmirleriClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'IPRO — İş Emirleri' }

// Üretim Terminali — iş emri listesi (E1). Guard geçici (admin.system.manage).
// Veri GERÇEK IFS'ten (ShopOrderOperations). İş merkezi ?wc query'den gelir
// (ana ekranda seçilir); ?wc yoksa seçim ekranına döner.
export default async function IsEmirleriPage({
  searchParams,
}: {
  searchParams: Promise<{ wc?: string }>
}) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  const { wc } = await searchParams
  const workCenter = typeof wc === 'string' && wc.trim() ? wc.trim() : null
  // İş merkezi seçilmeden liste gösterilmez — ana ekrandaki seçime dön.
  if (!workCenter) redirect('/terminal/uretim')

  let isEmirleri: TerminalIsEmri[] = []
  let ifsError: string | null = null
  try {
    isEmirleri = await getShopOrderOperations({ workCenter })
  } catch (e) {
    ifsError = e instanceof Error ? e.message : 'IFS verisi alınamadı'
  }

  return (
    <IsEmirleriClient
      operatorName={session.user.name ?? 'Operatör'}
      isMerkezi={workCenter}
      isEmirleri={isEmirleri}
      error={ifsError}
    />
  )
}
