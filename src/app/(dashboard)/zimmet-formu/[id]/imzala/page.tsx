import { redirect, notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { ZimmetImzalaClient } from './ZimmetImzalaClient'

export const dynamic = 'force-dynamic'

export default async function ZimmetImzalaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user, error } = await requireUser()
  if (error) redirect('/login')

  const { id } = await params

  const zimmet = await prisma.zimmetFormu.findFirst({
    where: { id, silindiMi: false },
    include: {
      zimmetSahibi: { select: { name: true, email: true } },
    },
  })

  if (!zimmet) notFound()

  if (user.id !== zimmet.zimmetSahibiId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Bu zimmet tutanağının sahibi değilsiniz.</p>
      </div>
    )
  }

  const zimmetData = {
    id: zimmet.id,
    zimmetSahibi: zimmet.zimmetSahibi,
    tur: zimmet.tur as string,
    turDiger: zimmet.turDiger,
    seriNumarasi: zimmet.seriNumarasi,
    onayTarihi: zimmet.onayTarihi?.toISOString() ?? null,
    zimmetSahibiImzaTarihi: zimmet.zimmetSahibiImzaTarihi?.toISOString() ?? null,
    durum: zimmet.durum as string,
    teslimNotu: zimmet.teslimNotu ?? null,
    aciklama: zimmet.aciklama ?? null,
    departman: zimmet.departman ?? null,
    verilisTarihi: zimmet.verilisTarihi?.toISOString() ?? null,
  }

  return <ZimmetImzalaClient zimmet={zimmetData} />
}
