import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { generatePaletEtiketi } from '@/lib/depo/palet-etiket-pdf'
import { paletGetir } from '@/lib/ifs/tasima-birimi'
import { GUARD, hata, paletNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/tasima-birimi/{id}/etiket → palet etiketi PDF (80×100 mm, inline). IFS'e YAZMAZ:
// palet IFS'ten okunur (tür, lokasyon, içerik); barkod "P{id}" (önekli). HU_ETIKET logu.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const id = paletNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz palet no' }, { status: 400 })
  try {
    const palet = await paletGetir(id)
    if (!palet) return NextResponse.json({ ok: false, error: `Palet bulunamadı: ${id}` }, { status: 404 })
    // İçerik özeti: malzeme + ölçü birimi başına eldeki toplamı (lot/seri ayrımı etikette gösterilmez).
    const ozet = new Map<string, { partNo: string; partAdi: string; miktar: number; birim: string }>()
    for (const s of palet.icerik) {
      const k = `${s.partNo}|${s.birim}`
      const o = ozet.get(k)
      if (o) o.miktar += s.eldeki
      else ozet.set(k, { partNo: s.partNo, partAdi: s.partAdi, miktar: s.eldeki, birim: s.birim })
    }
    const basanKullanici = session.user.name ?? 'Operatör'
    const pdf = await generatePaletEtiketi({
      paletNo: id, tur: palet.tur, turAdi: palet.turAdi, lokasyon: palet.lokasyonNo, icerik: [...ozet.values()], basanKullanici,
    })
    await logDepoHareket({
      olay: 'HU_ETIKET', userId, kullaniciAd: basanKullanici, partNo: '-', miktar: ozet.size,
      kaynakLok: palet.lokasyonNo || null, orderNo: String(id), detay: { handlingUnitId: id, tur: palet.tur },
    })
    return new Response(pdf as BodyInit, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="palet-P${id}.pdf"`, 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return hata(e)
  }
}
