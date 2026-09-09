import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { prisma } from '@/lib/prisma'
import { SytelineClient, type SyteKayitRow, type SyteDurumBilgi, type SyteEslemeRow } from './_client'

export const dynamic = 'force-dynamic'

const ENTITY = 'MALZEME'

// Syteline→IFS malzeme senkronu izleme paneli. Guard: entegrasyon.syteline (yilliktakvim deseni).
export default async function SytelinePage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission('entegrasyon.syteline'))) return <YetkisizErisim permission="entegrasyon.syteline" />

  const [gruplar, durum, kayitlar, eslemeRows] = await Promise.all([
    prisma.syteSyncKayit.groupBy({ by: ['durum'], where: { entity: ENTITY }, _count: { _all: true } }),
    prisma.syteSyncDurum.findUnique({ where: { entity: ENTITY } }),
    prisma.syteSyncKayit.findMany({
      where: { entity: ENTITY },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { id: true, kaynakAnahtar: true, durum: true, hata: true, denemeSayisi: true, updatedAt: true },
    }),
    prisma.syteEsleme.findMany({
      where: { entity: ENTITY },
      orderBy: [{ tip: 'asc' }, { kaynakDeger: 'asc' }],
      select: { id: true, entity: true, tip: true, kaynakDeger: true, hedefDeger: true, aktif: true, not: true },
    }),
  ])

  const sayac: Record<string, number> = {}
  for (const g of gruplar) sayac[g.durum] = g._count._all

  const durumBilgi: SyteDurumBilgi = {
    sonCalismaAt: durum?.sonCalismaAt?.toISOString() ?? null,
    sonRecordDate: durum?.sonRecordDate?.toISOString() ?? null,
    calisiyorAt: durum?.calisiyorAt?.toISOString() ?? null,
    sonOzet: (durum?.sonOzet as Record<string, number> | null) ?? null,
  }
  const rows: SyteKayitRow[] = kayitlar.map((k) => ({
    id: k.id,
    kaynakAnahtar: k.kaynakAnahtar,
    durum: k.durum,
    hata: k.hata,
    denemeSayisi: k.denemeSayisi,
    updatedAt: k.updatedAt.toISOString(),
  }))

  const eslemeler: SyteEslemeRow[] = eslemeRows.map((e) => ({
    id: e.id,
    entity: e.entity,
    tip: e.tip,
    kaynakDeger: e.kaynakDeger,
    hedefDeger: e.hedefDeger,
    aktif: e.aktif,
    not: e.not,
  }))

  return <SytelineClient sayac={sayac} durum={durumBilgi} kayitlar={rows} eslemeler={eslemeler} />
}
