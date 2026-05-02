/**
 * Etiket basma sayfası — A4'e 4 etiket/sayfa (Avery 105×148.5mm).
 *
 * 1 ana koli etiketi + N alt koli etiketi. Her birinde QR + meta.
 * Print CSS ile yazdırma için optimize edilmiş.
 */

import { notFound, redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import {
  getArsivUserContext,
  canAccessBolum,
} from '@/lib/arsiv-auth'
import { toJSONSafe } from '@/lib/arsiv-serialize'
import { EtiketView } from './_components/etiket-view'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hub.ilerigroup.com'

export const dynamic = 'force-dynamic'

const ARSIV_NO_REGEX = /^ARK-[A-Z]{3}-[0-9]{4}-[0-9]{3}$/

export default async function EtiketPage({
  params,
}: {
  params: Promise<{ arsivNo: string }>
}) {
  const { arsivNo } = await params
  if (!ARSIV_NO_REGEX.test(arsivNo)) notFound()

  const ctx = await getArsivUserContext()
  if (!ctx) redirect(`/login?callbackUrl=/arsiv/koli/${arsivNo}/etiket`)

  const koli = await prisma.arsivKoli.findUnique({
    where: { arsivNo },
    include: {
      bolum: { select: { id: true, kod: true, ad: true, renkHex: true } },
      lokasyon: {
        select: { id: true, depoNo: true, rafKodu: true, siraNo: true },
      },
      sorumlu: { select: { name: true } },
      altKoliler: {
        select: {
          id: true,
          altArsivNo: true,
          harf: true,
          aciklama: true,
          imhaTarihi: true,
          donemBaslangic: true,
          donemSonu: true,
          saklamaSuresiYil: true,
          evrakSayisi: true,
          hazirlayan: true,
          gizlilikSeviyesi: true,
          evrakTuru: { select: { ad: true } },
        },
        orderBy: { harf: 'asc' },
      },
    },
  })

  if (!koli) notFound()

  if (!canAccessBolum(ctx, koli.bolumId)) {
    return (
      <div className="p-6 max-w-screen-lg mx-auto">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <h2 className="font-medium">Erişim Yetkiniz Yok</h2>
          <p className="text-sm mt-1">Bu koli farklı bir bölüme ait.</p>
        </div>
      </div>
    )
  }

  // SSR'da QR data URL'leri üret — print sırasında async loading sorunu
  // yaşanmasın diye <img src=data:...> olarak inline gönderilir.
  const anaQrUrl = `${APP_URL}/arsiv/koli/${koli.arsivNo}`
  const anaQrDataUrl = await QRCode.toDataURL(anaQrUrl, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  })

  const altQrDataUrls: Record<string, string> = {}
  for (const alt of koli.altKoliler) {
    const altUrl = `${APP_URL}/arsiv/koli/${koli.arsivNo}#alt-${alt.harf}`
    altQrDataUrls[alt.id.toString()] = await QRCode.toDataURL(altUrl, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
  }

  return (
    <EtiketView
      koli={toJSONSafe(koli)}
      anaQrDataUrl={anaQrDataUrl}
      altQrDataUrls={altQrDataUrls}
    />
  )
}
