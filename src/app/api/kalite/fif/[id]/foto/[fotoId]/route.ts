import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageFif, fifKapsamindaMi } from '@/lib/quality/fif-access'
import { altKayitDuzenlenebilir } from '@/lib/quality/fif-durum'
import { fifFotoSil } from '@/lib/quality/fif-foto-dosya'

export const dynamic = 'force-dynamic'

/** DELETE — Ek-2 foto sil (DB + disk). Kilit: altKayitDuzenlenebilir. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; fotoId: string }> }) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  const { id, fotoId } = await params
  const fif = await prisma.fif.findUnique({ where: { id }, select: { id: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true } })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, fif))) return NextResponse.json({ error: 'kapsam dışı' }, { status: 403 })
  if (!altKayitDuzenlenebilir({ userId, isManage: canManageFif(session) }, fif.durum)) {
    return NextResponse.json({ error: 'Bu durumda düzenleme yapılamaz' }, { status: 409 })
  }
  const ek = await prisma.fifEk.findFirst({ where: { id: fotoId, fifId: id }, select: { id: true, dosyaYolu: true } })
  if (!ek) return NextResponse.json({ error: 'Fotoğraf bulunamadı' }, { status: 404 })
  await fifFotoSil(ek.dosyaYolu)
  await prisma.fifEk.delete({ where: { id: fotoId } })
  return NextResponse.json({ ok: true })
}
