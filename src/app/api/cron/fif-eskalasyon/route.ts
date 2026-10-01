import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FifDurum } from '@/generated/prisma'
import { getSlaAyar, getTatilMap } from '@/lib/sla'
import { ustYonetimKoltugu, koltukKoduIle, GM_KODU } from '@/lib/org/ust-yonetim'
import { fifKullaniciyaBildir } from '@/lib/quality/fif-bildirim'
import { kssKoltukKullanicilari } from '@/lib/quality/fif-zincir'
import { fifEtiket } from '@/lib/quality/fif-durum-etiket'
import { TAKIPTEKI_FAALIYET_WHERE } from '@/lib/quality/fif-termin'
import {
  isGunuSayisi,
  eskalasyonSeviyesi,
  eskalasyonKonusu,
  eskalasyonGovdesi,
  type FifEskalasyonSeviyesi,
} from '@/lib/quality/fif-eskalasyon'

export const dynamic = 'force-dynamic'

/**
 * POST/GET /api/cron/fif-eskalasyon — FAALIYET aşamasında hedef tarihi geçmiş
 * FİF'leri 5/10/15 İŞ GÜNÜ eşiklerine göre kademeli eskale eder.
 *
 *   Seviye 1 → sorumlu bölüm müdürü + KSS koltuklarındaki HERKES
 *   Seviye 2 → bölümün org ağacındaki ilk GMY/GM koltuğu (ustYonetimKoltugu)
 *   Seviye 3 → Genel Müdür
 *
 * KANAL: in-app + push + mail (fif-bildirim.fifKullaniciyaBildir; sentetik adreste mail atlanır).
 * İş günü SLA çalışma takviminden (tatil/yarım gün/cumartesi) gelir — yeni
 * takvim kodu YOK. SEVİYE BAŞINA TEK bildirim: dedup anahtarı in-app başlığı
 * ("… Eskalasyon N …"), tarih penceresi YOK (hatırlatmadaki günlük dedup'tan
 * bilinçli farklı — eskalasyon her gün tekrar etmez).
 *
 * FAIL-OPEN: hedef koltuk çözülemezse (parent'ı olmayan BÜRO MEMURU/DEPO gibi
 * bölümler, boş koltuk) GM + super-admin bilgilendirilir; kimse haber almadan
 * kalmaz. Auth: x-cron-secret. ?dryRun=1 → yalnız plan, bildirim göndermez.
 */
type Alici = { userId: string; ad: string }
type Plan = { kayitNo: string; gecikme: number; seviye: FifEskalasyonSeviyesi; hedefler: string[] }

/** Aktif kullanıcı → alıcı (e-posta şartı YOK — mail kanalı fif-bildirim'de ayrıca bakar). */
async function userAlici(userId: string | null | undefined): Promise<Alici | null> {
  if (!userId) return null
  const u = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, email: true, name: true, personnel: { select: { adSoyad: true } } },
  })
  if (!u) return null
  return { userId: u.id, ad: u.name || u.personnel?.adSoyad || u.email || u.id }
}

/** Bölüm müdürü (yoksa müdür yardımcısı) — seviye 1 hedefi. */
async function bolumMuduru(bolumId: string | null): Promise<Alici | null> {
  if (!bolumId) return null
  const dept = await prisma.departmentDefinition.findUnique({
    where: { id: bolumId },
    select: { mudurId: true, mudurYardimcisiId: true },
  })
  for (const pid of [dept?.mudurId, dept?.mudurYardimcisiId]) {
    if (!pid) continue
    const u = await prisma.user.findFirst({ where: { personnelId: pid, isActive: true }, select: { id: true } })
    const a = await userAlici(u?.id)
    if (a) return a
  }
  return null
}

/** super-admin'ler — fail-open yedeği. */
async function superAdminler(): Promise<Alici[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, userRoles: { some: { role: { slug: 'super-admin' } } } },
    select: { id: true, email: true, name: true, personnel: { select: { adSoyad: true } } },
  })
  return users.map((u) => ({ userId: u.id, ad: u.name || u.personnel?.adSoyad || u.email || u.id }))
}

