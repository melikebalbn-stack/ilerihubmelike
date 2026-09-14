import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { iproNormalize } from '@/lib/ipro/metin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/kalite/fif/kullanici-ara?q= — FİF onaylayan/sorumlu seçicileri için
 * aktif User araması (Personnel'e bağlı). Döner: {userId, ad, bolum}. iproNormalize
 * (Türkçe ı/İ katlaması) ile JS'te filtrelenir (personel-ara deseni; kayıt az).
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ kullanicilar: [] })

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, department: true, personnel: { select: { adSoyad: true, bolum: true } } },
    orderBy: { name: 'asc' },
  })
  const hedef = iproNormalize(q)
  const kullanicilar = users
    .map((u) => ({ userId: u.id, ad: u.name || u.personnel?.adSoyad || u.email || u.id, bolum: u.personnel?.bolum || u.department || '' }))
    .filter((u) => iproNormalize(u.ad).includes(hedef) || iproNormalize(u.bolum).includes(hedef))
    .slice(0, 20)
  return NextResponse.json({ kullanicilar })
}
