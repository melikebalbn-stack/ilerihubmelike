import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import type { SablonIcerik } from '@/lib/rapor/tipler'
import SablonTasarimClient from './_components/sablon-tasarim-client'

export const dynamic = 'force-dynamic'

// Şablon tasarımı (rapor.tasarla). id='yeni' → boş şablon.
export default async function SablonTasarimPage({ params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(PERMISSION_KEYS.RAPOR_TASARLA))) return <YetkisizErisim permission={PERMISSION_KEYS.RAPOR_TASARLA} />

  const veriSetleri = await prisma.raporVeriSeti.findMany({ where: { aktif: true }, select: { id: true, ad: true }, orderBy: { ad: 'asc' } })
  const { id } = await params
  if (id === 'yeni') return <SablonTasarimClient veriSetleri={veriSetleri} />

  const s = await prisma.raporSablon.findUnique({ where: { id }, select: { id: true, kod: true, ad: true, aciklama: true, veriSetiId: true, durum: true, surum: true, izinAnahtari: true, icerik: true } })
  if (!s) notFound()
  return (
    <SablonTasarimClient
      veriSetleri={veriSetleri}
      mevcut={{ id: s.id, kod: s.kod, ad: s.ad, aciklama: s.aciklama ?? '', veriSetiId: s.veriSetiId, durum: s.durum, surum: s.surum, izinAnahtari: s.izinAnahtari ?? '', icerik: s.icerik as unknown as SablonIcerik }}
    />
  )
}
