/**
 * Koli Listesi Sayfası — Server Component
 *
 * Filtreler URL search params'tan okunur:
 *   ?bolumId=X&durum=Aktif&lokasyonId=Y&yil=2026&page=1&limit=20
 *
 * Görsel:
 *   - Mobil (< md): Kart grid
 *   - Masaüstü (>= md): Tablo
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getArsivUserContext } from '@/lib/arsiv-auth'
import { prisma } from '@/lib/prisma'
import { toJSONSafe } from '@/lib/arsiv-serialize'
import { Prisma } from '@/generated/prisma'
import KoliFilters from './_components/koli-filters'
import KoliListView from './_components/koli-list-view'
import KoliPagination from './_components/koli-pagination'

type SearchParams = {
  bolumId?: string
  durum?: string
  lokasyonId?: string
  yil?: string
  page?: string
  limit?: string
  sort?: string
  dir?: string
}

const VALID_SORT_KEYS = [
  'arsivNo', 'bolum', 'donem', 'lokasyon',
  'sorumlu', 'altKoliCount', 'imhaTarihi', 'durum',
] as const

type SortKey = typeof VALID_SORT_KEYS[number]

function buildOrderBy(
  sortKey: SortKey | null,
  dir: 'asc' | 'desc'
): Prisma.ArsivKoliOrderByWithRelationInput | Prisma.ArsivKoliOrderByWithRelationInput[] {
  if (!sortKey) return { olusturmaTarihi: 'desc' }
  switch (sortKey) {
    case 'arsivNo':       return { arsivNo: dir }
    case 'bolum':         return { bolum: { kod: dir } }
    case 'donem':         return { tarihAraligiBaslangic: dir }
    case 'lokasyon':      return [{ lokasyon: { depoNo: dir } }, { lokasyon: { rafKodu: dir } }]
    case 'sorumlu':       return { sorumlu: { name: dir } }
    case 'altKoliCount':  return { altKoliler: { _count: dir } }
    case 'imhaTarihi':    return { imhaTarihi: dir }
    case 'durum':         return { durum: dir }
    default:              return { olusturmaTarihi: 'desc' }
  }
}

export default async function KoliListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const ctx = await getArsivUserContext()
  if (!ctx) redirect('/login?callbackUrl=/arsiv/koli')

  const sortKey = (VALID_SORT_KEYS as readonly string[]).includes(sp.sort ?? '')
    ? (sp.sort as SortKey)
    : null
  const sortDir: 'asc' | 'desc' = sp.dir === 'desc' ? 'desc' : 'asc'

  const pageRaw = Number(sp.page ?? '1')
  const limitRaw = Number(sp.limit ?? '20')
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const limit =
    Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(100, limitRaw) : 20
  const skip = (page - 1) * limit

  let bolumIdFilter: number | undefined
  if (!ctx.isSuperAdmin) {
    if (ctx.arsivBolumId === null) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-semibold mb-4">Arşiv</h1>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <p className="font-medium">Bolum&apos;unuz arşiv sistemine tanımlı değil.</p>
            <p className="text-sm mt-1">
              Lütfen sistem yöneticisi ile iletişime geçin.
            </p>
          </div>
        </div>
      )
    }
    bolumIdFilter = ctx.arsivBolumId
  } else if (sp.bolumId) {
    const parsed = Number(sp.bolumId)
    if (Number.isInteger(parsed) && parsed >= 1) {
      bolumIdFilter = parsed
    }
  }

  const DURUM_VALID = ['Aktif', 'ImhaYaklasti', 'ImhaEdildi', 'Arsivde']
  const durum = sp.durum && DURUM_VALID.includes(sp.durum) ? sp.durum : undefined

  let lokasyonIdFilter: number | null | undefined
  if (sp.lokasyonId === 'null') {
    lokasyonIdFilter = null
  } else if (sp.lokasyonId) {
    const parsed = Number(sp.lokasyonId)
    if (Number.isInteger(parsed) && parsed >= 1) lokasyonIdFilter = parsed
  }

  let yilRange: { gte: Date; lt: Date } | undefined
  if (sp.yil) {
    const yil = Number(sp.yil)
    if (Number.isInteger(yil) && yil >= 2000 && yil <= 2100) {
      yilRange = { gte: new Date(yil, 0, 1), lt: new Date(yil + 1, 0, 1) }
    }
  }

  const where = {
    ...(bolumIdFilter !== undefined ? { bolumId: bolumIdFilter } : {}),
    ...(durum
      ? { durum: durum as 'Aktif' | 'ImhaYaklasti' | 'ImhaEdildi' | 'Arsivde' }
      : {}),
    ...(lokasyonIdFilter !== undefined ? { lokasyonId: lokasyonIdFilter } : {}),
    ...(yilRange ? { arsivlemeTarihi: yilRange } : {}),
  }

  const [items, total, bolumler, lokasyonlar] = await prisma.$transaction([
    prisma.arsivKoli.findMany({
      where,
      include: {
        bolum: { select: { id: true, ad: true, kod: true, renkHex: true } },
        lokasyon: { select: { id: true, depoNo: true, rafKodu: true, siraNo: true } },
        sorumlu: { select: { id: true, name: true, email: true } },
        _count: { select: { altKoliler: true } },
      },
      orderBy: buildOrderBy(sortKey, sortDir),
      skip,
      take: limit,
    }),
    prisma.arsivKoli.count({ where }),
    prisma.arsivBolum.findMany({
      where: { aktifMi: true },
      select: { id: true, ad: true, kod: true, renkHex: true },
      orderBy: [{ siraNo: 'asc' }, { ad: 'asc' }],
    }),
    prisma.arsivLokasyon.findMany({
      where: { aktifMi: true },
      select: { id: true, depoNo: true, rafKodu: true, siraNo: true },
    }),
  ])

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Arşiv Kolileri</h1>
          <p className="text-sm text-slate-600 mt-1">
            {total} koli • {ctx.isSuperAdmin ? 'Tüm bölümler' : 'Bölümünüz'}
          </p>
        </div>
        <Link
          href="/arsiv/koli/yeni"
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition"
        >
          + Yeni Koli
        </Link>
      </div>

      <KoliFilters
        bolumler={toJSONSafe(bolumler)}
        lokasyonlar={toJSONSafe(lokasyonlar)}
        isSuperAdmin={ctx.isSuperAdmin}
        currentParams={sp}
      />

      <KoliListView items={toJSONSafe(items)} sortKey={sortKey} sortDir={sortDir} />

      <KoliPagination page={page} limit={limit} total={total} />
    </div>
  )
}
