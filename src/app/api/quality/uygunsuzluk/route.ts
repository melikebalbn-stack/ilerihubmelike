import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import { uygunsuzlukInput } from '@/lib/quality/uygunsuzluk-validators'
import { referanslariDogrula } from '@/lib/quality/uygunsuzluk-refs'
import { buildUygunsuzlukWhere } from '@/lib/quality/uygunsuzluk-query'
import { generateNextUygunsuzlukNo } from '@/lib/quality/uygunsuzluk-no'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/uygunsuzluk — liste. Auth: oturum (herkes okur).
 * Filtre: buildUygunsuzlukWhere (TEK KAYNAK). Sayfalama, `no desc`.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const where = buildUygunsuzlukWhere(sp)

  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get('pageSize') ?? '20', 10) || 20))

  const [total, rows] = await Promise.all([
    prisma.kaliteUygunsuzluk.count({ where }),
    prisma.kaliteUygunsuzluk.findMany({
      where,
      orderBy: { no: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        tespitEdenBolum: { select: { id: true, kod: true, ad: true } },
        sorumlu: { select: { adSoyad: true } },
        satirlar: { select: { redAdeti: true } },
        _count: { select: { satirlar: true } },
      },
    }),
  ])

  const items = rows.map((r) => ({
    ...r,
    durum: r.kapanisTarihi ? 'KAPALI' : 'ACIK',
    satirSayisi: r._count.satirlar,
    toplamRedAdeti: r.satirlar.reduce((s, x) => s + x.redAdeti, 0),
    sorumluAd: r.sorumlu?.adSoyad ?? null,
    satirlar: undefined,
    _count: undefined,
  }))

  return NextResponse.json({ items, total, page, pageSize })
}

/**
 * POST /api/quality/uygunsuzluk — oluştur. Auth: canManageUygunsuzluk.
 * `no` OTOMATİK (istekten kabul edilmez) ve numara üretimi kayıt ile AYNI
 * transaction içinde — advisory lock erken bırakılmasın.
 */
export async function POST(request: NextRequest) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  if (!canManageUygunsuzluk(session)) {
    return NextResponse.json({ error: 'Uygunsuzluk kaydı oluşturma yetkiniz yok' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = uygunsuzlukInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz veri', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const d = parsed.data

  // Referans kısıtı — bölüm/hata kodu tipleri (TEK KAYNAK, PATCH ile aynı)
  const refHatalari = await referanslariDogrula(d)
  if (refHatalari.length > 0) {
    return NextResponse.json(
      { error: refHatalari.map((h) => h.mesaj).join(' · '), refHatalari },
      { status: 400 },
    )
  }

  const created = await prisma.$transaction(async (tx) => {
    const no = await generateNextUygunsuzlukNo(tx)
    return tx.kaliteUygunsuzluk.create({
      data: {
        no,
        tarih: d.tarih,
        mamulUrunKodu: d.mamulUrunKodu,
        isEmriNo: d.isEmriNo,
        isEmriAdeti: d.isEmriAdeti ?? null,
        tespitEdenBolumId: d.tespitEdenBolumId ?? null,
        kokNeden: d.kokNeden ?? null,
        duzelticiFaaliyet: d.duzelticiFaaliyet ?? null,
        sorumluId: d.sorumluId ?? null,
        termin: d.termin ?? null,
        kapanisTarihi: d.kapanisTarihi ?? null,
        olusturanId: userId,
        guncelleyenId: userId,
        satirlar: {
          create: d.satirlar.map((s) => ({
            siraNo: s.siraNo,
            yariMamulKodu: s.yariMamulKodu ?? null,
            malzemeAdi: s.malzemeAdi ?? null,
            redAdeti: s.redAdeti,
            reworkAdedi: s.reworkAdedi ?? null,
            olusanBolumId: s.olusanBolumId ?? null,
            hataKoduId: s.hataKoduId ?? null,
            hataDetayi: s.hataDetayi ?? null,
            karar: s.karar ?? null,
          })),
        },
      },
      include: { satirlar: { orderBy: { siraNo: 'asc' } } },
    })
  })

  return NextResponse.json(
    { ...created, durum: created.kapanisTarihi ? 'KAPALI' : 'ACIK' },
    { status: 201 },
  )
}
