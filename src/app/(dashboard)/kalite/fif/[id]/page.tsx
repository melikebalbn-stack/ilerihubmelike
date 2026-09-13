import { redirect, notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { canManageFif } from '@/lib/quality/fif-access'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { prisma } from '@/lib/prisma'
import { FifFormClient } from '@/components/quality/fif/FifFormClient'

export const dynamic = 'force-dynamic'

/** FİF detay/düzenleme. Okuma herkes; düzenleme canManageFif (form içi read-only değil,
 *  yetkisiz kullanıcı Faz 1'de düzenleme uçlarında 403 alır — form gösterimi bilgi amaçlı). */
export default async function FifDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser()
  if (error) redirect('/login')
  if (!canManageFif(session)) return <YetkisizErisim permission="fif.manage" />

  const { id } = await params
  const fif = await prisma.fif.findUnique({
    where: { id },
    include: { faaliyetler: { orderBy: { sira: 'asc' } } },
  })
  if (!fif) notFound()

  const initial = {
    id: fif.id,
    kayitNo: fif.kayitNo,
    tur: fif.tur,
    tarih: fif.tarih.toISOString(),
    durum: fif.durum,
    sorumluBolumId: fif.sorumluBolumId,
    yayinlayanBolumId: fif.yayinlayanBolumId,
    sorumluOnaylayanUserId: fif.sorumluOnaylayanUserId,
    denetlemeAdi: fif.denetlemeAdi,
    uygunsuzlukTanimi: fif.uygunsuzlukTanimi,
    standartMadde: fif.standartMadde,
    ekTerminNedeni: fif.ekTerminNedeni,
    kokNedenAnalizi: fif.kokNedenAnalizi,
    faaliyetler: fif.faaliyetler.map((f) => ({
      id: f.id, sira: f.sira, aciklama: f.aciklama,
      hedefTarih: f.hedefTarih ? f.hedefTarih.toISOString() : null,
    })),
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-[#1B4F72] mb-6">FİF Detay</h1>
      <FifFormClient initial={initial} />
    </div>
  )
}
