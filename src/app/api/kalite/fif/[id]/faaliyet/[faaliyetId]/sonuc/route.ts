import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { fifKapsamindaMi, isFifKss } from '@/lib/quality/fif-access'
import { faaliyetKapaliMi, istanbulBugunTarihi, ACIK_FAALIYET_WHERE } from '@/lib/quality/fif-termin'
import { fifKullaniciyaBildir, fifBildirimKonusu } from '@/lib/quality/fif-bildirim'
import { FifDurum, FifSonuc, FifGecmisOlay, FifEkTerminDurum } from '@/generated/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const girdi = z.discriminatedUnion('sonuc', [
  z.object({ sonuc: z.literal(FifSonuc.K), aciklama: z.string().trim().optional() }),
  z.object({ sonuc: z.literal(FifSonuc.YT), aciklama: z.string().trim().min(1, 'Yapılamadı (YT) için açıklama zorunlu') }),
])

/** Transaction içinden 4xx döndürmek için (eşzamanlı sonuç girişi yarışında rollback). */
class SonucHatasi extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const gun = (d: Date) => d.toISOString().slice(0, 10)

/**
 * POST /api/kalite/fif/[id]/faaliyet/[faaliyetId]/sonuc — KSS "Sonuç Gir" (Paket 4).
 * Eski "Faaliyeti Kapat" (satır sorumlusu) ucunun yerini aldı: satır sorumlusu
 * artık kapatamaz, faaliyet sonucunu KSS girer.
 *
 * Yetki: YALNIZ KSS koltuğu (isFifKss). manage KSS yerine GEÇMEZ (FAZ B kararı).
 * Şartlar: FİF FAALIYET'te, satır açık (K ile kapanmamış), hedef tarih dolu.
 *  · K (Tamamlandı): satır KAPANIR — gerceklesenTarih = bugün (İstanbul günü),
 *    paraf = KSS + şimdi, sonuc = K; satırın BEKLEYEN ek termin talebi IPTAL
 *    (kararNotu "Faaliyet kapatıldı", EK_TERMIN_IPTAL kaydı). Etkinlik planı
 *    YAZILMAZ (3 ay ilk kapanış onayında başlar — durum ucu).
 *  · YT (Yapılamadı): satır AÇIK kalır, sonuc = YT; açıklama zorunlu. Bekleyen
 *    ek termin talebine dokunulmaz (sorumlu yeni termin isteyebilir).
 * İkisi de tek transaction'da koşullu güncelleme + Fif.updatedAt + FifGecmis
 * (faaliyetId ile). Bildirim commit sonrası satır sorumlusuna.
 * FİF DURUMU DEĞİŞMEZ: kapanış "Kapatmaya Gönder" zinciriyle ilerler.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; faaliyetId: string }> }) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  const { id, faaliyetId } = await params

  const fif = await prisma.fif.findUnique({
    where: { id },
    select: {
      id: true, kayitNo: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true,
    },
  })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, fif))) return NextResponse.json({ error: 'Bu FİF kapsamınızda değil' }, { status: 403 })
  if (!(await isFifKss(session))) {
    return NextResponse.json({ error: 'Faaliyet sonucunu yalnız Kalite Sistem Sorumlusu girebilir' }, { status: 403 })
  }
  if (fif.durum !== FifDurum.FAALIYET) {
    return NextResponse.json({ error: 'Faaliyet sonucu yalnız FİF faaliyet aşamasındayken girilebilir' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const parsed = girdi.safeParse(body)
  if (!parsed.success) {
    const ilk = parsed.error.issues[0]?.message
    return NextResponse.json({ error: ilk ?? 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  }
  const { sonuc } = parsed.data
  const aciklama = parsed.data.aciklama?.trim() || null

  const satir = await prisma.fifFaaliyet.findFirst({
    where: { id: faaliyetId, fifId: id },
    select: { id: true, sira: true, aciklama: true, hedefTarih: true, sorumluUserId: true, sonuc: true, gerceklesenTarih: true },
  })
  if (!satir) return NextResponse.json({ error: 'Faaliyet bulunamadı' }, { status: 404 })
  if (faaliyetKapaliMi(satir)) return NextResponse.json({ error: 'Faaliyet zaten kapatılmış' }, { status: 409 })
  if (!satir.hedefTarih) return NextResponse.json({ error: 'Hedef tarihi olmayan faaliyete sonuç girilemez' }, { status: 400 })

  const simdi = new Date()
  const gerceklesen = istanbulBugunTarihi(simdi)

  try {
    await prisma.$transaction(async (tx) => {
      // Koşullu güncelleme: iki KSS'den/sekmeden eşzamanlı girişte ikinci istek 409 alır.
      const r = await tx.fifFaaliyet.updateMany({
        where: { id: satir.id, fifId: id, ...ACIK_FAALIYET_WHERE },
        data: sonuc === FifSonuc.K
          ? { gerceklesenTarih: gerceklesen, parafUserId: userId, parafTarihi: simdi, sonuc: FifSonuc.K }
          : { sonuc: FifSonuc.YT },
      })
      if (r.count === 0) throw new SonucHatasi('Faaliyet zaten kapatılmış', 409)
      await tx.fif.update({ where: { id }, data: { updatedAt: simdi } })

      if (sonuc === FifSonuc.YT) {
        await tx.fifGecmis.create({
          data: {
            fifId: id, eskiDurum: FifDurum.FAALIYET, yeniDurum: FifDurum.FAALIYET, userId,
            faaliyetId: satir.id, olay: FifGecmisOlay.FAALIYET_YAPILAMADI,
            aciklama: `Sonuç YT (yapılamadı) — faaliyet #${satir.sira} açık kaldı: ${aciklama}`,
          },
        })
        return
      }

      await tx.fifGecmis.create({
        data: {
          fifId: id, eskiDurum: FifDurum.FAALIYET, yeniDurum: FifDurum.FAALIYET, userId,
          faaliyetId: satir.id, olay: FifGecmisOlay.FAALIYET_KAPATILDI,
          aciklama: `Sonuç K (tamamlandı) — faaliyet #${satir.sira} kapatıldı (gerçekleşen: ${gun(gerceklesen)})${aciklama ? `: ${aciklama}` : ''}`,
        },
      })

      // Bekleyen ek termin talebi anlamını yitirdi → IPTAL (aynı transaction),
      // günlükte EK_TERMIN_IPTAL olayıyla ayrı satır.
      const bekleyenler = await tx.fifEkTermin.findMany({
        where: { faaliyetId: satir.id, durum: FifEkTerminDurum.BEKLIYOR },
        select: { id: true, istenenHedefTarih: true },
      })
      if (bekleyenler.length) {
        await tx.fifEkTermin.updateMany({
          where: { id: { in: bekleyenler.map((t) => t.id) }, durum: FifEkTerminDurum.BEKLIYOR },
          data: { durum: FifEkTerminDurum.IPTAL, kararNotu: 'Faaliyet kapatıldı', kararUserId: userId, kararTarihi: simdi },
        })
        for (const t of bekleyenler) {
          await tx.fifGecmis.create({
            data: {
              fifId: id, eskiDurum: FifDurum.FAALIYET, yeniDurum: FifDurum.FAALIYET, userId,
              faaliyetId: satir.id, olay: FifGecmisOlay.EK_TERMIN_IPTAL,
              aciklama: `Bekleyen ek termin talebi iptal edildi (istenen ${gun(t.istenenHedefTarih)}): Faaliyet kapatıldı`,
            },
          })
        }
      }
    })
  } catch (e) {
    if (e instanceof SonucHatasi) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  // Bildirim — commit sonrası, best-effort: satır sorumlusuna (in-app + push + mail).
  if (satir.sorumluUserId) {
    try {
      const ozet = satir.aciklama.length > 100 ? `${satir.aciklama.slice(0, 99)}…` : satir.aciklama
      const konu = fifBildirimKonusu(fif, sonuc === FifSonuc.K ? 'Faaliyetiniz kapatıldı' : 'Faaliyetiniz yapılamadı (YT)')
      const govde = sonuc === FifSonuc.K
        ? `KSS faaliyet #${satir.sira} için sonucu "Tamamlandı (K)" olarak girdi; satır kapatıldı: ${ozet}`
        : `KSS faaliyet #${satir.sira} için sonucu "Yapılamadı (YT)" olarak girdi; satır açık kaldı: ${ozet}\nAçıklama: ${aciklama}`
      await fifKullaniciyaBildir(satir.sorumluUserId, konu, govde, `/kalite/fif/${id}`)
    } catch (e) {
      console.error('[fif-faaliyet-sonuc] bildirim:', e)
    }
  }
  return NextResponse.json({ ok: true, sonuc, gerceklesenTarih: sonuc === FifSonuc.K ? gerceklesen : null })
}
