import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'
import { getManagedPersonnelIds } from '../_lib/approvers'

export const dynamic = 'force-dynamic'

/**
 * GET: Kart Okutamama formu için Personnel (İV) tablosundan aktif personel
 * arama — sicilNo/adSoyad/bolum dışında alan döndürülmez (PII sızıntısını
 * önlemek için /api/personnel yerine bu dar kapsamlı endpoint kullanılıyor).
 *
 * GRI/SELF (Gri Yaka ve diğer Beyaz Yaka) başkasını arayamaz — varsayılan
 * olarak sadece kendi kaydı döner. scope=team ile SADECE 1./2./3. Sorumlusu
 * olduğu ekip döner (kendisi hariç — "Kendi Kaydım" ayrı bir görünüm).
 * FULL erişimde (İV/Admin) kısıtlama yok.
 * Query params: search, bolum (sadece FULL erişimde etkili), scope (GRI/SELF: 'team')
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    if (access.level === 'NONE') {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const bolum = searchParams.get('bolum')
    const scope = searchParams.get('scope') // 'team' → GRI/SELF için ekip (kendisi hariç)

    const where: Record<string, unknown> = { aktif: true }

    if (access.level === 'GRI' || access.level === 'SELF') {
      if (scope === 'team' && access.personnelId) {
        const managedIds = await getManagedPersonnelIds(access.personnelId)
        where.id = { in: managedIds.length > 0 ? managedIds : ['__none__'] }
      } else {
        where.id = access.personnelId ?? '__none__'
      }
      const personnel = await prisma.personnel.findMany({
        where,
        select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
        take: scope === 'team' ? 100 : 1,
      })
      return NextResponse.json(personnel)
    }

    if (search) {
      where.OR = [
        { adSoyad: { contains: search, mode: 'insensitive' } },
        { sicilNo: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (bolum) {
      where.bolum = bolum
    }

    const personnel = await prisma.personnel.findMany({
      where,
      select: {
        id: true,
        sicilNo: true,
        adSoyad: true,
        bolum: true,
      },
      orderBy: { adSoyad: 'asc' },
      take: 50,
    })

    return NextResponse.json(personnel)
  } catch (error) {
    console.error('Personel arama hatası (toplu-kart-okutamama):', error)
    return NextResponse.json(
      { error: 'Personel listesi alınamadı' },
      { status: 500 }
    )
  }
}
