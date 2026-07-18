import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  // DepartmentDefinition dev'de boş; personel modülünün gerçek kaynağı olan
  // Personnel.bolum'dan distinct çekiliyor (yenileme raporuyla aynı kaynak — tutarlılık).
  const personeller = await prisma.personnel.findMany({
    where: { aktif: true, bolum: { not: '' } },
    select: { bolum: true },
    distinct: ['bolum'],
  })

  const bolumler = Array.from(new Set(personeller.map((p) => p.bolum))).sort((a, b) =>
    a.localeCompare(b, 'tr'),
  )

  return NextResponse.json({ ok: true, data: bolumler })
}
