/**
 * Planlı Görev — sorumluya ATAMA bildirimi.
 *
 * İki kanal, MEVCUT altyapı (yeni altyapı kurulmadı):
 *   in-app : prisma.notification.createMany  — ticket-notifications.ts:145 ile aynı desen
 *   e-posta: sendEmail (@/lib/email)         — SMTP/nodemailer tek kaynak
 *
 * E-POSTASIZ SORUMLU: Personnel kaynağında 185 aktif personelin 97'sinin
 * kurumsal e-postası yok. Onlara e-posta SESSİZCE atlanır (hata üretilmez);
 * in-app bildirim de ancak User kaydı varsa yazılabilir — Notification.userId
 * User'a FK. Sicilden User bulunamazsa o kişi hiçbir kanal alamaz; bu bir
 * hata değil, verinin durumu.
 *
 * YALNIZ YENİ EKLENENLER: çağıran, önceki ve sonraki sorumlu listesini verir;
 * fark burada hesaplanır. Güncellemede mevcut sorumlular tekrar bildirim ALMAZ.
 *
 * Hiçbir hata dışarı sızmaz — bildirim ikincildir, görev kaydını düşürmez.
 */

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

export interface GorevSorumlusu {
  name: string
  email: string | null
  sicilNo?: string | null
}

export interface GorevOzeti {
  id: string
  title: string
  dueDate: Date | string
}

/** İki sorumlu aynı kişi mi — sicil öncelikli (e-posta null olabilir). */
function ayniKisi(a: GorevSorumlusu, b: GorevSorumlusu): boolean {
  if (a.sicilNo && b.sicilNo) return a.sicilNo === b.sicilNo
  if (a.email && b.email) return a.email.toLowerCase() === b.email.toLowerCase()
  return a.name.trim().toLocaleLowerCase('tr') === b.name.trim().toLocaleLowerCase('tr')
}

/** `oncekiler`de olmayan sorumlular. */
export function yeniEklenenler(
  oncekiler: GorevSorumlusu[],
  sonrakiler: GorevSorumlusu[],
): GorevSorumlusu[] {
  return sonrakiler.filter((s) => !oncekiler.some((o) => ayniKisi(o, s)))
}

/** `responsiblePersons` Text alanını güvenli çözer (bozuksa boş liste). */
export function sorumlulariCoz(raw: string | null | undefined): GorevSorumlusu[] {
  if (!raw) return []
  try {
    const p: unknown = JSON.parse(raw)
    if (!Array.isArray(p)) return []
    return p
      .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
      .map((x) => ({
        name: typeof x.name === 'string' ? x.name : '',
        email: typeof x.email === 'string' && x.email.trim() ? x.email.trim() : null,
        sicilNo: typeof x.sicilNo === 'string' && x.sicilNo.trim() ? x.sicilNo.trim() : null,
      }))
      .filter((x) => x.name || x.email || x.sicilNo)
  } catch {
    return []
  }
}

function tarihTR(d: Date | string): string {
  const t = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(t.getTime())
    ? '-'
    : t.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Yeni atanan sorumlulara bildirim gönderir. HATA FIRLATMAZ.
 * @returns kaç kişiye in-app / e-posta gittiği (teşhis için)
 */
export async function atamaBildirimiGonder(
  gorev: GorevOzeti,
  yeniSorumlular: GorevSorumlusu[],
): Promise<{ inApp: number; eposta: number; epostasiz: number }> {
  const sonuc = { inApp: 0, eposta: 0, epostasiz: 0 }
  if (yeniSorumlular.length === 0) return sonuc

  const link = `/tasks?task=${gorev.id}`
  const baslik = 'Size planlı görev atandı'
  const metin = `Size planlı görev atandı: ${gorev.title} (son tarih: ${tarihTR(gorev.dueDate)})`

  try {
    // ── User eşleştirme: in-app bildirim User.id ister ────────────────────
    const epostalar = yeniSorumlular
      .map((s) => s.email?.toLowerCase())
      .filter((e): e is string => !!e)
    const siciller = yeniSorumlular
      .map((s) => s.sicilNo)
      .filter((s): s is string => !!s)

    const kullanicilar =
      epostalar.length || siciller.length
        ? await prisma.user.findMany({
            where: {
              isActive: true,
              OR: [
                ...(epostalar.length ? [{ email: { in: epostalar } }] : []),
                ...(siciller.length ? [{ employeeId: { in: siciller } }] : []),
              ],
            },
            select: { id: true, email: true, employeeId: true },
          })
        : []

    const userIdler = new Set<string>()
    for (const s of yeniSorumlular) {
      const u = kullanicilar.find(
        (k) =>
          (s.sicilNo && k.employeeId === s.sicilNo) ||
          (s.email && k.email.toLowerCase() === s.email.toLowerCase()),
      )
      if (u) userIdler.add(u.id)
      if (!s.email) sonuc.epostasiz += 1
    }

    if (userIdler.size > 0) {
      await prisma.notification.createMany({
        data: [...userIdler].map((userId) => ({
          userId,
          title: baslik,
          message: metin,
          type: 'INFO' as const,
          link,
        })),
      })
      sonuc.inApp = userIdler.size
    }
  } catch (err) {
    console.error('[gorev-atama] in-app bildirim yazılamadı:', err)
  }

  try {
    // ── E-posta: yalnız adresi OLANLARA. Yoksa sessizce atlanır. ──────────
    const alicilar = yeniSorumlular
      .filter((s) => !!s.email)
      .map((s) => ({ name: s.name || s.email!, email: s.email! }))
    if (alicilar.length > 0) {
      const konu = `Planlı görev atandı: ${gorev.title}`
      const govde = `${metin}\n\nGörevi görüntülemek için ILERIHub → Planlı Görevler ekranını açın.`
      await sendEmail(alicilar, konu, govde)
      sonuc.eposta = alicilar.length
    }
  } catch (err) {
    console.error('[gorev-atama] e-posta gönderilemedi:', err)
  }

  return sonuc
}
