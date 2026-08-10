import { redirect, notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import { prisma } from '@/lib/prisma'
import {
  UygunsuzlukFormClient,
  type UygunsuzlukDetay,
} from '@/components/quality/uygunsuzluk/UygunsuzlukFormClient'

export const dynamic = 'force-dynamic'

/**
 * Uygunsuzluk detay/düzenleme. Okuma: oturum. Yazma: canManageUygunsuzluk
 * (form salt-okunur açılır, kaydet butonu görünmez).
 */
export default async function UygunsuzlukDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { session, error } = await requireUser()
  if (error) redirect('/login')
  const { id } = await params

  const kayit = await prisma.kaliteUygunsuzluk.findUnique({
    where: { id },
    include: {
      sorumlu: { select: { adSoyad: true, sicilNo: true } },
      satirlar: { orderBy: { siraNo: 'asc' } },
    },
  })
  if (!kayit) notFound()

  const initial: UygunsuzlukDetay = {
    id: kayit.id,
    no: kayit.no,
    tarih: kayit.tarih.toISOString(),
    mamulUrunKodu: kayit.mamulUrunKodu,
    isEmriNo: kayit.isEmriNo,
    isEmriAdeti: kayit.isEmriAdeti,
    tespitEdenBolumId: kayit.tespitEdenBolumId,
    kokNeden: kayit.kokNeden,
    duzelticiFaaliyet: kayit.duzelticiFaaliyet,
    sorumluId: kayit.sorumluId,
    sorumlu: kayit.sorumlu,
    termin: kayit.termin ? kayit.termin.toISOString() : null,
    kapanisTarihi: kayit.kapanisTarihi ? kayit.kapanisTarihi.toISOString() : null,
    satirlar: kayit.satirlar.map((s) => ({
      siraNo: s.siraNo,
      yariMamulKodu: s.yariMamulKodu,
      malzemeAdi: s.malzemeAdi,
      redAdeti: s.redAdeti,
      reworkAdedi: s.reworkAdedi,
      olusanBolumId: s.olusanBolumId,
      hataKoduId: s.hataKoduId,
      hataDetayi: s.hataDetayi,
      karar: s.karar,
    })),
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <UygunsuzlukFormClient initial={initial} canManage={canManageUygunsuzluk(session)} />
    </div>
  )
}
