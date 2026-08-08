import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_VIEW_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'

export const dynamic = 'force-dynamic'

function getIstanbulTodayUtcMidnight(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  return Date.UTC(
    Number(parts.find(part => part.type === 'year')?.value),
    Number(parts.find(part => part.type === 'month')?.value) - 1,
    Number(parts.find(part => part.type === 'day')?.value),
  )
}

function diffInDays(target: Date, todayUtcMidnight: number): number {
  const targetUtcMidnight = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  return Math.round((targetUtcMidnight - todayUtcMidnight) / 86_400_000)
}

export async function GET(request: NextRequest) {
  const { error } = await requirePermission([...YILLIK_TAKVIM_VIEW_PERMISSIONS])
  if (error) return error

  const rawYil = request.nextUrl.searchParams.get('yil')
  const yil = rawYil === null ? new Date().getFullYear() : Number(rawYil)
  if (!Number.isInteger(yil) || yil < 2000 || yil > 2100) {
    return NextResponse.json({ error: 'Yıl 2000 ile 2100 arasında olmalıdır' }, { status: 400 })
  }

  try {
    const kayitlar = await prisma.yillikTakvimKaydi.findMany({
      where: { yil, arsivMi: false },
      select: {
        id: true, anaKonu: true, surec: true, kisaBaslik: true, oncelik: true,
        periyot: true, durum: true, baslangicTarihi: true, bitisTarihi: true,
        nihaiSonTarih: true, plananUygulamaTarihi: true, iptalMi: true,
        kaynakModul: true, gerceklesmeDurumu: true, gerceklesmeTarihi: true,
        department: { select: { id: true, name: true } },
        katilimcilar: {
          where: { rol: 'ANA_SORUMLU' },
          select: { rol: true, user: { select: { name: true } } },
        },
      },
      orderBy: [{ anaKonu: 'asc' }, { nihaiSonTarih: 'asc' }],
    })
    const bugun = getIstanbulTodayUtcMidnight()
    const data = kayitlar.map(kayit => ({
      ...kayit,
      kalanGun: kayit.nihaiSonTarih ? diffInDays(kayit.nihaiSonTarih, bugun) : null,
    }))
    return NextResponse.json({ data, yil })
  } catch (error) {
    console.error('[GET /api/strategic-hr/yillik-calisma-takvimi]', error)
    return NextResponse.json({ error: 'Yıllık takvim kayıtları alınamadı' }, { status: 500 })
  }
}
