/**
 * Koli Detay Sayfası — Server Component
 *
 * Layout:
 *   - Üst: Renkli bant + arsivNo + bölüm + durum + edit butonu (modal açar)
 *   - Sol kolon: Ana koli bilgileri + Alt koliler grid
 *   - Sağ kolon: QR kod placeholder + Geçmiş İşlemler
 *
 * NOT: Header/Modal/Timeline arası state paylaşımı (refreshKey) için
 * `KoliDetailClient` Client wrapper'ı kullanılıyor. Server Component'ler
 * (AnaKoliBilgileri, AltKolilerGrid, QrKodCard) wrapper'a slot olarak
 * iletiliyor — Next.js Client Component'lerin children olarak Server
 * render'larını kabul etmesine izin verir.
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getArsivUserContext } from '@/lib/arsiv-auth'
import { prisma } from '@/lib/prisma'
import { toJSONSafe } from '@/lib/arsiv-serialize'
import KoliDetailClient from './_components/koli-detail-client'
import { QRCodeDisplay } from '@/components/arsiv/qr-code-display'

const ARSIV_NO_REGEX = /^ARK-[A-Z]{3}-[0-9]{4}-[0-9]{3}$/

export default async function KoliDetayPage({
  params,
}: {
  params: Promise<{ arsivNo: string }>
}) {
  const { arsivNo } = await params
  if (!ARSIV_NO_REGEX.test(arsivNo)) notFound()

  const ctx = await getArsivUserContext()
  if (!ctx) redirect(`/login?callbackUrl=/arsiv/koli/${arsivNo}`)

  // Ana koli + lokasyonlar paralel — yetki kontrolünden önce çek (ekstra
  // 1ms bedeli, ama ana koli'nin lokasyon FK'si ve aktif lokasyon listesi
  // birbirinden bağımsız, sequential round-trip'i önlemek değer).
  const [koli, lokasyonlar] = await Promise.all([
    prisma.arsivKoli.findUnique({
      where: { arsivNo },
      include: {
        bolum: { select: { id: true, ad: true, kod: true, renkHex: true } },
        lokasyon: true,
        sorumlu: { select: { id: true, name: true, email: true } },
        olusturan: { select: { id: true, name: true, email: true } },
        guncelleyen: { select: { id: true, name: true, email: true } },
        altKoliler: {
          include: {
            evrakTuru: { select: { id: true, ad: true, varsayilanSaklamaYili: true } },
          },
          orderBy: { harf: 'asc' },
        },
      },
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
  ])

  if (!koli) notFound()

  if (!ctx.isSuperAdmin && koli.bolumId !== ctx.arsivBolumId) {
    return (
      <div className="p-6 max-w-screen-lg mx-auto">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <h2 className="font-medium">Erişim Yetkiniz Yok</h2>
          <p className="text-sm mt-1">Bu koli farklı bir bölüme ait.</p>
          <Link
            href="/arsiv/koli"
            className="inline-block mt-3 text-sm underline"
          >
            ← Liste sayfasına dön
          </Link>
        </div>
      </div>
    )
  }

  const koliJson = toJSONSafe(koli)
  const canEdit = ctx.isSuperAdmin || koli.bolumId === ctx.arsivBolumId

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <KoliDetailClient
        koli={koliJson}
        canEdit={canEdit}
        lokasyonlar={lokasyonlar}
        leftColumn={<AnaKoliBilgileri koli={koliJson} />}
        rightColumnTop={<QrKodCard koli={koliJson} />}
        arsivNo={koli.arsivNo}
        bolumId={koli.bolumId}
        anaKoliDonemBaslangic={koliJson.tarihAraligiBaslangic}
        anaKoliDonemSonu={koliJson.tarihAraligiSonu}
        altKoliler={koliJson.altKoliler}
      />
    </div>
  )
}

function AnaKoliBilgileri({
  koli,
}: {
  koli: {
    tarihAraligiBaslangic: string
    tarihAraligiSonu: string
    arsivlemeTarihi: string
    imhaTarihi: string
    lokasyon: { depoNo: string; rafKodu: string; siraNo: number } | null
    sorumlu: { name: string | null; email: string }
    olusturan: { name: string | null; email: string }
    aciklama: string | null
  }
}) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Ana Koli</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase">Dönem</dt>
          <dd className="text-sm mt-1">
            {fmt(koli.tarihAraligiBaslangic)} — {fmt(koli.tarihAraligiSonu)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase">Arşivleme</dt>
          <dd className="text-sm mt-1">{fmt(koli.arsivlemeTarihi)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase">İmha Tarihi</dt>
          <dd className="text-sm mt-1 font-medium text-rose-700">{fmt(koli.imhaTarihi)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase">Lokasyon</dt>
          <dd className="text-sm mt-1">
            {koli.lokasyon ? (
              `${koli.lokasyon.depoNo} / ${koli.lokasyon.rafKodu} / ${koli.lokasyon.siraNo}`
            ) : (
              <span className="text-slate-400">Lokasyonsuz</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase">Sorumlu</dt>
          <dd className="text-sm mt-1">{koli.sorumlu.name ?? koli.sorumlu.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase">Oluşturan</dt>
          <dd className="text-sm mt-1">{koli.olusturan.name ?? koli.olusturan.email}</dd>
        </div>
        {koli.aciklama && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500 uppercase">Açıklama</dt>
            <dd className="text-sm mt-1 whitespace-pre-wrap">{koli.aciklama}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

function QrKodCard({ koli }: { koli: { qrKod: string; arsivNo: string } }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">QR Kod</h2>
      <Link
        href={`/arsiv/koli/${koli.arsivNo}/etiket`}
        className="block hover:opacity-80 transition-opacity"
        title="Etiket basma sayfasını aç"
      >
        <QRCodeDisplay value={koli.qrKod} size={200} className="mx-auto" />
      </Link>
      <p className="text-xs text-slate-500 mt-2 break-all font-mono">{koli.qrKod}</p>
    </div>
  )
}
