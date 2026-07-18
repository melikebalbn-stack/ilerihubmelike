import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { getRafBilgisi, getRaftakiStok, moveStok, type StokKimlik } from '@/lib/ifs/depo-stok'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KimlikSchema = z.object({
  contract: z.string().min(1),
  partNo: z.string().min(1),
  configurationId: z.string(),
  locationNo: z.string().min(1),
  lotBatchNo: z.string(),
  serialNo: z.string(),
  engChgLevel: z.string(),
  waivDevRejNo: z.string(),
  activitySeq: z.number(),
  handlingUnitId: z.number(),
})
const BodySchema = z.object({
  kimlik: KimlikSchema,
  hedefLocationNo: z.string().min(1),
  miktar: z.number().int().min(1),
})

const sameKeys = (a: StokKimlik, b: StokKimlik) =>
  a.contract === b.contract &&
  a.partNo === b.partNo &&
  a.configurationId === b.configurationId &&
  a.locationNo === b.locationNo &&
  a.lotBatchNo === b.lotBatchNo &&
  a.serialNo === b.serialNo &&
  a.engChgLevel === b.engChgLevel &&
  a.waivDevRejNo === b.waivDevRejNo &&
  a.activitySeq === b.activitySeq &&
  a.handlingUnitId === b.handlingUnitId

// POST /api/depo/stok-tasima → stok taşı (server-side taze doğrulamalı). Guard: admin.system.manage.
export async function POST(request: Request) {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Geçersiz JSON' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    return NextResponse.json({ ok: false, error: `Geçersiz istek: ${msg}` }, { status: 400 })
  }
  const { kimlik, hedefLocationNo, miktar } = parsed.data

  try {
    // c) hedef === kaynak
    if (hedefLocationNo === kimlik.locationNo) {
      return NextResponse.json({ ok: false, error: 'Hedef raf kaynakla aynı olamaz' }, { status: 400 })
    }

    // a) kaynağı IFS'ten TAZE çek (client'a güvenme)
    const kaynakStok = await getRaftakiStok(kimlik.locationNo)
    const kayit = kaynakStok.find((s) => sameKeys(s.kimlik, kimlik))
    if (!kayit) {
      return NextResponse.json({ ok: false, error: 'Kaynak stok kaydı bulunamadı' }, { status: 404 })
    }

    // b) miktar güncel taşınabilir miktarı aşıyor mu
    if (miktar > kayit.miktar) {
      return NextResponse.json(
        { ok: false, error: `Rafta yeterli miktar yok (güncel: ${kayit.miktar})` },
        { status: 409 },
      )
    }

    // d) hedef lokasyon gerçekten var mı
    const hedef = await getRafBilgisi(hedefLocationNo)
    if (!hedef) {
      return NextResponse.json({ ok: false, error: `Hedef raf bulunamadı: ${hedefLocationNo}` }, { status: 400 })
    }

    // Taşı — IFS hata detayını yutma
    const sonuc = await moveStok(kimlik, hedefLocationNo, miktar)
    if (!sonuc.ok) {
      return NextResponse.json({ ok: false, yol: sonuc.yol, error: sonuc.error ?? 'Taşıma başarısız' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, yol: sonuc.yol })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
