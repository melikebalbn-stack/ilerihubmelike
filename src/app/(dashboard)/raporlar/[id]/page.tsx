import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import type { SablonIcerik } from '@/lib/rapor/tipler'
import RaporCalistirClient from './_components/rapor-calistir-client'

export const dynamic = 'force-dynamic'

// Raporlar → çalıştırma. rapor.view + (şablonun izinAnahtari varsa o izin). Sunucu yalnız
// başlık/parametre tanımını verir; çalıştırma API'de (aynı yetki kuralları orada da uygulanır).
export default async function RaporCalistirPage({ params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (!canView) return <YetkisizErisim permission={PERMISSION_KEYS.RAPOR_VIEW} />

  const { id } = await params
  const sablon = await prisma.raporSablon.findUnique({
    where: { id },
    select: { id: true, kod: true, ad: true, aciklama: true, durum: true, izinAnahtari: true, icerik: true },
  })
  if (!sablon || sablon.durum === 'ARSIV') notFound()
  if (sablon.durum === 'TASLAK' && !(await hasPermission(PERMISSION_KEYS.RAPOR_TASARLA))) {
    return <YetkisizErisim permission={PERMISSION_KEYS.RAPOR_TASARLA} />
  }
  if (sablon.izinAnahtari && !(await hasPermission(sablon.izinAnahtari))) {
    return <YetkisizErisim permission={sablon.izinAnahtari} />
  }

  const icerik = sablon.icerik as unknown as SablonIcerik
  return (
    <RaporCalistirClient
      sablon={{ id: sablon.id, kod: sablon.kod, ad: sablon.ad, aciklama: sablon.aciklama, durum: sablon.durum }}
      parametreler={icerik.parametreler ?? []}
    />
  )
}
