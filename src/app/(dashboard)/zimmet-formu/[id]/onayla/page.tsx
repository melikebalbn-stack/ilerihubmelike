import { redirect, notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { varsayilanTeslimNotu } from '@/lib/zimmet/teslim-notlari'
import { ZimmetOnayClient } from './ZimmetOnayClient'

export const dynamic = 'force-dynamic'

export default async function ZimmetOnayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canApprove = await hasPermission('zimmet-formu.approve')
  if (!canApprove) redirect('/dashboard')

  const { id } = await params

  const zimmet = await prisma.zimmetFormu.findFirst({
    where: { id, silindiMi: false },
    include: {
      zimmetSahibi: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      onaylayan: { select: { name: true, email: true } },
    },
  })

  if (!zimmet) notFound()

  // Date → string dönüşümü (Client Component serializasyonu için)
  const zimmetData = {
    ...zimmet,
    // Syteline devrinden gelen kayıtlarda teslimNotu hiç set edilmemişti -
    // türe göre standart metin varsayılan olarak gösteriliyor.
    teslimNotu: zimmet.teslimNotu ?? varsayilanTeslimNotu(zimmet.tur, zimmet.turDiger),
    verilisTarihi: zimmet.verilisTarihi?.toISOString() ?? null,
    teslimEdenImzaTarihi: zimmet.teslimEdenImzaTarihi?.toISOString() ?? null,
    createdAt: zimmet.createdAt.toISOString(),
    updatedAt: zimmet.updatedAt.toISOString(),
  }

  // Bu cihazın geçmişi: AYNI seriNumarasi'na sahip diğer kayıtlar. Seri no boşsa
  // gösterilmez (devir verisinde "Microsoft 365 İş Standart" gibi ortak metinler
  // 33 kayıtta tekrar ediyor → yanlış eşleşme olur).
  const seri = zimmet.seriNumarasi?.trim()
  const gecmis = seri
    ? await prisma.zimmetFormu.findMany({
        where: { seriNumarasi: seri, silindiMi: false, id: { not: id } },
        orderBy: { verilisTarihi: 'desc' },
        select: {
          id: true,
          verilisTarihi: true,
          iadeTarihi: true,
          durum: true,
          cihazDurumu: true,
          zimmetSahibi: { select: { name: true, email: true } },
        },
      })
    : []

  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

  // Çakışma uyarısı: aynı seri no'lu kayıtların ikisinden fazlası hâlâ iade
  // edilmemişse (iadeTarihi NULL) aynı seri birden fazla fiziksel cihazda kullanılmış
  // olabilir → kayıtlar aynı cihaza ait olmayabilir.
  const iadesizSayi =
    (zimmet.iadeTarihi === null ? 1 : 0) + gecmis.filter((g) => g.iadeTarihi === null).length
  const cakismaUyarisi = gecmis.length > 0 && iadesizSayi >= 2

  return (
    <>
      <ZimmetOnayClient zimmet={zimmetData} />
      {gecmis.length > 0 && (
        <div className="mx-auto max-w-3xl px-4 pb-10">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Bu cihazın geçmişi</h2>
          {cakismaUyarisi && (
            <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Aynı seri numarası birden fazla cihazda kullanılmış olabilir — kayıtlar aynı cihaza
              ait olmayabilir.
            </p>
          )}
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">Sahip</th>
                  <th className="px-3 py-2">Veriliş</th>
                  <th className="px-3 py-2">İade</th>
                  <th className="px-3 py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {gecmis.map((g) => (
                  <tr key={g.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{g.zimmetSahibi?.name ?? g.zimmetSahibi?.email ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{fmt(g.verilisTarihi)}</td>
                    <td className="px-3 py-2 text-slate-600">{fmt(g.iadeTarihi)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {g.iadeTarihi
                        ? g.cihazDurumu === 'HURDA'
                          ? 'Hurda'
                          : 'Envanterde'
                        : g.durum}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
