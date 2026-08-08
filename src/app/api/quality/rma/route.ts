import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageRma } from '@/lib/quality/rma-access'
import { rmaKayitInput } from '@/lib/quality/rma-validators'
import { generateNextRmaNo } from '@/lib/quality/rma-no'
import { buildRmaWhere } from '@/lib/quality/rma-query'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/rma — liste. Auth: oturum (herkes okur).
 * Filtre: tip, musteriId, durum(acik|kapali), from/to (irsaliyeTarihi), q (no|urunKodu|müşteri adı). Sayfalama.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const where = buildRmaWhere(sp)

  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get('pageSize') ?? '20', 10) || 20))

  const [total, rows] = await Promise.all([
    prisma.rmaKayit.count({ where }),
    prisma.rmaKayit.findMany({
      where,
      orderBy: { no: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        musteri: { select: { id: true, name: true, code: true } },
        sorumlu: { select: { adSoyad: true } },
        satirlar: { select: { iadeMiktari: true } },
        _count: { select: { satirlar: true } },
      },
    }),
  ])

  const items = rows.map((r) => ({
    ...r,
    durum: r.kapanisTarihi ? 'KAPALI' : 'ACIK',
    satirSayisi: r._count.satirlar,
    toplamMiktar: r.satirlar.reduce((s, x) => s + x.iadeMiktari, 0),
    sorumluAd: r.sorumlu?.adSoyad ?? null,
    satirlar: undefined,
    _count: undefined,
  }))

  return NextResponse.json({ items, total, page, pageSize })
}

/**
 * POST /api/quality/rma — oluştur. Auth: canManageRma. `no` OTOMATİK (istekten kabul edilmez).
 */
export async function POST(request: NextRequest) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  if (!canManageRma(session)) {
    return NextResponse.json({ error: 'RMA kaydı oluşturma yetkiniz yok' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = rmaKayitInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz veri', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const d = parsed.data

  // Müşteri var + aktif mi
  const musteri = await prisma.costCustomer.findUnique({
    where: { id: d.musteriId },
    select: { id: true, isActive: true },
  })
  if (!musteri || !musteri.isActive) {
    return NextResponse.json({ error: 'Geçersiz veya pasif müşteri' }, { status: 400 })
  }

  const created = await prisma.$transaction(async (tx) => {
    const no = await generateNextRmaNo(tx)
    return tx.rmaKayit.create({
      data: {
        tip: d.tip,
        no,
        urunGelisTarihi: d.urunGelisTarihi ?? null,
        irsaliyeTarihi: d.irsaliyeTarihi ?? null,
        irsaliyeNo: d.irsaliyeNo ?? null,
        musteriId: d.musteriId,
        iadeTuru: d.iadeTuru,
        sorumluId: d.sorumluId ?? null,
        termin: d.termin ?? null,
        kapanisTarihi: d.kapanisTarihi ?? null,
        maliyet: d.maliyet ?? null,
        olusturanId: userId,
        guncelleyenId: userId,
        satirlar: {
          create: d.satirlar.map((s) => ({
            siraNo: s.siraNo,
            urunKodu: s.urunKodu,
            lotNo: s.lotNo ?? null,
            iadeMiktari: s.iadeMiktari,
            musteriIadeSebebi: s.musteriIadeSebebi,
            ilkIncelemeSonucu: s.ilkIncelemeSonucu ?? null,
            karar: s.karar ?? null,
            kararAciklama: s.kararAciklama ?? null,
            hurdaAdedi: s.hurdaAdedi ?? null,
            reworkAdedi: s.reworkAdedi ?? null,
            kokNeden: s.kokNeden ?? null,
            aksiyon: s.aksiyon ?? null,
          })),
        },
      },
      include: { satirlar: { orderBy: { siraNo: 'asc' } }, musteri: { select: { name: true, code: true } } },
    })
  })

  return NextResponse.json(created, { status: 201 })
}
