import { redirect, notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { canManageRma } from '@/lib/quality/rma-access'
import { prisma } from '@/lib/prisma'
import { RmaFormClient, type RmaDetay } from '@/components/quality/rma/RmaFormClient'

export const dynamic = 'force-dynamic'

/** RMA/SMA detay/düzenleme. Oturum: herkes okur; yazma canManageRma (client read-only aksi halde). */
export default async function RmaDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser()
  if (error) redirect('/login')
  const { id } = await params

  const k = await prisma.rmaKayit.findUnique({
    where: { id },
    include: {
      musteri: { select: { id: true, code: true, name: true } },
      sorumlu: { select: { adSoyad: true, sicilNo: true } },
      satirlar: { orderBy: { siraNo: 'asc' } },
    },
  })
  if (!k) notFound()

  // Prisma Date/Decimal → client'a düz (serializable) obje.
  const iso = (d: Date | null) => (d ? d.toISOString() : null)
  const detay: RmaDetay = {
    id: k.id,
    no: k.no,
    tip: k.tip,
    urunGelisTarihi: iso(k.urunGelisTarihi),
    irsaliyeTarihi: iso(k.irsaliyeTarihi),
    irsaliyeNo: k.irsaliyeNo,
    musteri: k.musteri,
    iadeTuru: k.iadeTuru,
    sorumluId: k.sorumluId,
    sorumlu: k.sorumlu,
    termin: iso(k.termin),
    kapanisTarihi: iso(k.kapanisTarihi),
    maliyet: k.maliyet != null ? k.maliyet.toString() : null,
    satirlar: k.satirlar.map((s) => ({
      siraNo: s.siraNo,
      urunKodu: s.urunKodu,
      lotNo: s.lotNo,
      iadeMiktari: s.iadeMiktari,
      musteriIadeSebebi: s.musteriIadeSebebi,
      ilkIncelemeSonucu: s.ilkIncelemeSonucu,
      karar: s.karar,
      kararAciklama: s.kararAciklama,
      hurdaAdedi: s.hurdaAdedi,
      reworkAdedi: s.reworkAdedi,
      kokNeden: s.kokNeden,
      aksiyon: s.aksiyon,
    })),
  }

  return <RmaFormClient initial={detay} canManage={canManageRma(session)} />
}
