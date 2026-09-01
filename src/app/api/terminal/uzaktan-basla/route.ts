import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api-response'
import { getShopOrderOperation } from '@/lib/ifs/shop-order-operations'
import { openSession } from '@/lib/ipro/operator-session'
import { OperatorIdentifyError } from '@/lib/ipro/identify-operator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// OperatorIdentifyError.code -> HTTP durum kodu (oturum route'uyla aynı tablo).
const IDENTIFY_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  INACTIVE: 403,
  NO_SICIL: 422,
  METHOD_NOT_ENABLED: 403,
}

// POST /api/terminal/uzaktan-basla — body { tezgahId, personnelId, ifsOrderNo, ifsOperationNo, ifsOperationId? }
// Terminalden UZAKTAN iş başlatma: ipro.admin yetkili kullanıcı, seçtiği operatör adına,
// herhangi bir AKTİF tezgahta iş açar. Kiosk /kiosk/is-basla ÇEKİRDEĞİNİN KOPYASI (o dosyaya
// DOKUNULMADI). Farklar:
//   (1) Guard: ipro.admin (kiosk-session DEĞİL, ipro.view YETMEZ).
//   (2) Tezgah kısıtı YOK — kiosk cihaz listesi geçerli değil; tüm AKTİF tezgahlar.
//   (3) Oturum yoksa AÇAR (openSession idempotent). is-basla mevcut oturum şart koşar.
//   (4) baslatanUserId + kaynak='TERMINAL' yazılır (operatör ≠ başlatan; denetim izi).
//   (5) Poller /status okunamazsa BLOKLAMAZ (is-basla'da 503) — plcSayacBaslangic null kalır,
//       uzaktan başlatmayı poller down engellemesin.
export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission('ipro.admin')
  if (error) return error

  const body = await req.json().catch(() => null)
  const tezgahId = body?.tezgahId
  const personnelId = body?.personnelId
  const ifsOrderNo = body?.ifsOrderNo
  const ifsOperationNo = body?.ifsOperationNo
  const ifsOperationId = body?.ifsOperationId
  if (
    typeof tezgahId !== 'string' ||
    typeof personnelId !== 'string' ||
    typeof ifsOrderNo !== 'string' ||
    typeof ifsOperationNo !== 'number'
  ) {
    return apiBadRequest('tezgahId, personnelId, ifsOrderNo ve ifsOperationNo (number) gerekli')
  }
  // ifsOperationId opsiyonel — string ise al, değilse null (anahtar değil).
  const opId: string | null = typeof ifsOperationId === 'string' ? ifsOperationId : null

  // Tezgah gerçek ve AKTİF olmalı (kiosk cihaz listesi yerine). kod: poller sayaç eşleşmesi.
  const tezgah = await prisma.iproTezgah.findUnique({
    where: { id: tezgahId },
    select: { id: true, kod: true, aktif: true },
  })
  if (!tezgah || !tezgah.aktif) return apiBadRequest('Tezgah bulunamadı veya pasif')
  const tezgahKod = tezgah.kod

  // Tezgah tek iş çalıştırır: bu tezgahta zaten ACIK iş varsa 409 (fiziksel kısıt;
  // acik_is_uq yalnız operatör+order+op tekilliğini tutar, tezgah düzeyini DEĞİL).
  const acikVar = await prisma.iproProductionLog.findFirst({
    where: { tezgahId, durum: 'ACIK' },
    select: { id: true },
  })
  if (acikVar) return apiError('Bu tezgahta zaten açık iş var', 409)

  // Operatör oturumu YOKSA aç (openSession idempotent; identifyOperator personeli doğrular:
  // aktif + sicil). Mevcut ACTIVE oturum varsa onu döndürür.
  let sessionId: string
  try {
    const oturum = await openSession({ method: 'LIST', personnelId, tezgahId })
    sessionId = oturum.id
  } catch (err) {
    if (err instanceof OperatorIdentifyError) {
      return apiError(err.message, IDENTIFY_STATUS[err.code] ?? 400)
    }
    throw err
  }

  // Sinyal tespiti — poller loadPins ile BİREBİR aynı filtre (is-basla kopyası).
  const pinSayisi = await prisma.iproPlcPin.count({
    where: { tezgahId, aktif: true, plc: { aktif: true } },
  })
  const sinyalli = pinSayisi > 0

  // Sinyalliyse başlangıç sayacını poller /status'ten oku. FARK: hata BLOKLAMAZ —
  // plcSayacBaslangic null kalır, iş yine başlar (is-basla'da 503).
  let plcSayacBaslangic: number | null = null
  if (sinyalli) {
    const port = process.env.IPRO_POLLER_PORT ?? '3020'
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/status`, { signal: ctrl.signal })
      if (res.ok) {
        const list = (await res.json()) as Array<{ tezgahKod?: string; sayacToplam?: unknown }>
        const kayit = Array.isArray(list) ? list.find((x) => x.tezgahKod === tezgahKod) : undefined
        if (kayit && typeof kayit.sayacToplam === 'number') plcSayacBaslangic = kayit.sayacToplam
      }
    } catch {
      // poller erişilemedi → plcSayacBaslangic null; iş yine başlar (bloklamaz).
    } finally {
      clearTimeout(t)
    }
  }

  // Plan snapshot — IFS'ten OTORİTER çek (client input'una güvenilmez). YUMUŞAK HATA:
  // IFS erişilemezse null kalır, iş yine başlar (is-basla kopyası).
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
    console.error('[terminal-uzaktan-basla] plan snapshot alinamadi (is yine baslar)', e)
  }

  // ACIK satır yaz — baslatanUserId + kaynak='TERMINAL' ile. Partial unique (acik_is_uq:
  // operatör+order+op) ihlali → P2002 → 409 (yarış/çift gönderim).
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
        baslatanUserId: session.user.id,
        kaynak: 'TERMINAL',
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
