/**
 * IT Ticket — e-posta kanalı iş mantığı (Faz 2).
 *
 * Gelen bir maili ya mevcut ticket'a yorum olarak iliştirir, ya yeni ticket
 * açar, ya da yoksayar. Her mail için EmailIngestLog'a TEK satır düşer —
 * yoksayılanlar ve hatalar dahil; "mail geldi ama ticket açılmadı" görülebilir
 * olsun diye.
 *
 * TEKİLLEŞTİRME internetMessageId üzerinden: Graph'ın mesaj id'si /move sonrası
 * DEĞİŞİR, internetMessageId değişmez. EmailIngestLog.messageId @unique olduğu
 * için son savunma hattı da DB'de.
 *
 * DÖNGÜ KORUMASI: izlenen kutunun KENDİSİNDEN gelen mail yoksayılır
 * (yoksayilmaliMi, `from` üzerinden). Kutu adresi burada hardcode DEĞİL —
 * çağıran (cron ucu) veriyor.
 *
 * BİLDİRİM: yeni ticket açıldığında dispatchTicketCreated çağrılır (IT ekibi =
 * Sistem Geliştirme departmanı; e-posta + uygulama içi + push). YORUM ekleme
 * dalında çağrılmaz — bu fazda yalnız yeni ticket.
 */

import { prisma } from '@/lib/prisma'
import { cozumSlaDakika, hesaplaSlaHedefleri } from '@/lib/sla'
import { ticketNumarasiUret } from '@/lib/tickets/ticket-numarasi'
import { dispatchTicketCreated } from '@/lib/ticket-notifications'
import type { GraphMesaj } from '@/lib/graph/mail'
import {
  aciklamaCoz,
  gondericiAdi,
  gondericiCoz,
  govdeCoz,
  konuCoz,
  yanitMi,
  yoksayilmaliMi,
} from '@/lib/tickets/mail-ayristir'

export type IsleSonucTipi =
  | 'zaten_islenmis'
  | 'ticket_olusturuldu'
  | 'yorum_eklendi'
  | 'yoksayildi'
  | 'hata'

export interface IsleSonucu {
  messageId: string | null
  /** Graph mesaj id'si — taşıma için gerekli. */
  graphId: string
  gonderici: string
  konu: string
  sonuc: IsleSonucTipi
  sebep: string | null
  ticketId: string | null
  ticketNumber: string | null
  /** Taşınmaya aday mı (dryRun'da taşıma yapılmaz). */
  tasinabilir: boolean
}

/** Gönderenin sistemdeki adı; yoksa mailin adı; o da yoksa adresin kendisi. */
async function talepSahibiAdi(gonderici: string, mailAdi: string | null): Promise<string> {
  if (gonderici) {
    const user = await prisma.user.findUnique({
      where: { email: gonderici },
      select: { firstName: true, lastName: true, name: true },
    })
    if (user) {
      const tam = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      if (tam) return tam
      if (user.name?.trim()) return user.name.trim()
    }
  }
  return mailAdi || gonderici || 'Bilinmeyen gönderen'
}

/**
 * Thread eşleştirme, bu sırayla:
 *   1. Ticket.emailConversationId == conversationId  (Graph'ın kendi thread'i)
 *   2. In-Reply-To / References id'leri ile TicketComment.emailMessageId
 *      veya Ticket.emailMessageId eşleşmesi  (standart RFC zinciri)
 *
 * conversationId önce: Outlook içi yanıtlarda en güvenilir bağ. Referans
 * başlıkları ise kutu dışına çıkıp geri dönen zincirlerde işe yarıyor.
 */
async function ticketBul(m: GraphMesaj): Promise<{ id: string; ticketNumber: string } | null> {
  if (m.conversationId) {
    const bulunan = await prisma.ticket.findFirst({
      where: { emailConversationId: m.conversationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, ticketNumber: true },
    })
    if (bulunan) return bulunan
  }

  const referanslar = yanitMi(m)
  if (referanslar.length === 0) return null

  const yorum = await prisma.ticketComment.findFirst({
    where: { emailMessageId: { in: referanslar } },
    select: { ticket: { select: { id: true, ticketNumber: true } } },
  })
  if (yorum?.ticket) return yorum.ticket

  return prisma.ticket.findFirst({
    where: { emailMessageId: { in: referanslar } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, ticketNumber: true },
  })
}

/**
 * Tek bir maili işler. dryRun=true iken HİÇBİR yazma yapmaz, ne yapacağını
 * döndürür.
 *
 * Hata fırlatmaz: beklenmedik bir şey olursa 'hata' sonucu döner ve (dryRun
 * değilse) EmailIngestLog'a HATA satırı yazar. Tek bozuk mail turu düşürmemeli.
 */
