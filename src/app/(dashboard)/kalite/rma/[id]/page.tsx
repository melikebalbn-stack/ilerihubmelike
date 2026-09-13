import { redirect, notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { rmaMod } from '@/lib/quality/rma-access'
import { prisma } from '@/lib/prisma'
import { RmaFormClient, type RmaDetay } from '@/components/quality/rma/RmaFormClient'

export const dynamic = 'force-dynamic'

/**
 * RMA/SMA detay/düzenleme. Oturum: herkes okur.
 * Yazma kipi rmaMod ile belirlenir: full (canManageRma) · sorumlu (yalnız kök
 * neden + aksiyon, kayıt AÇIK) · ro (salt okunur).
 */
export default async function RmaDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, user, error } = await requireUser()
  if (error) redirect('/login')
  const { id } = await params

  const k = await prisma.rmaKayit.findUnique({
    where: { id },
    include: {
      musteri: { select: { id: true, code: true, name: true } },
      sorumlu: { select: { adSoyad: true, sicilNo: true } },
      satirlar: { orderBy: { siraNo: 'asc' } },
      fotolar: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!k) notFound()

  // requireUser DB user'ı döndürüyor → personnelId için ek sorgu YOK.
  const mod = rmaMod(session, { sorumluId: k.sorumluId, durum: k.durum }, user.personnelId)

  // Prisma Date/Decimal → client'a düz (serializable) obje.
  const iso = (d: Date | null) => (d ? d.toISOString() : null)
  const detay: RmaDetay = {
    id: k.id,
    no: k.no,
    tip: k.tip,
    urunGelisTarihi: iso(k.urunGelisTarihi),
    irsaliyeTarihi: iso(k.irsaliyeTarihi),
    irsaliyeNo: k.irsaliyeNo,
    musteri: k.musteri,
    iadeTuru: k.iadeTuru,
    sorumluId: k.sorumluId,
    sorumlu: k.sorumlu,
    termin: iso(k.termin),
    kapanisTarihi: iso(k.kapanisTarihi),
    durum: k.durum,
    maliyet: k.maliyet != null ? k.maliyet.toString() : null,
    satirlar: k.satirlar.map((s) => ({
      id: s.id,
      siraNo: s.siraNo,
      urunKodu: s.urunKodu,
      lotNo: s.lotNo,
      iadeMiktari: s.iadeMiktari,
      musteriIadeSebebi: s.musteriIadeSebebi,
      ilkIncelemeSonucu: s.ilkIncelemeSonucu,
      karar: s.karar,
      kararAciklama: s.kararAciklama,
      hurdaAdedi: s.hurdaAdedi,
      reworkAdedi: s.reworkAdedi,
      musteriIadeAdedi: s.musteriIadeAdedi,
      kokNeden: s.kokNeden,
      aksiyon: s.aksiyon,
    })),
    fotolar: k.fotolar.map((f) => ({
      id: f.id,
      dosyaYolu: f.dosyaYolu,
      dosyaAdi: f.dosyaAdi,
      mimeType: f.mimeType,
      createdAt: f.createdAt.toISOString(),
    })),
  }

  return <RmaFormClient initial={detay} mod={mod} />
}
