// IT Ticket SLA — ihlal KARARI (saf: prisma yok, tarih dışarıdan gelir).
//
// Cron ucu (src/app/api/tickets/cron/check-sla/route.ts) yalnız veri çeker,
// karar burada verilir → DB'siz test edilebilir.
//
// Faz 1c kapsamı: yalnız TESPİT. Duraklatma (slaPausedAt/slaPausedMinutes)
// bu fazda hesaba KATILMAZ; alanlar açık ama boş.

/** Kapalı sayılan durumlar — bunlarda SLA saati işlemez. */
export const KAPALI_DURUMLAR = ['RESOLVED', 'CLOSED', 'CANCELLED'] as const

export interface IhlalGirdisi {
  status: string
  respondedAt: Date | null
  resolvedAt: Date | null
  responseDueAt: Date | null
  resolutionDueAt: Date | null
  slaResponseBreached: boolean
  slaResolutionBreached: boolean
}

export interface IhlalKarari {
  /** Yanıt bayrağı false→true geçmeli mi */
  yanitIhlali: boolean
  /** Çözüm bayrağı false→true geçmeli mi */
  cozumIhlali: boolean
  /** Neden atlandı (yalnız hiçbir ihlal yoksa dolu) — loglama/dry-run için */
  atlamaSebebi: string | null
}

/**
 * Bir ticket'ın İHLAL GEÇİŞİ yapıp yapmayacağını söyler.
 *
 * Yalnız `false → true` GEÇİŞİ bildirilir. Bayrak zaten true ise ilgili taraf
 * için `false` döner: damga görevini bayrağın kendisi görür, ayrı bir
 * "bildirim gönderildi" alanı tutulmaz — böylece cron her 15 dakikada bir
 * aynı ticket için tekrar tekrar bildirim atmaz.
 *
 * Hedefi NULL olan (motor öncesi açılmış) kayıtlar atlanır: geriye dönük
 * doldurma yapılmadığı için onlara ihlal atfetmek uydurma olurdu.
 */
export function ihlalDegerlendir(t: IhlalGirdisi, now: Date): IhlalKarari {
  if ((KAPALI_DURUMLAR as readonly string[]).includes(t.status)) {
    return { yanitIhlali: false, cozumIhlali: false, atlamaSebebi: `kapalı durum (${t.status})` }
  }

  if (t.responseDueAt === null && t.resolutionDueAt === null) {
    return { yanitIhlali: false, cozumIhlali: false, atlamaSebebi: 'SLA hedefi yok (motor öncesi kayıt)' }
  }

  const gecti = (d: Date | null): boolean => d !== null && d.getTime() < now.getTime()

  const yanitIhlali = !t.slaResponseBreached && t.respondedAt === null && gecti(t.responseDueAt)
  const cozumIhlali = !t.slaResolutionBreached && t.resolvedAt === null && gecti(t.resolutionDueAt)

  if (!yanitIhlali && !cozumIhlali) {
    return { yanitIhlali: false, cozumIhlali: false, atlamaSebebi: 'ihlal yok veya zaten işaretli' }
  }

  return { yanitIhlali, cozumIhlali, atlamaSebebi: null }
}

/** Timeline/bildirim metni için kısa etiket. */
export function ihlalEtiketi(k: IhlalKarari): string {
  if (k.yanitIhlali && k.cozumIhlali) return 'Yanıt ve çözüm SLA süresi aşıldı'
  if (k.yanitIhlali) return 'Yanıt SLA süresi aşıldı'
  return 'Çözüm SLA süresi aşıldı'
}
