import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_VIEW_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { formatHistoryEntry } from '@/lib/yillik-calisma-takvimi/history'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const { error } = await requirePermission([...YILLIK_TAKVIM_VIEW_PERMISSIONS])
  if (error) return error
  const { id } = await params
  const kayit = await prisma.yillikTakvimKaydi.findUnique({ where: { id }, select: { id: true } })
  if (!kayit) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  try {
    const rows = await prisma.yillikTakvimIslemGecmisi.findMany({
      where: { kayitId: id },
      select: { islemTuru: true, alan: true, eskiDeger: true, yeniDeger: true, createdAt: true, yapan: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: rows.map(formatHistoryEntry) })
  } catch (cause) {
    console.error('[GET Yıllık Takvim geçmiş]', cause)
    return NextResponse.json({ error: 'İşlem geçmişi alınamadı' }, { status: 500 })
  }
}
