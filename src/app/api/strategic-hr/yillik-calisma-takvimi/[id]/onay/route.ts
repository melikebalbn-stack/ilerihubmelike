import { NextRequest, NextResponse } from 'next/server'
import type { Prisma, YillikTakvimDurum } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_APPROVE_PERMISSIONS, YILLIK_TAKVIM_VIEW_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { YillikTakvimApprovalSchema } from '@/lib/yillik-calisma-takvimi/validators'
import { logYillikTakvimAction } from '@/lib/yillik-calisma-takvimi/audit'
import { lockYillikTakvimParent } from '@/lib/yillik-calisma-takvimi/transaction'
import { ycktOnaylayanZinciriCoz } from '@/lib/yillik-calisma-takvimi/hiyerarsi-cozumle'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }
type Tx = Prisma.TransactionClient

const stepSelect = {
  id: true, tur: true, adimSira: true, unvan: true, karar: true, yorum: true, kararTarihi: true,
  onaylayan: { select: { id: true, name: true } },
} as const

class ApprovalRuleError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

async function currentOrCreateSnapshot(tx: Tx, kayitId: string) {
  const existing = await tx.yillikTakvimOnayAdimi.findMany({ where: { kayitId }, orderBy: [{ tur: 'desc' }, { adimSira: 'asc' }] })
  const latestTur = existing[0]?.tur ?? 0
  const latest = existing.filter(step => step.tur === latestTur)
  const needsNewTurn = latest.length === 0 || latest.some(step => step.karar === 'REVIZYON_ISTENDI')
  if (!needsNewTurn) return { tur: latestTur, steps: latest }

  const configured = await tx.yillikTakvimOnayKademesi.findMany({ where: { aktif: true }, orderBy: { sira: 'asc' } })
  if (configured.length === 0) throw new ApprovalRuleError('Aktif Yıllık Takvim onay kademesi tanımlı değil')
  const anaSorumlu = await tx.yillikTakvimKatilimci.findFirst({
    where: { kayitId, rol: 'ANA_SORUMLU' },
    select: { userId: true },
  })
  const kademeSayisi = configured.length
  const hiyerarsi = anaSorumlu
    ? await ycktOnaylayanZinciriCoz(anaSorumlu.userId, kademeSayisi)
    : []
  const tur = latestTur + 1
  const data = Array.from({ length: kademeSayisi }, (_, index) => {
    const adimSira = index + 1
    const hiyerarsiAdimi = hiyerarsi.find(step => step.adimSira === adimSira)
    const yedek = configured[index]
    const onaylayanId = hiyerarsiAdimi?.userId ?? yedek?.userId
    if (!onaylayanId) {
      console.warn(`[YCT onay] ${kayitId} kaydı için ${adimSira}. onay adımı atlandı: onaylayan bulunamadı`)
      return null
    }
    return { kayitId, tur, adimSira, unvan: yedek?.unvan ?? `${adimSira}. Onaylayan`, onaylayanId }
  }).filter(step => step !== null)
  await tx.yillikTakvimOnayAdimi.createMany({ data })
  const steps = await tx.yillikTakvimOnayAdimi.findMany({ where: { kayitId, tur }, orderBy: { adimSira: 'asc' } })
  return { tur, steps }
}

export async function GET(_request: NextRequest, { params }: Context) {
  const { session, userId, error } = await requirePermission([...YILLIK_TAKVIM_VIEW_PERMISSIONS])
  if (error) return error
  const { id } = await params
  const kayit = await prisma.yillikTakvimKaydi.findUnique({ where: { id }, select: { id: true, durum: true, iptalMi: true, arsivMi: true } })
  if (!kayit) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  const history = await prisma.yillikTakvimOnayAdimi.findMany({ where: { kayitId: id }, select: stepSelect, orderBy: [{ tur: 'desc' }, { adimSira: 'asc' }] })
  const latestTur = history[0]?.tur ?? 0
  const latest = history.filter(step => step.tur === latestTur)
  let steps = latest
  let snapshotPending = false
  if (kayit.durum === 'TAMAMLANDI_ONAY_BEKLIYOR' && (latest.length === 0 || latest.some(step => step.karar === 'REVIZYON_ISTENDI'))) {
    const configured = await prisma.yillikTakvimOnayKademesi.findMany({ where: { aktif: true }, select: { id: true, sira: true, unvan: true, user: { select: { id: true, name: true } } }, orderBy: { sira: 'asc' } })
    steps = configured.map(step => ({ id: `pending-${step.id}`, tur: latestTur + 1, adimSira: step.sira, unvan: step.unvan, karar: null, yorum: null, kararTarihi: null, onaylayan: step.user }))
    snapshotPending = true
  }
  const active = kayit.durum === 'TAMAMLANDI_ONAY_BEKLIYOR' ? steps.find(step => step.karar === null) ?? null : null
  const hasApprovePermission = session.user.permissions?.some(permission => ['yilliktakvim.approve', 'yilliktakvim.admin'].includes(permission)) ?? false
  const lastDecided = ['ONAYLANDI', 'REVIZYON_ISTENDI'].includes(kayit.durum)
    ? latest.filter(step => step.karar !== null).sort((a, b) => b.adimSira - a.adimSira)[0] ?? null
    : null
  const isAdmin = session.user.permissions?.includes('yilliktakvim.admin') ?? false
  const canRevert = !!lastDecided && (lastDecided.onaylayan?.id === userId || isAdmin)
  return NextResponse.json({ kayit, history, currentSteps: steps, activeStepId: active?.id ?? null, snapshotPending, canAct: hasApprovePermission && active?.onaylayan?.id === userId, canRevert })
}

