import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_APPROVE_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { logYillikTakvimAction } from '@/lib/yillik-calisma-takvimi/audit'
import { lockYillikTakvimParent } from '@/lib/yillik-calisma-takvimi/transaction'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

const RevertApprovalSchema = z.object({
  gerekce: z.string().trim().min(3, 'Geri alma gerekçesi en az 3 karakter olmalıdır').max(2000),
}).strict()

class ApprovalRuleError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

export async function POST(request: NextRequest, { params }: Context) {
  const { session, userId, error } = await requirePermission([...YILLIK_TAKVIM_APPROVE_PERMISSIONS])
  if (error) return error
  const parsed = RevertApprovalSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geri alma gerekçesini kontrol edin', details: parsed.error.flatten() }, { status: 400 })
  const { id } = await params

  try {
    const result = await prisma.$transaction(async tx => {
      await lockYillikTakvimParent(tx, id)
      const kayit = await tx.yillikTakvimKaydi.findUnique({ where: { id }, select: { id: true, durum: true, iptalMi: true, arsivMi: true } })
      if (!kayit) throw new ApprovalRuleError('Kayıt bulunamadı', 404)
      if (kayit.iptalMi || kayit.arsivMi) throw new ApprovalRuleError('Kayıt durumu değişti; sayfayı yenileyin', 409)
      if (!['ONAYLANDI', 'REVIZYON_ISTENDI'].includes(kayit.durum)) throw new ApprovalRuleError('Bu kayıt geri alma için uygun durumda değil', 409)

      const existing = await tx.yillikTakvimOnayAdimi.findMany({ where: { kayitId: id }, orderBy: [{ tur: 'desc' }, { adimSira: 'desc' }] })
      const latestTur = existing[0]?.tur
      const latest = existing.filter(step => step.tur === latestTur)
      const lastDecided = latest.filter(step => step.karar !== null).sort((a, b) => b.adimSira - a.adimSira)[0]
      if (!lastDecided) throw new ApprovalRuleError('Geri alınacak karar bulunamadı', 404)

      const isAdmin = session.user.permissions?.includes('yilliktakvim.admin') ?? false
      if (userId !== lastDecided.onaylayanId && !isAdmin) throw new ApprovalRuleError('Bu kararı yalnız kararı veren kişi veya admin geri alabilir', 403)

      const claimed = await tx.yillikTakvimOnayAdimi.updateMany({
        where: { id: lastDecided.id, karar: { not: null } },
        data: { karar: null, yorum: null, kararTarihi: null },
      })
      if (claimed.count !== 1) throw new ApprovalRuleError('Bu adım eşzamanlı değişmiş, sayfayı yenileyin', 409)

      await tx.yillikTakvimKaydi.update({ where: { id }, data: { durum: 'TAMAMLANDI_ONAY_BEKLIYOR', updatedById: userId } })
      await logYillikTakvimAction({
        tx,
        kayitId: id,
        yapanId: userId,
        islemTuru: 'ONAY_GERI_ALINDI',
        alan: 'onay',
        metadata: {
          onayAdimiId: lastDecided.id,
          tur: latestTur,
          sira: lastDecided.adimSira,
          eskiKarar: lastDecided.karar,
          eskiYorum: lastDecided.yorum,
          gerekce: parsed.data.gerekce,
          oncekiDurum: kayit.durum,
          yeniDurum: 'TAMAMLANDI_ONAY_BEKLIYOR',
        },
      })
      return { success: true, id, durum: 'TAMAMLANDI_ONAY_BEKLIYOR' }
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json(result)
  } catch (cause) {
    if (cause instanceof ApprovalRuleError) return NextResponse.json({ error: cause.message }, { status: cause.status })
    console.error('[POST onay]', cause)
    return NextResponse.json({ error: 'Onay işlemi gerçekleştirilemedi' }, { status: 500 })
  }
}
