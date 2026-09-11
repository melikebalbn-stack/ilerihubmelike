import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { prisma } from '@/lib/prisma'
import { SytelineClient, type SyteDurumBilgi, type SyteEslemeRow } from './_client'

export const dynamic = 'force-dynamic'

const ENTITIES = ['MALZEME', 'IS_EMRI'] as const
type Entity = (typeof ENTITIES)[number]

// Syteline→IFS senkron izleme paneli (malzeme + iş emri). Guard: entegrasyon.syteline.
// Kuyruk listesi istemciden /kuyruk ile çekilir; burada yalnız sayaç + son çalışma + eşlemeler.
export default async function SytelinePage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission('entegrasyon.syteline'))) return <YetkisizErisim permission="entegrasyon.syteline" />

  const [gruplar, durumlar, eslemeRows] = await Promise.all([
    prisma.syteSyncKayit.groupBy({ by: ['entity', 'durum'], where: { entity: { in: [...ENTITIES] } }, _count: { _all: true } }),
    prisma.syteSyncDurum.findMany({ where: { entity: { in: [...ENTITIES] } } }),
    prisma.syteEsleme.findMany({
      where: { entity: { in: [...ENTITIES] } },
      orderBy: [{ tip: 'asc' }, { kaynakDeger: 'asc' }],
      select: { id: true, entity: true, tip: true, kaynakDeger: true, hedefDeger: true, aktif: true, not: true },
    }),
  ])

  const bosSayac = () => ({}) as Record<string, number>
  const sayac: Record<Entity, Record<string, number>> = { MALZEME: bosSayac(), IS_EMRI: bosSayac() }
  for (const g of gruplar) {
    if (g.entity === 'MALZEME' || g.entity === 'IS_EMRI') sayac[g.entity][g.durum] = g._count._all
  }

  const bosDurum: SyteDurumBilgi = { sonCalismaAt: null, sonRecordDate: null, calisiyorAt: null, sonOzet: null }
  const durum: Record<Entity, SyteDurumBilgi> = { MALZEME: { ...bosDurum }, IS_EMRI: { ...bosDurum } }
  for (const d of durumlar) {
    if (d.entity === 'MALZEME' || d.entity === 'IS_EMRI') {
      durum[d.entity] = {
        sonCalismaAt: d.sonCalismaAt?.toISOString() ?? null,
        sonRecordDate: d.sonRecordDate?.toISOString() ?? null,
        calisiyorAt: d.calisiyorAt?.toISOString() ?? null,
        sonOzet: (d.sonOzet as Record<string, number> | null) ?? null,
      }
    }
  }

  const eslemeler: Record<Entity, SyteEslemeRow[]> = { MALZEME: [], IS_EMRI: [] }
  for (const e of eslemeRows) {
    if (e.entity === 'MALZEME' || e.entity === 'IS_EMRI') eslemeler[e.entity].push(e)
  }

  return <SytelineClient sayac={sayac} durum={durum} eslemeler={eslemeler} />
}
