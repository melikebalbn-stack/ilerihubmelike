import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageHataKodu } from '@/lib/quality/hata-kodu-access'
import { hataKoduCreateInput } from '@/lib/quality/hata-kodu-validators'
import { agacKur, hataKoduSelect } from '@/lib/quality/hata-kodu-tree'
import { HataKoduTip } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/hata-kodu — hata kodu listesi. Auth: oturum (herkes okur).
 *
 * ?duz=1   → düz liste (varsayılan: ağaç)
 * ?aktif=1 → yalnız aktif kodlar (varsayılan: hepsi)
 *
 * Sıralama siraNo, eşitlikte kod. Sayfalama YOK — küme küçük (~126 satır) ve
 * ağaç kurmak için tamamı gerekli.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const yalnizAktif = sp.get('aktif') === '1'
  const duz = sp.get('duz') === '1'

  const rows = await prisma.hataKodu.findMany({
    where: yalnizAktif ? { aktif: true } : undefined,
    orderBy: [{ siraNo: 'asc' }, { kod: 'asc' }],
    select: hataKoduSelect,
  })

  return NextResponse.json({ items: duz ? rows : agacKur(rows), total: rows.length })
}

/**
 * POST /api/quality/hata-kodu — yeni kod. Auth: canManageHataKodu (quality.hatakodu.manage).
 * siraNo verilmezse kod değeri kullanılır.
 * tip verilmezse KOD. tip=BOLUM ise ustKodId zorla null (bölümün üstü olmaz);
 * tip=KOD'da ustKodId davranışı değişmedi.
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageHataKodu(session)) {
    return NextResponse.json({ error: 'Hata kodu oluşturma yetkiniz yok' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = hataKoduCreateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz veri', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const d = parsed.data

  const mevcutKod = await prisma.hataKodu.findUnique({ where: { kod: d.kod }, select: { id: true } })
  if (mevcutKod) {
    return NextResponse.json({ error: `${d.kod} kodu zaten kayıtlı` }, { status: 409 })
  }

  const tip = d.tip ?? HataKoduTip.KOD
  // BOLUM'ün üstü OLMAZ: gövdede ustKodId gelse bile zorla null'lanır (sessizce,
  // hata değil — istemci bölüm modunda o alanı zaten göstermiyor).
  const ustKodId = tip === HataKoduTip.BOLUM ? null : (d.ustKodId ?? null)

  // Üst kod var mı? (yeni kayıt henüz yok → döngü imkânsız, yalnız varlık kontrolü)
  if (ustKodId) {
    const ust = await prisma.hataKodu.findUnique({ where: { id: ustKodId }, select: { id: true } })
    if (!ust) return NextResponse.json({ error: 'Üst kod bulunamadı' }, { status: 400 })
  }

  const created = await prisma.hataKodu.create({
    data: {
      kod: d.kod,
      ad: d.ad,
      tip,
      ustKodId,
      aktif: d.aktif ?? true,
      siraNo: d.siraNo ?? d.kod,
      aciklama: d.aciklama ?? null,
    },
    select: hataKoduSelect,
  })

  return NextResponse.json(created, { status: 201 })
}
