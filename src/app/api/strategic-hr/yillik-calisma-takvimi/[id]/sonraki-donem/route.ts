import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { YILLIK_TAKVIM_VIEW_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { logYillikTakvimAction } from '@/lib/yillik-calisma-takvimi/audit'
import { sonrakiDonemHesaplanabilir, sonrakiDonemTarihi } from '@/lib/yillik-calisma-takvimi/next-period'
import { lockYillikTakvimParent } from '@/lib/yillik-calisma-takvimi/transaction'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

const KOPYALANAN_ALANLAR = ['anaKonu', 'surec', 'departmentId', 'oncelik', 'periyot', 'katilimcilar', 'bildirimKurallari', 'checklist']

class NextPeriodRuleError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export async function POST(_request: NextRequest, { params }: Context) {
  const { session, userId, error } = await requirePermission([...YILLIK_TAKVIM_VIEW_PERMISSIONS])
  if (error) return error
  const { id } = await params
  const isAdmin = session.user.permissions?.includes('yilliktakvim.admin') ?? false

  try {
    const result = await prisma.$transaction(async tx => {
      await lockYillikTakvimParent(tx, id)
      const kayit = await tx.yillikTakvimKaydi.findUnique({
        where: { id },
        include: {
          katilimcilar: true,
          bildirimKurallari: true,
          checklist: true,
          sonrakiKayitlar: { where: { iptalMi: false }, select: { id: true } },
        },
      })
      if (!kayit) throw new NextPeriodRuleError('Kayıt bulunamadı', 404)
      if (kayit.iptalMi || kayit.arsivMi || kayit.durum !== 'ONAYLANDI') {
        throw new NextPeriodRuleError('Yalnız aktif ve onaylanmış kayıt için sonraki dönem oluşturulabilir', 409)
      }
      const isOwner = kayit.createdById === userId || kayit.katilimcilar.some(item => item.rol === 'ANA_SORUMLU' && item.userId === userId)
      if (!isAdmin && !isOwner) throw new NextPeriodRuleError('Sonraki dönemi yalnız ana sorumlu veya admin oluşturabilir', 403)
      if (kayit.sonrakiKayitlar.length > 0) throw new NextPeriodRuleError('Bu kayıt için zaten aktif bir sonraki dönem mevcut', 409)

      const hesaplanabilir = sonrakiDonemHesaplanabilir(kayit.periyot)
      const nihaiSonTarih = sonrakiDonemTarihi(kayit.nihaiSonTarih, kayit.periyot)
      const plananUygulamaTarihi = sonrakiDonemTarihi(kayit.plananUygulamaTarihi, kayit.periyot)
      const gecerlilikBaslangici = sonrakiDonemTarihi(kayit.gecerlilikBaslangici, kayit.periyot)
      const yil = (nihaiSonTarih ?? plananUygulamaTarihi ?? gecerlilikBaslangici)?.getUTCFullYear() ?? kayit.yil + 1

      const yeniKayit = await tx.yillikTakvimKaydi.create({
        data: {
          yil,
          anaKonu: kayit.anaKonu,
          surec: kayit.surec,
          departmentId: kayit.departmentId,
          oncelik: kayit.oncelik,
          periyot: kayit.periyot,
          kayitTuru: kayit.kayitTuru,
          durum: hesaplanabilir ? 'PLANLANDI' : 'TASLAK',
          nihaiSonTarih,
          plananUygulamaTarihi,
          gecerlilikBaslangici,
          oncekiKayitId: kayit.id,
          createdById: userId,
          katilimcilar: { create: kayit.katilimcilar.map(item => ({ userId: item.userId, rol: item.rol })) },
          bildirimKurallari: { create: kayit.bildirimKurallari.map(item => ({ tetik: item.tetik, aliciRoller: item.aliciRoller, kanal: item.kanal, aktif: item.aktif })) },
          checklist: { create: kayit.checklist.map(item => ({
            baslik: item.baslik, aciklama: item.aciklama, sira: item.sira, sorumluId: item.sorumluId,
            zorunlu: item.zorunlu, kanitGerekli: item.kanitGerekli, tamamlandi: false,
          })) },
        },
        select: { id: true, yil: true, durum: true },
      })
      await logYillikTakvimAction({ tx, kayitId: kayit.id, yapanId: userId, islemTuru: 'SONRAKI_DONEM_OLUSTURULDU', alan: 'sonraki_donem', metadata: { yeniKayitId: yeniKayit.id, kopyalananAlanlar: KOPYALANAN_ALANLAR } })
      await logYillikTakvimAction({ tx, kayitId: yeniKayit.id, yapanId: userId, islemTuru: 'SONRAKI_DONEM_OLUSTURULDU', alan: 'sonraki_donem', metadata: { oncekiKayitId: kayit.id, kopyalananAlanlar: KOPYALANAN_ALANLAR } })
      return { success: true, ...yeniKayit }
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json(result, { status: 201 })
  } catch (cause) {
    if (cause instanceof NextPeriodRuleError) return NextResponse.json({ error: cause.message }, { status: cause.status })
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === 'P2034') return NextResponse.json({ error: 'Kayıt eşzamanlı değişti; sayfayı yenileyin' }, { status: 409 })
    console.error('[POST sonraki-donem]', cause)
    return NextResponse.json({ error: 'Sonraki dönem oluşturulamadı' }, { status: 500 })
  }
}
