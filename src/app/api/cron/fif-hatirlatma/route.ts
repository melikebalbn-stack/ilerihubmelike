import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sentetikMailMi } from '@/lib/bluecollar-email'
import { FifDurum } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://hub.ilerigroup.com'

/**
 * POST/GET /api/cron/fif-hatirlatma — FAALIYET durumundaki FİF'lerde faaliyet
 * hedef tarihi 3 gün kala VE geçince izleme sorumlusuna GÜNLÜK 1 hatırlatma.
 * Auth: x-cron-secret (deneme check-evaluations deseni). Aynı gün tekrarlamama:
 * o kullanıcıya, o FİF için bugün oluşturulmuş "Hedef tarih hatırlatma" in-app
 * bildirimi varsa atlanır (ayrı dedup tablosu gerektirmez).
 */
async function calis(): Promise<{ taranan: number; hatirlatilan: number; atlanan: number; mailUlasmayan: string[] }> {
  const simdi = new Date()
  const gunBasi = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate())
  const esik = new Date(gunBasi.getTime() + 3 * 86400000) // bugün + 3 gün

  const fifler = await prisma.fif.findMany({
    where: {
      durum: FifDurum.FAALIYET,
      izlemeSorumlusuUserId: { not: null },
      faaliyetler: { some: { hedefTarih: { not: null, lte: esik } } },
    },
    select: {
      id: true, kayitNo: true, izlemeSorumlusuUserId: true,
      faaliyetler: { where: { hedefTarih: { not: null, lte: esik } }, select: { hedefTarih: true } },
    },
  })

  let hatirlatilan = 0, atlanan = 0
  const mailUlasmayan: string[] = []

  for (const fif of fifler) {
    const u = await prisma.user.findFirst({
      where: { id: fif.izlemeSorumlusuUserId!, isActive: true },
      select: { id: true, email: true, name: true, personnel: { select: { adSoyad: true } } },
    })
    if (!u?.email) { atlanan++; continue }

    const link = `/kalite/fif/${fif.id}`
    const konu = `[FİF ${fif.kayitNo}] Hedef tarih hatırlatma`

    // Aynı gün tekrarlamama: bugün bu kullanıcıya bu FİF için hatırlatma var mı.
    const bugunVar = await prisma.notification.findFirst({
      where: { userId: u.id, link, title: konu, createdAt: { gte: gunBasi } },
      select: { id: true },
    })
    if (bugunVar) { atlanan++; continue }

    const gecmis = fif.faaliyetler.some((f) => f.hedefTarih && new Date(f.hedefTarih) < gunBasi)
    const govde = gecmis
      ? 'FİF faaliyetlerinden en az birinin hedef tarihi GEÇTİ. Lütfen durumu güncelleyin.'
      : 'FİF faaliyetlerinden en az birinin hedef tarihine 3 gün veya daha az kaldı.'

    const html = `<p>${govde}</p><p><a href="${BASE_URL}${link}">FİF'i aç</a></p>`
    const sentetik = sentetikMailMi(u.email)
    try {
      await prisma.notification.create({ data: { userId: u.id, title: konu, message: govde, type: 'REMINDER', link } })
    } catch (e) { console.error('[fif-hatirlatma] in-app:', e) }
    if (sentetik) {
      mailUlasmayan.push(u.email)
      console.warn('[fif-hatirlatma] sentetik adres — mail atlandi:', u.email)
    } else {
      const r = await sendEmail([{ name: u.name || u.email, email: u.email }], konu, govde, html)
      if (!r.success) console.error('[fif-hatirlatma] mail:', r.error)
    }
    hatirlatilan++
  }

  return { taranan: fifler.length, hatirlatilan, atlanan, mailUlasmayan }
}

async function checkCron(request: NextRequest): Promise<boolean> {
  const s = request.headers.get('x-cron-secret')
  return !!s && s === process.env.CRON_SECRET
}

export async function POST(request: NextRequest) {
  if (!(await checkCron(request))) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const sonuc = await calis()
  return NextResponse.json({ ok: true, ...sonuc, checkedAt: new Date().toISOString() })
}
export async function GET(request: NextRequest) {
  return POST(request)
}
