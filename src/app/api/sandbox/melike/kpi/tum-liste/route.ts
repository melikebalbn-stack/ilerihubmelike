import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// KPI-FORMUL: formül referansı için "başka hangi KPI'lar var" arama/seçim listesi — TÜM
// departmanlardan, sadece id/ad/departman adı ve özel alanları (kaynak seçimi için).
export async function GET() {
  const kpiler = await prisma.kPIDefinition.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      gerceklesenEtiketi: true,
      hedefEtiketi: true,
      orgUnit: { select: { name: true } },
      ozelAlanlar: { select: { key: true, label: true }, orderBy: { siraNo: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  const sonuc = kpiler.map(k => ({
    id: k.id,
    name: k.name,
    departman: k.orgUnit.name,
    kaynaklar: [
      { kaynak: 'actual', label: k.gerceklesenEtiketi },
      { kaynak: 'target', label: k.hedefEtiketi },
      ...k.ozelAlanlar.map(a => ({ kaynak: a.key, label: a.label })),
    ],
  }))

  return NextResponse.json({ kpiler: sonuc })
}
