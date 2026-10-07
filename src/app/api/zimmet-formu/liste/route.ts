import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetKaynak, ZimmetOnayDurumu } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

const DURUM_VALUES = Object.values(ZimmetOnayDurumu) as string[]

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('zimmet-formu.view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const durumParam = searchParams.get('durum') ?? ''
  const araParam = searchParams.get('ara')?.trim() ?? ''

  const where: {
    durum?: ZimmetOnayDurumu
    OR?: Array<Record<string, unknown>>
    silindiMi?: boolean
  } = {
    silindiMi: false,
  }

  if (durumParam && DURUM_VALUES.includes(durumParam)) {
    where.durum = durumParam as ZimmetOnayDurumu
  }

  if (araParam) {
    where.OR = [
      { zimmetSahibi: { name: { contains: araParam, mode: 'insensitive' } } },
      { seriNumarasi: { contains: araParam, mode: 'insensitive' } },
    ]
  }

  const zimmetler = await prisma.zimmetFormu.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      zimmetSahibi: { select: { name: true, email: true, employeeId: true } },
      createdBy: { select: { name: true, email: true } },
    },
  })

  // Onay bekleyen kayıtlar için "Gönderildi" tarihi (gösterim): devir kaydında
  // sonBildirimTarihi, MANUEL kayıtta geçmişteki en son ONAYA_GONDERILDI. Tek groupBy
  // sorgusu — kayıt başına ayrı sorgu yok.
  const manuelBekleyenIds = zimmetler
    .filter((z) => z.durum === ZimmetOnayDurumu.ONAY_BEKLIYOR && z.kaynak !== ZimmetKaynak.SYTELINE_DEVIR)
    .map((z) => z.id)
  const gonderimler = manuelBekleyenIds.length
    ? await prisma.zimmetDurumGecmisi.groupBy({
        by: ['zimmetId'],
        where: { zimmetId: { in: manuelBekleyenIds }, yeniDurum: 'ONAYA_GONDERILDI' },
        _max: { createdAt: true },
      })
    : []
  const gonderimById = new Map(gonderimler.map((g) => [g.zimmetId, g._max.createdAt]))

  return NextResponse.json(
    zimmetler.map((z) => ({
      ...z,
      gonderimTarihi:
        z.durum !== ZimmetOnayDurumu.ONAY_BEKLIYOR
          ? null
          : z.kaynak === ZimmetKaynak.SYTELINE_DEVIR
            ? z.sonBildirimTarihi
            : (gonderimById.get(z.id) ?? null),
    })),
  )
}
