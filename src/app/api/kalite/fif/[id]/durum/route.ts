import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageFif, isFifKss } from '@/lib/quality/fif-access'
import { fifZinciriCoz } from '@/lib/quality/fif-zincir'
import { gecisYapabilirMi, type FifGecisCtx, type FifGecisState } from '@/lib/quality/fif-durum'
import { fifDurumBildir } from '@/lib/quality/fif-bildirim'
import { generateNextFifNo, fifNoYili } from '@/lib/quality/fif-no'
import { ayEkle, istanbulBugunTarihi, FIF_ETKINLIK_AY } from '@/lib/quality/fif-termin'
import { FifDurum, FifSonuc, FifGecmisOlay } from '@/generated/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const girdi = z.object({
  hedef: z.nativeEnum(FifDurum),
  aciklama: z.string().trim().optional(),
  /** Paket 4: yalnız "Sorumlu Bölüm Onayı"nda (SORUMLU_ATAMA_BEKLIYOR → FAALIYET) — zorunlu orada. */
  izlemeSorumlusuUserId: z.string().trim().min(1).optional(),
})

/** Red geçişleri: redNedeni (aciklama) zorunlu. */
const RED_GECISLERI: Array<[FifDurum, FifDurum]> = [
  [FifDurum.ONAY_BEKLIYOR, FifDurum.TASLAK],
  [FifDurum.KSS_KAYIT_BEKLIYOR, FifDurum.TASLAK],
  [FifDurum.KAPATMA_BEKLIYOR, FifDurum.FAALIYET],
  [FifDurum.KSS_KAPANIS_BEKLIYOR, FifDurum.FAALIYET],
]

