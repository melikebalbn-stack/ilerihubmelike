import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { fisGetir, transferEt } from '@/lib/ifs/toplu-tasima'
import { getStokBilgisi } from '@/lib/ifs/stok-bilgisi'
import { GUARD, fisNo, hata } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/toplu-tasima/{no}/transfer → TransferEt. Önce güncel kullanılabilir kontrolü;
// yetersizse 409 + eksikler (IFS'e gidilmez). IFS'e YAZAR.
export async function POST(_request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const no = fisNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz fiş no' }, { status: 400 })
  try {
    const once = await fisGetir(no)
    const sonuc = await transferEt(no)
    if (!sonuc.ok) {
      return NextResponse.json({ ok: false, error: 'Kullanılabilir stok yetersiz', eksikler: sonuc.eksikler }, { status: 409 })
    }
    for (const s of once?.satirlar ?? []) {
      await logDepoHareket({
        olay: 'TOPLU_TASIMA_TRANSFER',
        userId,
        kullaniciAd: session.user.name ?? 'Operatör',
        partNo: s.partNo,
        lotBatchNo: s.lotBatchNo || null,
        miktar: s.miktar,
        kaynakLok: s.locationNo,
        hedefLok: once?.varisLok ?? null,
        orderNo: String(no),
        // Fiş satırı tam kimliği — geri almada hedefteki satırı bulmak için.
        detay: { stok: { partNo: s.partNo, locationNo: s.locationNo, lotBatchNo: s.lotBatchNo, serialNo: s.serialNo, engChgLevel: s.engChgLevel,
          waivDevRejNo: s.waivDevRejNo, configurationId: s.configurationId, activitySeq: s.activitySeq, handlingUnitId: s.handlingUnitId } },
      })
    }
    // Transfer özeti ekranındaki "Etiket Yazdır" için kalemler. Birim fiş satırında yok → hedefteki stoktan
    // (yalnız okuma; bulunamazsa boş kalır, etiketi bloklamaz).
    const hedef = once?.varisLok ?? ''
    const birimler = new Map<string, string>()
    await Promise.all(
      [...new Set((once?.satirlar ?? []).map((s) => s.partNo))].map(async (partNo) => {
        try {
          const r = await getStokBilgisi({ locationNo: hedef, partNoEq: partNo })
          birimler.set(partNo, r.satirlar[0]?.birim ?? '')
        } catch { /* birim bilinmiyor */ }
      }),
    )
    const kalemler = (once?.satirlar ?? []).map((s) => ({
      partNo: s.partNo,
      partAdi: s.partAdi,
      miktar: s.miktar,
      birim: birimler.get(s.partNo) ?? '',
      lot: s.lotBatchNo && s.lotBatchNo !== '*' ? s.lotBatchNo : '',
      kaynakLok: s.locationNo,
      hedefLok: hedef,
    }))
    return NextResponse.json({ ok: true, durum: sonuc.durum, kalemler })
  } catch (e) {
    return hata(e)
  }
}
