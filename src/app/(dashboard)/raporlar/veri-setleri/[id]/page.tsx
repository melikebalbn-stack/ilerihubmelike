import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import type { VeriSetiTanim } from '@/lib/rapor/tipler'
import VeriSetiTasarimClient from './_components/veri-seti-tasarim-client'

export const dynamic = 'force-dynamic'

// Veri seti tasarımı (rapor.tasarla). id='yeni' → boş kayıt. Katalog yükleme düğmesi rapor.katalog ile.
export default async function VeriSetiTasarimPage({ params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(PERMISSION_KEYS.RAPOR_TASARLA))) return <YetkisizErisim permission={PERMISSION_KEYS.RAPOR_TASARLA} />
  const katalogYukleyebilir = await hasPermission(PERMISSION_KEYS.RAPOR_KATALOG)

  const { id } = await params
  if (id === 'yeni') return <VeriSetiTasarimClient katalogYukleyebilir={katalogYukleyebilir} />

  const v = await prisma.raporVeriSeti.findUnique({ where: { id }, select: { id: true, ad: true, aciklama: true, tanim: true, _count: { select: { sablonlar: true } } } })
  if (!v) notFound()
  return (
    <VeriSetiTasarimClient
      katalogYukleyebilir={katalogYukleyebilir}
      mevcut={{ id: v.id, ad: v.ad, aciklama: v.aciklama ?? '', tanim: v.tanim as unknown as VeriSetiTanim, sablonSayisi: v._count.sablonlar }}
    />
  )
}
