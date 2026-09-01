import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { getShopOrderOperations } from '@/lib/ifs/shop-order-operations'
import { type IfsShopOrderOperation } from '@/lib/ifs/types'
import { IsEmirleriClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'IPRO — İş Emirleri' }

// Üretim Terminali — iş emri listesi (E1). Guard: ipro.view | ipro.admin.
// Veri GERÇEK IFS'ten (ShopOrderOperations). İş merkezi ?wc query'den gelir
// (ana ekranda seçilir); ?wc yoksa seçim ekranına döner.
export default async function IsEmirleriPage({
  searchParams,
}: {
  searchParams: Promise<{ wc?: string }>
}) {
  const { session, error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canAdmin = await hasPermission('ipro.admin')
  if (!canView && !canAdmin) return <YetkisizErisim permission="ipro.view" />

  const { wc } = await searchParams
  const workCenter = typeof wc === 'string' && wc.trim() ? wc.trim() : null
  // İş merkezi seçilmeden liste gösterilmez — ana ekrandaki seçime dön.
  if (!workCenter) redirect('/terminal/uretim')

  let isEmirleri: IfsShopOrderOperation[] = []
  let ifsError: string | null = null
  try {
    isEmirleri = await getShopOrderOperations({ workCenter })
  } catch (e) {
    ifsError = e instanceof Error ? e.message : 'IFS verisi alınamadı'
  }

  // İş merkezi adı (WorkCenterDescription) — kayıtların ilk boş-olmayanından.
  const isMerkeziAdi = isEmirleri.find((e) => e.isMerkeziAdi)?.isMerkeziAdi ?? ''

  return (
    <IsEmirleriClient
      operatorName={session.user.name ?? 'Operatör'}
      isMerkezi={workCenter}
      isMerkeziAdi={isMerkeziAdi}
      isEmirleri={isEmirleri}
      error={ifsError}
    />
  )
}
