import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'

// Dahili personel şoförü seçimi için dar kapsamlı arama — yalnız aktif
// personel, yalnız sicilNo/adSoyad/bolum döner (PII sızıntısını önlemek
// için /api/personnel yerine bu dar kapsamlı endpoint kullanılıyor).
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error

  try {
    const search = request.nextUrl.searchParams.get('search')?.trim()
    const data = await prisma.personnel.findMany({
      where: {
        aktif: true,
        ...(search
          ? {
              OR: [
                { adSoyad: { contains: search, mode: 'insensitive' as const } },
                { sicilNo: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
      orderBy: { adSoyad: 'asc' },
      take: 50,
    })
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error('Servis personel arama hatası:', err)
    return NextResponse.json({ ok: false, message: 'Personel listesi alınamadı.' }, { status: 500 })
  }
}
