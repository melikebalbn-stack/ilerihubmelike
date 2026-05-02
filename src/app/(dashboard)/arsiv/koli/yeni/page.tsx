/**
 * Yeni Koli Sayfası — Server Component (initial data fetch).
 *
 * - bolumler, lokasyonlar, kullanıcının context'i sunucudan çekilir
 * - Client form (`YeniKoliForm`) bu verilerle render edilir
 * - SUPER_ADMIN değilse bolum dropdown SGM'de (kendi bolum'unda) kilitli
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getArsivUserContext } from '@/lib/arsiv-auth'
import { prisma } from '@/lib/prisma'
import YeniKoliForm from './_components/yeni-koli-form'

export const dynamic = 'force-dynamic'

export default async function YeniKoliPage() {
  const ctx = await getArsivUserContext()
  if (!ctx) redirect('/login?callbackUrl=/arsiv/koli/yeni')

  if (!ctx.isSuperAdmin && ctx.arsivBolumId === null) {
    return (
      <div className="p-6 max-w-screen-lg mx-auto">
        <Link
          href="/arsiv/koli"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Liste
        </Link>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h2 className="font-medium">Bolum&apos;unuz arşiv sistemine tanımlı değil</h2>
          <p className="text-sm mt-1">
            Yeni koli oluşturmak için sistem yöneticisi ile iletişime geçin.
          </p>
        </div>
      </div>
    )
  }

  const [bolumler, lokasyonlar, currentUser] = await Promise.all([
    prisma.arsivBolum.findMany({
      where: { aktifMi: true },
      select: { id: true, ad: true, kod: true, renkHex: true },
      orderBy: [{ siraNo: 'asc' }, { ad: 'asc' }],
    }),
    prisma.arsivLokasyon.findMany({
      where: { aktifMi: true },
      select: {
        id: true,
        depoNo: true,
        rafKodu: true,
        siraNo: true,
        kapasite: true,
        mevcutDoluluk: true,
      },
      orderBy: [{ depoNo: 'asc' }, { rafKodu: 'asc' }, { siraNo: 'asc' }],
    }),
    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true, image: true },
    }),
  ])

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div>
        <Link
          href="/arsiv/koli"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Liste
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mt-2">
          Yeni Arşiv Kolisi
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Ana koli ve alt kolileri tek seferde oluşturun.
        </p>
      </div>

      <YeniKoliForm
        bolumler={bolumler}
        lokasyonlar={lokasyonlar}
        currentUser={currentUser}
        defaultBolumId={ctx.arsivBolumId}
        canChangeBolum={ctx.isSuperAdmin}
      />
    </div>
  )
}
