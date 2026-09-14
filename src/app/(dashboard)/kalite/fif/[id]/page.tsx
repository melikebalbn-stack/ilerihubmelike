import { redirect, notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { fifKapsamindaMi, canManageFif } from '@/lib/quality/fif-access'
import { uygunGecisler, type FifGecisCtx } from '@/lib/quality/fif-durum'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { prisma } from '@/lib/prisma'
import { FifFormClient } from '@/components/quality/fif/FifFormClient'
import { FifDurumPanel } from '@/components/quality/fif/FifDurumPanel'

export const dynamic = 'force-dynamic'

/** FİF detay — durum paneli + geçmiş + düzenleme formu. Kapsam: fifKapsamindaMi. */
export default async function FifDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser()
  if (error) redirect('/login')

  const { id } = await params
  const fif = await prisma.fif.findUnique({
    where: { id },
    include: {
      faaliyetler: { orderBy: { sira: 'asc' } },
      etkinlikler: true,
      gecmis: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!fif) notFound()
  if (!(await fifKapsamindaMi(session, fif))) return <YetkisizErisim permission="fif.view" />

  // Durum geçişleri için ctx: manage + sorumlu bölüm müdürü User id.
  let sorumluBolumMudurUserId: string | null = null
  if (fif.sorumluBolumId) {
    const dept = await prisma.departmentDefinition.findUnique({ where: { id: fif.sorumluBolumId }, select: { mudurId: true } })
    if (dept?.mudurId) {
      const u = await prisma.user.findFirst({ where: { personnelId: dept.mudurId, isActive: true }, select: { id: true } })
      sorumluBolumMudurUserId = u?.id ?? null
    }
  }
  const ctx: FifGecisCtx = { userId: session.user.id, isManage: canManageFif(session), sorumluBolumMudurUserId }
  const gecisler = uygunGecisler(ctx, {
    durum: fif.durum, createdById: fif.createdById, hazirlayanUserId: fif.hazirlayanUserId,
    yayinlayanOnaylayanUserId: fif.yayinlayanOnaylayanUserId, sorumluOnaylayanUserId: fif.sorumluOnaylayanUserId,
    izlemeSorumlusuUserId: fif.izlemeSorumlusuUserId, takipSorumlusuUserId: fif.takipSorumlusuUserId,
    sorumluBolumId: fif.sorumluBolumId, uygunsuzlukTanimi: fif.uygunsuzlukTanimi, tur: fif.tur,
    faaliyetler: fif.faaliyetler, etkinlikler: fif.etkinlikler,
  })

  // Geçmiş userId → ad (düz string; toplu çöz).
  const userIds = [...new Set(fif.gecmis.map((g) => g.userId).filter((x): x is string => !!x))]
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, personnel: { select: { adSoyad: true } } } })
    : []
  const adById = new Map(users.map((u) => [u.id, u.name || u.personnel?.adSoyad || u.id]))
  const gecmis = fif.gecmis.map((g) => ({
    id: g.id, eskiDurum: g.eskiDurum, yeniDurum: g.yeniDurum,
    userAd: g.userId ? adById.get(g.userId) ?? null : null,
    aciklama: g.aciklama, createdAt: g.createdAt.toISOString(),
  }))

  const initial = {
    id: fif.id, kayitNo: fif.kayitNo, tur: fif.tur, tarih: fif.tarih.toISOString(), durum: fif.durum,
    sorumluBolumId: fif.sorumluBolumId, yayinlayanBolumId: fif.yayinlayanBolumId,
    sorumluOnaylayanUserId: fif.sorumluOnaylayanUserId,
    yayinlayanOnaylayanUserId: fif.yayinlayanOnaylayanUserId,
    izlemeSorumlusuUserId: fif.izlemeSorumlusuUserId,
    uygulamaSorumlusuUserId: fif.uygulamaSorumlusuUserId,
    takipSorumlusuUserId: fif.takipSorumlusuUserId,
    denetlemeAdi: fif.denetlemeAdi, uygunsuzlukTanimi: fif.uygunsuzlukTanimi,
    standartMadde: fif.standartMadde, ekTerminNedeni: fif.ekTerminNedeni, kokNedenAnalizi: fif.kokNedenAnalizi,
    faaliyetler: fif.faaliyetler.map((f) => ({ id: f.id, sira: f.sira, aciklama: f.aciklama, hedefTarih: f.hedefTarih ? f.hedefTarih.toISOString() : null })),
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-[#1B4F72]">FİF Detay</h1>
      <FifDurumPanel fifId={fif.id} durum={fif.durum} gecisler={gecisler} gecmis={gecmis} />
      <FifFormClient initial={initial} />
    </div>
  )
}
