import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { talepGetir } from '@/lib/ifs/transfer-talebi'
import { stokYerleri, type StokYeri } from '@/lib/ifs/stok-bilgisi'
import { GUARD, hata, talepNo } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/transfer-talebi/{no} → { ok, talep, yerler } (başlık + istenen + seçili stoklar;
//   yerler[partNo] = kalanı olan malzemenin kaynak ambardaki stok yerleri, en fazla 3). SADECE OKUMA.
export async function GET(_request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const no = talepNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz talep no' }, { status: 400 })
  try {
    const talep = await talepGetir(no)
    if (!talep) return NextResponse.json({ ok: false, error: `Talep bulunamadı: ${no}` }, { status: 404 })
    // Depocu nereye gideceğini bilsin: kalanı olan her malzeme için kaynak ambardaki stok yerleri.
    // Yer bilgisi yardımcıdır — alınamazsa talep yine açılır.
    const yerler: Record<string, StokYeri[]> = {}
    await Promise.all(
      [...new Set(talep.malzemeler.filter((m) => m.kalan > 0).map((m) => m.partNo))].map(async (p) => {
        yerler[p] = await stokYerleri(p, talep.kaynakAmbar).catch(() => [])
      }),
    )
    return NextResponse.json({ ok: true, talep, yerler })
  } catch (e) {
    return hata(e)
  }
}