export async function tekMesajIsle(
  m: GraphMesaj,
  dryRun: boolean,
  /** İzlenen posta kutusu — döngü koruması bunu gerektiriyor (çağıran verir). */
  izlenenKutu: string,
): Promise<IsleSonucu> {
  const messageId = m.internetMessageId?.trim() || null
  const gonderici = gondericiCoz(m)
  const konu = konuCoz(m)

  const taban: IsleSonucu = {
    messageId,
    graphId: m.id,
    gonderici,
    konu,
    sonuc: 'hata',
    sebep: null,
    ticketId: null,
    ticketNumber: null,
    tasinabilir: false,
  }

  try {
    // internetMessageId olmayan mail tekilleştirilemez — işlersek her turda
    // yeniden ticket açar. Yoksayılır ama LOGLANAMAZ da (log anahtarı o alan),
    // bu yüzden yalnız sonuçta görünür.
    if (!messageId) {
      return { ...taban, sonuc: 'yoksayildi', sebep: 'internetMessageId yok — tekilleştirilemez', tasinabilir: false }
    }

    // (a) TEKİLLEŞTİRME — zaten kayıtlıysa hiç dokunma, log bile yazma.
    const kayitli = await prisma.emailIngestLog.findUnique({
      where: { messageId },
      select: { id: true, ticketId: true },
    })
    if (kayitli) {
      // Taşınabilir: önceki turda taşıma başarısız olmuş olabilir, tekrar denenir.
      return { ...taban, sonuc: 'zaten_islenmis', sebep: 'EmailIngestLog kaydı var', ticketId: kayitli.ticketId, tasinabilir: true }
    }

    const ortakLog = {
      messageId,
      conversationId: m.conversationId ?? null,
      fromAddress: gonderici || '(bilinmiyor)',
      toAddress: m.toRecipients?.[0]?.emailAddress?.address ?? null,
      subject: m.subject ?? null,
      receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime) : null,
    }

    // (b) YOKSAYMA — otomatik yanıt, bounce, boş mail.
    const karar = yoksayilmaliMi(m, izlenenKutu)
    if (karar.yoksay) {
      if (!dryRun) {
        await prisma.emailIngestLog.create({
          data: { ...ortakLog, sonuc: 'YOKSAYILDI', hataMesaji: karar.sebep },
        })
      }
      return { ...taban, sonuc: 'yoksayildi', sebep: karar.sebep, tasinabilir: true }
    }

    // (c) THREAD EŞLEŞTİRME → yorum
    const mevcut = await ticketBul(m)
    if (mevcut) {
      if (!dryRun) {
        await prisma.$transaction([
          prisma.ticketComment.create({
            data: {
              ticketId: mevcut.id,
              authorEmail: gonderici || '(bilinmiyor)',
              authorName: await talepSahibiAdi(gonderici, gondericiAdi(m)),
              content: aciklamaCoz(m),
              isInternal: false,
              emailMessageId: messageId,
            },
          }),
          prisma.emailIngestLog.create({
            data: { ...ortakLog, sonuc: 'YORUM_EKLENDI', ticketId: mevcut.id },
          }),
        ])
      }
      // KAPALI ticket'a yanıt: yorum YİNE eklenir, ticket DURUMU DEĞİŞTİRİLMEZ.
      // Otomatik yeniden açma ayrı iş — sessizce durum değiştirmek, kapattığını
      // sanan IT ekibinin gözünden kaçar.
      return {
        ...taban,
        sonuc: 'yorum_eklendi',
        sebep: null,
        ticketId: mevcut.id,
        ticketNumber: mevcut.ticketNumber,
        tasinabilir: true,
      }
    }

    // (d) YENİ TICKET — kategorisiz, atamasız, IT triyaj edecek.
    // Sistemde kayıtlı OLMAYAN gönderen reddedilmez; ticket yine açılır.
    const simdi = new Date()
    // Kategori yok → SLA öncelik tabanından türer. POST /api/tickets ile AYNI
    // zincir; sla/* dosyalarına dokunulmadı.
    const slaDk = cozumSlaDakika(null, 'NORMAL')
    const slaHedef = await hesaplaSlaHedefleri(simdi, slaDk.responseMin, slaDk.resolutionMin)
    const talepAdi = await talepSahibiAdi(gonderici, gondericiAdi(m))

    if (dryRun) {
      return { ...taban, sonuc: 'ticket_olusturuldu', sebep: 'dryRun — yazılmadı', tasinabilir: false }
    }

    const ticketNumber = await ticketNumarasiUret(prisma)
    const olusan = await prisma.$transaction(async (tx) => {
      const t = await tx.ticket.create({
        data: {
          ticketNumber,
          subject: konu,
          description: aciklamaCoz(m),
          ticketType: 'INCIDENT',
          categoryId: null,
          priority: 'NORMAL',
          status: 'NEW',
          requesterEmail: gonderici || '(bilinmiyor)',
          requesterName: talepAdi,
          emailFrom: gonderici || null,
          emailConversationId: m.conversationId ?? null,
          emailMessageId: messageId,
          slaResponseDue: slaHedef.responseDueAt,
          slaResolutionDue: slaHedef.resolutionDueAt,
          responseDueAt: slaHedef.responseDueAt,
          resolutionDueAt: slaHedef.resolutionDueAt,
          source: 'EMAIL',
        },
        // Bildirim gövdesi için gereken alanlar da seçiliyor (ikinci sorgu yok).
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          description: true,
          priority: true,
          requesterName: true,
          requesterDept: true,
          createdAt: true,
        },
      })
      await tx.ticketTimeline.create({
        data: {
          ticketId: t.id,
          action: 'created',
          description: 'Ticket e-posta ile oluşturuldu',
          performedBy: gonderici || '(bilinmiyor)',
          performedByName: talepAdi,
        },
      })
      await tx.emailIngestLog.create({
        data: { ...ortakLog, sonuc: 'TICKET_OLUSTURULDU', ticketId: t.id },
      })
      return t
    })

    // ── BİLDİRİM ────────────────────────────────────────────────────────
    // POST /api/tickets ile AYNI fonksiyon ve AYNI gövde. Tek fark: orada
    // `void ...catch()` ile fire-and-forget, çünkü kullanıcıya yanıt
    // geciktirilmiyor. Burada AWAIT ediliyor — cron'un dönüş süresi kimseyi
    // bekletmiyor ve fire-and-forget'te istek bitince gönderim yarıda kalabilir.
    //
    // Hata ticket'ı BAŞARISIZ SAYMAZ: mail zaten işlendi, EmailIngestLog
    // TICKET_OLUSTURULDU kalır, bildirim ikincildir. Bu yüzden dıştaki
    // try/catch'e DÜŞMEDEN burada yutuluyor.
    try {
      await dispatchTicketCreated({
        id: olusan.id,
        ticketNumber: olusan.ticketNumber,
        subject: olusan.subject,
        description: olusan.description,
        priority: olusan.priority,
        category: '(Kategorisiz)', // mail kanalı kategorisiz açıyor — IT triyaj edecek
        requesterName: olusan.requesterName,
        requesterDept: olusan.requesterDept ?? '',
        createdAt: olusan.createdAt,
      })
    } catch (err) {
      console.error('[ticket-mail] bildirim gönderilemedi:', olusan.ticketNumber, err)
    }

    return {
      ...taban,
      sonuc: 'ticket_olusturuldu',
      sebep: null,
      ticketId: olusan.id,
      ticketNumber: olusan.ticketNumber,
      tasinabilir: true,
    }
  } catch (err) {
    // (e) HATA — logla, sonucu döndür, DİĞER MESAJLARA DEVAM EDİLSİN.
    const mesaj = err instanceof Error ? err.message : String(err)
    console.error('[ticket-mail]', messageId ?? m.id, mesaj)
    if (!dryRun && messageId) {
      // Log yazımı da patlarsa (ör. DB kopuk) yutulur: asıl hata zaten
      // sonuçta taşınıyor, ikinci hata onu gölgelememeli.
      await prisma.emailIngestLog
        .create({
          data: {
            messageId,
            conversationId: m.conversationId ?? null,
            fromAddress: gonderici || '(bilinmiyor)',
            toAddress: m.toRecipients?.[0]?.emailAddress?.address ?? null,
            subject: m.subject ?? null,
            receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime) : null,
            sonuc: 'HATA',
            hataMesaji: mesaj.slice(0, 2000),
          },
        })
        .catch((e) => console.error('[ticket-mail] log yazılamadı:', e))
    }
    return { ...taban, sonuc: 'hata', sebep: mesaj, tasinabilir: false }
  }
}

/** Gövde metnini kısa özet olarak döndürür (rapor satırı için). */
export function kisaOzet(m: GraphMesaj, uzunluk = 80): string {
  const g = govdeCoz(m).replace(/\s+/g, ' ').trim()
  return g.length > uzunluk ? `${g.slice(0, uzunluk)}…` : g
}
