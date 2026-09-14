import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageFif, fifKapsamindaMi } from '@/lib/quality/fif-access'
import { altKayitDuzenlenebilir } from '@/lib/quality/fif-durum'
import { FifEtkinlikMadde } from '@/generated/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const girdi = z.object({
  madde: z.nativeEnum(FifEtkinlikMadde),
  planlananTarih: z.coerce.date().nullable().optional(),
  gerceklesenTarih: z.coerce.date().nullable().optional(),
  uygun: z.boolean().nullable().optional(),
})

/**
 * PUT /api/kalite/fif/[id]/etkinlik — madde bazlı upsert (KAPATMA/TEKRAR_ETMEME).
 * Yetki: takip sorumlusu VEYA manage. onay: kaydeden user + tarih OTOMATİK.
 * Kilit: altKayitDuzenlenebilir (KAPANDI/IPTAL yok, manage hariç). Durum ETKINLIK
 * değilse yalnız manage düzenleyebilir.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  const { id } = await params

  const fif = await prisma.fif.findUnique({
    where: { id },
    select: { id: true, durum: true, takipSorumlusuUserId: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true },
  })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, fif))) return NextResponse.json({ error: 'Bu FİF kapsamınızda değil' }, { status: 403 })

  const manage = canManageFif(session)
  if (!altKayitDuzenlenebilir({ userId, isManage: manage }, fif.durum)) {
    return NextResponse.json({ error: 'Bu durumda düzenleme yapılamaz' }, { status: 409 })
  }
  // Yetki: takip sorumlusu veya manage
  if (!manage && fif.takipSorumlusuUserId !== userId) {
    return NextResponse.json({ error: 'Etkinlik değerlendirme yetkiniz yok' }, { status: 403 })
  }
  // Durum kapısı: ETKINLIK dışında yalnız manage
  if (!manage && fif.durum !== 'ETKINLIK') {
    return NextResponse.json({ error: 'Etkinlik yalnız ETKINLIK aşamasında düzenlenir' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const parsed = girdi.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data

  const mevcut = await prisma.fifEtkinlik.findFirst({ where: { fifId: id, madde: d.madde }, select: { id: true } })
  const data = {
    planlananTarih: d.planlananTarih ?? null,
    gerceklesenTarih: d.gerceklesenTarih ?? null,
    uygun: d.uygun ?? null,
    onayUserId: userId,
    onayTarihi: new Date(),
  }
  const kayit = mevcut
    ? await prisma.fifEtkinlik.update({ where: { id: mevcut.id }, data })
    : await prisma.fifEtkinlik.create({ data: { fifId: id, madde: d.madde, ...data } })

  return NextResponse.json({ item: kayit })
}
