import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Bu zimmetin durum değişiklik geçmişi (audit log). PersonnelDepartmentTransfer
// + PersonnelTransferHistory.tsx deseni referans alındı - ZimmetDurumGecmisi'nde
// User'a relation olmadığı için (bkz. schema.prisma notu) islemYapanId'den
// kullanıcı adı ayrı bir sorguyla çekilip elde birleştiriliyor.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requirePermission('zimmet-formu.view')
    if (error) return error

    const { id } = await params

    const kayitlar = await prisma.zimmetDurumGecmisi.findMany({
      where: { zimmetId: id },
      orderBy: { createdAt: 'desc' },
    })

    const kullaniciIdler = [...new Set(kayitlar.map((k) => k.islemYapanId))]
    const kullanicilar = await prisma.user.findMany({
      where: { id: { in: kullaniciIdler } },
      select: { id: true, name: true, email: true },
    })
    const kullaniciMap = new Map(kullanicilar.map((u) => [u.id, u]))

    const sonuc = kayitlar.map((k) => ({
      id: k.id,
      eskiDurum: k.eskiDurum,
      yeniDurum: k.yeniDurum,
      not: k.not,
      createdAt: k.createdAt.toISOString(),
      islemYapan: kullaniciMap.get(k.islemYapanId)
        ? {
            name: kullaniciMap.get(k.islemYapanId)!.name ?? null,
            email: kullaniciMap.get(k.islemYapanId)!.email,
          }
        : null,
    }))

    return NextResponse.json(sonuc)
  } catch (err) {
    console.error('[GET /api/zimmet-formu/[id]/gecmis]', err)
    return NextResponse.json({ error: 'Geçmiş yüklenemedi' }, { status: 500 })
  }
}
