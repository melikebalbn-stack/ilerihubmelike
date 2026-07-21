import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiForbidden, apiBadRequest } from '@/lib/api-response'
import { getShopOrderOperation } from '@/lib/ifs/shop-order-operations'

// POST /api/ipro/kiosk/is-basla — body { tezgahId, ifsOrderNo, ifsOperationNo, personnelId, ifsOperationId? }
// Aktif oturuma bagli bir ACIK uretim satiri acar. Sinyalli tezgahta baslangic sayacini
// poller /status'ten damgalar (KARAR A: poller down → is ACILMAZ, 503).
export async function POST(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const body = await req.json().catch(() => null)
  const tezgahId = body?.tezgahId
  const ifsOrderNo = body?.ifsOrderNo
  const ifsOperationNo = body?.ifsOperationNo
  const personnelId = body?.personnelId
  const ifsOperationId = body?.ifsOperationId
  if (
    typeof tezgahId !== 'string' ||
    typeof ifsOrderNo !== 'string' ||
    typeof ifsOperationNo !== 'number' ||
    typeof personnelId !== 'string'
  ) {
    return apiBadRequest('tezgahId, ifsOrderNo, ifsOperationNo (number) ve personnelId gerekli')
  }
  // ifsOperationId opsiyonel — string ise al, degilse null (anahtar degil).
  const opId: string | null = typeof ifsOperationId === 'string' ? ifsOperationId : null

  // GUVENLIK: tezgah kiosk'un bagli tezgahlarindan biri OLMALI.
  const kt = kiosk.tezgahlar.find((k) => k.tezgah.id === tezgahId)
  if (!kt) return apiForbidden()
  const tezgahKod = kt.tezgah.kod

  // Acik is bir oturuma bagli olmali (sema sessionId NOT NULL).
  const oturum = await prisma.iproOperatorSession.findFirst({
    where: { personnelId, tezgahId, cikisAt: null },
    select: { id: true },
  })
  if (!oturum) return apiBadRequest('Once oturum acilmali (aktif oturum yok)')
  const sessionId = oturum.id

  // Sinyal tespiti — poller loadPins ile BIREBIR ayni filtre.
  const pinSayisi = await prisma.iproPlcPin.count({
    where: { tezgahId, aktif: true, plc: { aktif: true } },
  })
  const sinyalli = pinSayisi > 0

  // Sinyalliyse baslangic sayacini poller /status'ten oku (KARAR A: alinamazsa 503).
  let plcSayacBaslangic: number | null = null
  if (sinyalli) {
    const port = process.env.IPRO_POLLER_PORT ?? '3020'
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/status`, { signal: ctrl.signal })
      if (!res.ok) return apiError('Sayaç okunamadı, tekrar deneyin', 503)
      const list = (await res.json()) as Array<{ tezgahKod?: string; sayacToplam?: unknown }>
      const kayit = Array.isArray(list) ? list.find((x) => x.tezgahKod === tezgahKod) : undefined
      if (!kayit || typeof kayit.sayacToplam !== 'number') {
        return apiError('Sayaç okunamadı, tekrar deneyin', 503)
      }
      plcSayacBaslangic = kayit.sayacToplam
    } catch {
      return apiError('Sayaç okunamadı, tekrar deneyin', 503)
    } finally {
      clearTimeout(t)
    }
  }

  // Plan snapshot — IFS'ten OTORITER cek (client input'una guvenilmez: pano/rapor
  // dogrulanmamis input uzerine kurulamaz). YUMUSAK HATA: IFS erisilemezse null kalir,
  // is yine baslar; hata loglanir. Her poll'da DEGIL, yalnizca baslangicta tek cagri.
  // yyyy-MM-dd string → Date (bos ise null).
  const gunToDate = (s: string | undefined): Date | null => (s ? new Date(s) : null)
  let snapshot: {
    ifsPartNo: string | null
    ifsPartDescription: string | null
    ifsQtyDue: number | null
    ifsDueDate: Date | null
    ifsNeedDate: Date | null
    ifsMachRunFactor: number | null
    ifsLaborRunFactor: number | null
    ifsRunTimeCode: string | null
  } = {
    ifsPartNo: null, ifsPartDescription: null, ifsQtyDue: null, ifsDueDate: null,
    ifsNeedDate: null, ifsMachRunFactor: null, ifsLaborRunFactor: null, ifsRunTimeCode: null,
  }
  try {
    const op = await getShopOrderOperation(ifsOrderNo, ifsOperationNo)
    if (op) {
      snapshot = {
        ifsPartNo: op.stokKodu || null,
        ifsPartDescription: op.stokAdi || null,
        ifsQtyDue: op.miktar || null,
        ifsDueDate: gunToDate(op.teslimTarihi),
        ifsNeedDate: gunToDate(op.ihtiyacTarihi),
        ifsMachRunFactor: op.machRunFactor ?? null,
        ifsLaborRunFactor: op.laborRunFactor ?? null,
        ifsRunTimeCode: op.runTimeCode || null,
      }
    }
  } catch (e) {
    console.error('[ipro-is-basla] plan snapshot alinamadi (is yine baslar)', e)
  }

  // ACIK satir yaz. Partial unique (acik_is_uq) ihlali → P2002 → 409.
  try {
    const log = await prisma.iproProductionLog.create({
      data: {
        tezgahId,
        sessionId,
        personnelId,
        ifsOrderNo,
        ifsOperationNo,
        ifsOperationId: opId,
        ...snapshot,
        durum: 'ACIK',
        baslatildiAt: new Date(),
        plcSayacBaslangic,
        // qtyComplete/qtyScrap default 0; tamamlandi default true (bitirde ayarlanir); ifsYazildi default false
      },
      select: { id: true, durum: true, plcSayacBaslangic: true, baslatildiAt: true },
    })
    return apiSuccess(
      { id: log.id, durum: log.durum, plcSayacBaslangic: log.plcSayacBaslangic, baslatildiAt: log.baslatildiAt, sinyalli },
      201,
    )
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'P2002') return apiError('Bu iş zaten açık', 409)
    throw e
  }
}