async function calis(dryRun: boolean) {
  const simdi = new Date()
  const ayar = await getSlaAyar()
  const tatilMap = await getTatilMap([simdi.getUTCFullYear() - 1, simdi.getUTCFullYear()])

  const fifler = await prisma.fif.findMany({
    // Yalnız TAKİPTEKİ satırlar: açık + bekleyen ek termin talebi YOK (talep KSS'deyken
    // eskalasyon durur). Ek termin onayı hedefTarih'i güncellediği için gecikme yeni
    // hedefe göre hesaplanır; başlıktaki hedef tarih sayesinde seviyeler baştan başlar.
    where: { durum: FifDurum.FAALIYET, faaliyetler: { some: { hedefTarih: { not: null, lt: simdi }, ...TAKIPTEKI_FAALIYET_WHERE } } },
    select: {
      id: true, kayitNo: true, sorumluBolumId: true,
      faaliyetler: {
        where: { hedefTarih: { not: null }, ...TAKIPTEKI_FAALIYET_WHERE },
        select: { hedefTarih: true }, orderBy: { hedefTarih: 'asc' },
      },
    },
  })

  const plan: Plan[] = []
  let bildirilen = 0
  let atlanan = 0
  let pushGiden = 0
  let mailGiden = 0
  let mailAtlanan = 0

  for (const fif of fifler) {
    // En ESKİ geçmiş hedef tarih gecikmeyi belirler (en kötü durum).
    const gecmisTarihler = fif.faaliyetler
      .map((f) => f.hedefTarih)
      .filter((t): t is Date => !!t && t.getTime() < simdi.getTime())
    if (gecmisTarihler.length === 0) continue
    const enEski = gecmisTarihler[0]

    const gecikme = isGunuSayisi(enEski, simdi, tatilMap, ayar)
    const seviye = eskalasyonSeviyesi(gecikme)
    if (!seviye) continue

    const link = `/kalite/fif/${fif.id}`
    const etiket = fifEtiket(fif)
    const tarihMetni = enEski.toISOString().slice(0, 10)
    const konu = eskalasyonKonusu(etiket, seviye, tarihMetni)

    // SEVİYE BAŞINA TEK bildirim — tarih penceresi yok.
    const zatenVar = await prisma.notification.findFirst({ where: { link, title: konu }, select: { id: true } })
    if (zatenVar) { atlanan++; continue }

    const hedefler: Alici[] = []
    if (seviye === 1) {
      const mudur = await bolumMuduru(fif.sorumluBolumId)
      if (mudur) hedefler.push(mudur)
      for (const k of await kssKoltukKullanicilari(prisma)) hedefler.push({ userId: k.userId, ad: k.ad })
    } else if (seviye === 2) {
      const ust = await ustYonetimKoltugu(prisma, fif.sorumluBolumId)
      const a = await userAlici(ust?.userId ?? null)
      if (a) hedefler.push(a)
    } else {
      const gm = await koltukKoduIle(prisma, GM_KODU)
      const a = await userAlici(gm?.userId ?? null)
      if (a) hedefler.push(a)
    }

    // FAIL-OPEN: koltuk çözülemedi → GM + super-admin.
    if (hedefler.length === 0) {
      const gm = await koltukKoduIle(prisma, GM_KODU)
      const gmAlici = await userAlici(gm?.userId ?? null)
      if (gmAlici) hedefler.push(gmAlici)
      hedefler.push(...(await superAdminler()))
      console.warn(`[fif-eskalasyon] ${etiket}: seviye ${seviye} koltugu cozulemedi → GM + super-admin`)
    }

    const tekil = new Map(hedefler.map((h) => [h.userId, h]))
    plan.push({ kayitNo: etiket, gecikme, seviye, hedefler: [...tekil.values()].map((h) => h.ad) })
    if (dryRun) continue

    const govde = eskalasyonGovdesi(seviye, gecikme, tarihMetni)
    for (const h of tekil.values()) {
      const r = await fifKullaniciyaBildir(h.userId, konu, govde, link, 'WARNING')
      pushGiden += r.push
      if (r.mail === 'gitti') mailGiden++
      else if (r.mail === 'atlandi') mailAtlanan++
    }
    bildirilen++
  }

  return { taranan: fifler.length, bildirilen, atlanan, pushGiden, mailGiden, mailAtlanan, plan, dryRun }
}

function cronYetkili(request: NextRequest): boolean {
  const s = request.headers.get('x-cron-secret')
  return !!s && s === process.env.CRON_SECRET
}

export async function POST(request: NextRequest) {
  if (!cronYetkili(request)) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const sonuc = await calis(dryRun)
  return NextResponse.json({ ok: true, ...sonuc, checkedAt: new Date().toISOString() })
}
export async function GET(request: NextRequest) {
  return POST(request)
}
