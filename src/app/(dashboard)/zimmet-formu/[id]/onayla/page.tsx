import { redirect, notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { ZimmetOnayClient } from './ZimmetOnayClient'

export const dynamic = 'force-dynamic'

export default async function ZimmetOnayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canApprove = await hasPermission('zimmet-formu.approve')
  if (!canApprove) redirect('/dashboard')

  const { id } = await params

  const zimmet = await prisma.zimmetFormu.findFirst({
    where: { id, silindiMi: false },
    include: {
      zimmetSahibi: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      onaylayan: { select: { name: true, email: true } },
    },
  })

  if (!zimmet) notFound()

  // Date → string dönüşümü (Client Component serializasyonu için)
  const zimmetData = {
    ...zimmet,
    verilisTarihi: zimmet.verilisTarihi?.toISOString() ?? null,
    teslimEdenImzaTarihi: zimmet.teslimEdenImzaTarihi?.toISOString() ?? null,
    createdAt: zimmet.createdAt.toISOString(),
    updatedAt: zimmet.updatedAt.toISOString(),
  }

  return <ZimmetOnayClient zimmet={zimmetData} />
}