/**
 * POST /api/kalite/fif/[id]/durum — TEK durum geçiş ucu. fif-durum.ts'ten geçer.
 * Transaction: durum + FifGecmis; bildirim commit sonrası (in-app + push I/O tx dışında).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  const { id } = await params

  const body = await request.json().catch(() => null)
  const parsed = girdi.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  const { hedef, aciklama, izlemeSorumlusuUserId } = parsed.data

  const fif = await prisma.fif.findUnique({
    where: { id },
    include: {
      faaliyetler: {
        select: {
          id: true, hedefTarih: true, etkinlikPlanTarihi: true, etkinlikUygun: true, sorumluUserId: true,
          // "Kapatmaya Gönder" şartı (satirKapatildiMi)
          sonuc: true, gerceklesenTarih: true, parafUserId: true,
        },
      },
      etkinlikler: { select: { madde: true, uygun: true } },
    },
  })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })

  // Sorumlu bölüm müdürünün User id'si (ctx için).
  let sorumluBolumMudurUserId: string | null = null
  if (fif.sorumluBolumId) {
    const dept = await prisma.departmentDefinition.findUnique({ where: { id: fif.sorumluBolumId }, select: { mudurId: true } })
    if (dept?.mudurId) {
      const u = await prisma.user.findFirst({ where: { personnelId: dept.mudurId, isActive: true }, select: { id: true } })
      sorumluBolumMudurUserId = u?.id ?? null
    }
  }

  const ctx: FifGecisCtx = {
    userId,
    isManage: canManageFif(session),
    sorumluBolumMudurUserId,
    isKss: await isFifKss(session),
  }
  // Paket 4 — "Sorumlu Bölüm Onayı": müdür faaliyet izleme sorumlusunu geçişle
  // birlikte seçer. Seçilen kişi AKTİF kullanıcı olmalı; ön koşul seçimle değerlendirilir.
  const bolumOnayi = fif.durum === FifDurum.SORUMLU_ATAMA_BEKLIYOR && hedef === FifDurum.FAALIYET
  let yeniIzleme: string | null = null
  let izlemeAd: string | null = null
  if (bolumOnayi && izlemeSorumlusuUserId) {
    const u = await prisma.user.findFirst({
      where: { id: izlemeSorumlusuUserId, isActive: true },
      select: { id: true, name: true, email: true, personnel: { select: { adSoyad: true } } },
    })
    if (!u) return NextResponse.json({ error: 'Seçilen izleme sorumlusu aktif bir kullanıcı değil' }, { status: 400 })
    yeniIzleme = u.id
    izlemeAd = u.name || u.personnel?.adSoyad || u.email || u.id
  }

  const state: FifGecisState = {
    durum: fif.durum, createdById: fif.createdById, hazirlayanUserId: fif.hazirlayanUserId,
    yayinlayanOnaylayanUserId: fif.yayinlayanOnaylayanUserId, sorumluOnaylayanUserId: fif.sorumluOnaylayanUserId,
    izlemeSorumlusuUserId: bolumOnayi ? yeniIzleme : fif.izlemeSorumlusuUserId,
    sorumluBolumId: fif.sorumluBolumId, yayinlayanBolumId: fif.yayinlayanBolumId,
    uygunsuzlukTanimi: fif.uygunsuzlukTanimi, tur: fif.tur,
    yayilimVarMi: fif.yayilimVarMi, yayilimAciklama: fif.yayilimAciklama,
    faaliyetler: fif.faaliyetler, etkinlikler: fif.etkinlikler,
  }

  // Yetki eksikse 403; ön koşul (ör. "Tüm faaliyetler kapatılmalı", zorunlu alan)
  // ya da geçersiz geçiş 400.
  const karar = gecisYapabilirMi(ctx, state, hedef)
  if (!karar.ok) return NextResponse.json({ error: karar.sebep }, { status: karar.tur === 'yetki' ? 403 : 400 })

  // ZİNCİR SNAPSHOT'I: "Onaya Gönder" (TASLAK → KSS_KAYIT_BEKLIYOR) anında
  // onaylayanlar omurgadan çözülür ve kayda yazılır. FAIL-CLOSED — KSS koltukları
  // boşsa ya da bölüm müdürü çözülemezse form ilerlemez. Paket 2: KSS artık
  // snapshot'lanmaz; kssUserId işlemi yapan KSS ile yazılır (aşağıda).
  let zincirYazimi: { sorumluOnaylayanUserId?: string; yayinlayanOnaylayanUserId?: string } | null = null
  if (fif.durum === FifDurum.TASLAK && hedef === FifDurum.KSS_KAYIT_BEKLIYOR) {
    const z = await fifZinciriCoz(prisma, { sorumluBolumId: fif.sorumluBolumId, yayinlayanBolumId: fif.yayinlayanBolumId })
    if (!z.ok) return NextResponse.json({ error: z.sebep }, { status: 400 })
    zincirYazimi = {
      // Dolu onaylayan KORUNUR (PUT bölüm değişince yeniden çözer); boşsa omurgadan doldurulur.
      ...(fif.sorumluOnaylayanUserId ? {} : z.sorumluOnaylayan ? { sorumluOnaylayanUserId: z.sorumluOnaylayan.userId } : {}),
      ...(fif.yayinlayanOnaylayanUserId ? {} : z.yayinlayanOnaylayan ? { yayinlayanOnaylayanUserId: z.yayinlayanOnaylayan.userId } : {}),
    }
  }

  // KSS adımını yapan kişi kayda yazılır (KSS kayıt/kapanış/etkinlik adımları).
  // manage ile yapılan etkinlik kararı KSS sayılmaz → kssUserId'ye dokunulmaz.
  const kssAdimi =
    ctx.isKss &&
    (fif.durum === FifDurum.KSS_KAYIT_BEKLIYOR || fif.durum === FifDurum.KSS_KAPANIS_BEKLIYOR || fif.durum === FifDurum.ETKINLIK)

  const isRed = RED_GECISLERI.some(([f, t]) => f === fif.durum && t === hedef)
  const isReopen = fif.durum === FifDurum.ETKINLIK && hedef === FifDurum.FAALIYET
  const isIptal = hedef === FifDurum.IPTAL
  if (isRed && (!aciklama || !aciklama.trim())) {
    return NextResponse.json({ error: 'Red gerekçesi (açıklama) zorunlu' }, { status: 400 })
  }

  // Paket 4: Kayda Al sorumlu bölüm müdürüne yönlendirir (SORUMLU_ATAMA_BEKLIYOR);
  // numara yine bu anda verilir.
  const kaydaAl = fif.durum === FifDurum.KSS_KAYIT_BEKLIYOR && hedef === FifDurum.SORUMLU_ATAMA_BEKLIYOR

  const kayitNo = await prisma.$transaction(async (tx) => {
    // NUMARA ONAYDA (Paket 3): KSS "Kayda Al" anında, geçişle AYNI transaction'da
    // advisory lock altında üretilir. Numarası olan (eski akış) kayıt aynen kalır.
    const simdi = new Date()
    const yeniNo = kaydaAl && !fif.kayitNo ? await generateNextFifNo(fifNoYili(simdi), tx) : null
    await tx.fif.update({
      where: { id },
      data: {
        durum: hedef,
        ...(hedef === FifDurum.KAPATMA_BEKLIYOR ? { kapatmaTarihi: simdi } : {}),
        // KSS kaydı aldı (adım 3): kayıt anı damgalanır (+ numara).
        ...(kaydaAl ? { kayitTarihi: simdi } : {}),
        ...(yeniNo ? { kayitNo: yeniNo } : {}),
        ...(kssAdimi && userId ? { kssUserId: userId } : {}),
        ...(zincirYazimi ?? {}),
        ...(isRed ? { redNedeni: aciklama } : {}),
        ...(bolumOnayi && yeniIzleme ? { izlemeSorumlusuUserId: yeniIzleme } : {}),

      },
    })
    // 3 AYLIK ETKİNLİK (Kalite kararı): süre İLK KAPANIŞ ONAYINDA başlar. KSS kapanış
    // kontrolü onaylanınca (KSS_KAPANIS_BEKLIYOR → ETKINLIK) etkin bulunmamış HER
    // satıra plan = geçiş günü (İstanbul) + 3 ay (ay sonu kırpılır). Daha önce etkin
    // bulunmuş satıra DOKUNULMAZ. Hatırlatma işareti sıfırlanır → plan − 7 günde yeni
    // hatırlatma gider. (Eski FİF geneli FifEtkinlik maddeleri artık açılmaz: bu
    // geçişten sonra tüm satırlar plan taşır → yeni akış.)
    if (fif.durum === FifDurum.KSS_KAPANIS_BEKLIYOR && hedef === FifDurum.ETKINLIK) {
      const plan = ayEkle(istanbulBugunTarihi(simdi), FIF_ETKINLIK_AY)
      await tx.fifFaaliyet.updateMany({
        where: { fifId: id, OR: [{ etkinlikUygun: null }, { etkinlikUygun: false }] },
        data: { etkinlikPlanTarihi: plan, etkinlikHatirlatmaTarihi: null },
      })
    }

    // Yeniden açılış: faaliyet satırları sonuc=YT (yapılamadı/termin) işaretlenir.
    if (isReopen) {
      await tx.fifFaaliyet.updateMany({ where: { fifId: id }, data: { sonuc: FifSonuc.YT } })
    }
    await tx.fifGecmis.create({
      data: {
        fifId: id, eskiDurum: fif.durum, yeniDurum: hedef, userId, olay: FifGecmisOlay.DURUM_DEGISTI,
        aciklama: aciklama ??
          (yeniNo ? `Kayıt numarası verildi: ${yeniNo}` : bolumOnayi ? `Sorumlu bölüm onayı — faaliyet izleme sorumlusu: ${izlemeAd}` : null),
      },
    })
    return yeniNo ?? fif.kayitNo
  })

  // Bildirim — commit sonrası, best-effort (in-app + push I/O tx dışında).
  // Başlık yeni numarayla kurulsun ("Kayda Al"da verildiyse "Taslak" yazmasın).
  let bildirim = null
  try {
    bildirim = await fifDurumBildir(
      { ...fif, kayitNo, ...(bolumOnayi ? { izlemeSorumlusuUserId: yeniIzleme } : {}), faaliyetSorumluIdleri: fif.faaliyetler.map((f) => f.sorumluUserId).filter((x): x is string => !!x) },
      hedef, { red: isRed, iptal: isIptal },
    )
  } catch (e) {
    console.error('[fif-durum] bildirim:', e)
  }

  return NextResponse.json({ ok: true, durum: hedef, kayitNo, bildirim })
}
