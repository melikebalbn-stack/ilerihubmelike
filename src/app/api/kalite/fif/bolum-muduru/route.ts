import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

export const dynamic = 'force-dynamic'

/**
 * GET /api/kalite/fif/bolum-muduru?bolumId= — bölümün müdürünün User hesabı.
 * FİF formunda bölüm seçilince "sorumlu onaylayan" otomatik dolar (kullanıcı
 * elle değiştirebilir). Omurga: DepartmentDefinition.mudur (Personnel) →
 * User (personnelId, isActive). Müdür yoksa müdür yardımcısına düşer.
 * deneme/personelinKullanicisi deseniyle aynı Personnel→User çözümü.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const bolumId = request.nextUrl.searchParams.get('bolumId')
  if (!bolumId) return NextResponse.json({ error: 'bolumId zorunlu' }, { status: 400 })

  const dept = await prisma.departmentDefinition.findUnique({
    where: { id: bolumId },
    select: { id: true, name: true, mudurId: true, mudurYardimcisiId: true },
  })
  if (!dept) return NextResponse.json({ error: 'Bölüm bulunamadı' }, { status: 404 })

  const personelUser = async (personnelId: string | null) => {
    if (!personnelId) return null
    const u = await prisma.user.findFirst({
      where: { personnelId, isActive: true },
      select: { id: true, name: true, email: true, personnel: { select: { adSoyad: true } } },
    })
    if (!u) return null
    return { userId: u.id, ad: u.name || u.personnel?.adSoyad || u.email || u.id }
  }

  const mudur = await personelUser(dept.mudurId)
  const mudurYrd = mudur ? null : await personelUser(dept.mudurYardimcisiId)
  const secim = mudur ?? mudurYrd

  return NextResponse.json({
    bolum: { id: dept.id, name: dept.name },
    // Otomatik dolacak onaylayan: müdür (yoksa müdür yardımcısı). null olabilir.
    onaylayan: secim,
    kaynak: mudur ? 'MUDUR' : mudurYrd ? 'MUDUR_YARDIMCISI' : null,
  })
}
