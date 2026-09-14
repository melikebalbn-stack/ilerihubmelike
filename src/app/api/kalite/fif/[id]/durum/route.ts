import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageFif } from '@/lib/quality/fif-access'
import { gecisYapabilirMi, type FifGecisCtx, type FifGecisState } from '@/lib/quality/fif-durum'
import { fifDurumBildir } from '@/lib/quality/fif-bildirim'
import { FifDurum, FifSonuc } from '@/generated/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const girdi = z.object({
  hedef: z.nativeEnum(FifDurum),
  aciklama: z.string().trim().optional(),
})

/** Red geçişleri: redNedeni (aciklama) zorunlu. */
const RED_GECISLERI: Array<[FifDurum, FifDurum]> = [
  [FifDurum.ONAY_BEKLIYOR, FifDurum.TASLAK],
  [FifDurum.KAPATMA_BEKLIYOR, FifDurum.FAALIYET],
]

/**
 * POST /api/kalite/fif/[id]/durum — TEK durum geçiş ucu. fif-durum.ts'ten geçer.
 * Transaction: durum + FifGecmis; bildirim commit sonrası (mail I/O tx dışında).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  const { id } = await params

  const body = await request.json().catch(() => null)
  const parsed = girdi.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  const { hedef, aciklama } = parsed.data

  const fif = await prisma.fif.findUnique({
    where: { id },
    include: { faaliyetler: { select: { id: true, hedefTarih: true } }, etkinlikler: { select: { madde: true, uygun: true } } },
  })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })

  // Sorumlu bölüm müdürünün User id'si (ctx için).
  let sorumluBolumMudurUserId: string | null = null
  if (fif.sorumluBolumId) {
    const dept = await prisma.departmentDefinition.findUnique({ where: { id: fif.sorumluBolumId }, select: { mudurId: true } })
    if (dept?.mudurId) {
      const u = await prisma.user.findFirst({ where: { personnelId: dept.mudurId, isActive: true }, select: { id: true } })
      sorumluBolumMudurUserId = u?.id ?? null
    }
  }

  const ctx: FifGecisCtx = { userId, isManage: canManageFif(session), sorumluBolumMudurUserId }
  const state: FifGecisState = {
    durum: fif.durum, createdById: fif.createdById, hazirlayanUserId: fif.hazirlayanUserId,
    yayinlayanOnaylayanUserId: fif.yayinlayanOnaylayanUserId, sorumluOnaylayanUserId: fif.sorumluOnaylayanUserId,
    izlemeSorumlusuUserId: fif.izlemeSorumlusuUserId, takipSorumlusuUserId: fif.takipSorumlusuUserId,
    sorumluBolumId: fif.sorumluBolumId, uygunsuzlukTanimi: fif.uygunsuzlukTanimi, tur: fif.tur,
    faaliyetler: fif.faaliyetler, etkinlikler: fif.etkinlikler,
  }

  const karar = gecisYapabilirMi(ctx, state, hedef)
  if (!karar.ok) return NextResponse.json({ error: karar.sebep }, { status: 403 })

  const isRed = RED_GECISLERI.some(([f, t]) => f === fif.durum && t === hedef)
  const isReopen = fif.durum === FifDurum.ETKINLIK && hedef === FifDurum.FAALIYET
  const isIptal = hedef === FifDurum.IPTAL
  if (isRed && (!aciklama || !aciklama.trim())) {
    return NextResponse.json({ error: 'Red gerekçesi (açıklama) zorunlu' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.fif.update({
      where: { id },
      data: {
        durum: hedef,
        ...(hedef === FifDurum.KAPATMA_BEKLIYOR ? { kapatmaTarihi: new Date() } : {}),
        ...(isRed ? { redNedeni: aciklama } : {}),
      },
    })
    // Yeniden açılış: faaliyet satırları sonuc=YT (yapılamadı/termin) işaretlenir.
    if (isReopen) {
      await tx.fifFaaliyet.updateMany({ where: { fifId: id }, data: { sonuc: FifSonuc.YT } })
    }
    await tx.fifGecmis.create({
      data: { fifId: id, eskiDurum: fif.durum, yeniDurum: hedef, userId, aciklama: aciklama ?? null },
    })
  })

  // Bildirim — commit sonrası, best-effort (mail I/O tx dışında).
  let bildirim = null
  try {
    bildirim = await fifDurumBildir(fif, hedef, { red: isRed, iptal: isIptal })
  } catch (e) {
    console.error('[fif-durum] bildirim:', e)
  }

  return NextResponse.json({ ok: true, durum: hedef, bildirim })
}