export async function POST(request: NextRequest, { params }: Context) {
  const { userId, error } = await requirePermission([...YILLIK_TAKVIM_APPROVE_PERMISSIONS])
  if (error) return error
  const parsed = YillikTakvimApprovalSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Karar alanlarını kontrol edin', details: parsed.error.flatten() }, { status: 400 })
  const { id } = await params

  try {
    const result = await prisma.$transaction(async tx => {
      await lockYillikTakvimParent(tx, id)
      const kayit = await tx.yillikTakvimKaydi.findUnique({ where: { id }, select: { id: true, durum: true, iptalMi: true, arsivMi: true } })
      if (!kayit) throw new ApprovalRuleError('Kayıt bulunamadı', 404)
      if (kayit.iptalMi || kayit.arsivMi) throw new ApprovalRuleError('Kayıt durumu değişti; sayfayı yenileyin', 409)
      if (kayit.durum !== 'TAMAMLANDI_ONAY_BEKLIYOR') throw new ApprovalRuleError('Kayıt durumu değişti; sayfayı yenileyin', 409)

      const { tur, steps } = await currentOrCreateSnapshot(tx, id)
      const active = steps.filter(step => step.karar === null).sort((a, b) => a.adimSira - b.adimSira)[0]
      if (!active) throw new ApprovalRuleError('Bekleyen onay adımı bulunamadı')
      if (active.onaylayanId !== userId) throw new ApprovalRuleError('Yalnız aktif adıma atanmış onaylayıcı karar verebilir', 403)

      const claimed = await tx.yillikTakvimOnayAdimi.updateMany({ where: { id: active.id, karar: null }, data: {
        karar: parsed.data.karar, yorum: parsed.data.yorum ?? null, kararTarihi: new Date(),
      } })
      if (claimed.count !== 1) throw new ApprovalRuleError('Bu onay adımı daha önce işlenmiş', 409)

      let durum: YillikTakvimDurum = kayit.durum
      if (parsed.data.karar === 'REVIZYON_ISTENDI') {
        durum = 'REVIZYON_ISTENDI'
        await tx.yillikTakvimKaydi.update({ where: { id }, data: { durum, updatedById: userId } })
      } else {
        const hasNext = steps.some(step => step.adimSira > active.adimSira && step.karar === null)
        if (!hasNext) {
          durum = 'ONAYLANDI'
          await tx.yillikTakvimKaydi.update({ where: { id }, data: { durum, updatedById: userId } })
        }
      }
      await logYillikTakvimAction({ tx, kayitId: id, yapanId: userId, islemTuru: parsed.data.karar === 'ONAYLANDI' ? 'ONAY' : 'REVIZYON_ISTE', alan: 'onay', metadata: {
        onayAdimiId: active.id, tur, sira: active.adimSira, karar: parsed.data.karar, oncekiDurum: kayit.durum, yeniDurum: durum,
      } })
      return { success: true, id, tur, karar: parsed.data.karar, durum }
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json(result)
  } catch (cause) {
    if (cause instanceof ApprovalRuleError) return NextResponse.json({ error: cause.message }, { status: cause.status })
    console.error('[POST onay]', cause)
    return NextResponse.json({ error: 'Onay işlemi gerçekleştirilemedi' }, { status: 500 })
  }
}
