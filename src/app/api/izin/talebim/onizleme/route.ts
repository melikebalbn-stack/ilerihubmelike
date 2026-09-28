import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { izinHata } from '@/lib/izin/yonetim'
import { onizlemeHesapla, onizlemeYaniti } from '@/lib/izin/talep-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/talebim/onizleme {turId, baslangic, bitis, baslangicYarim?, bitisYarim?, personnelId?} —
// "Düşülecek X gün", düşülmeyen günler, "Kalan A → B" (talep ve İV onayıyla AYNI hesap).
export async function POST(req: NextRequest) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...onizlemeYaniti(await onizlemeHesapla(ctx, (await req.json()) ?? {})) })
  } catch (e) {
    return izinHata(e, 'Önizleme hesaplanamadı')
  }
}
