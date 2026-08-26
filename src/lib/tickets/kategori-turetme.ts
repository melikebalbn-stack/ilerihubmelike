/**
 * Kategoriden türetilen değerler — TEK KAYNAK.
 *
 * POST /api/tickets (doğuşta) ve PUT /api/tickets/[id] (yeniden sınıflandırmada)
 * aynı kuralları kullanır. Kural iki yerde ayrı yazılırsa zamanla ayrışır; bu
 * dosya onu engellemek için var.
 *
 * SLA dakikalarının seçimi (kategori mi öncelik tabanı mı) BURADA DEĞİL —
 * o @/lib/sla'daki cozumSlaDakika'nın işi ve ona dokunulmuyor.
 */

import type { TicketPriority } from '@/generated/prisma'

/** Kategoriden okunan alan kümesi. Prisma select'i ile birebir. */
export const KATEGORI_TURETME_SELECT = {
  defaultPriority: true,
  defaultTeamId: true,
  defaultAssigneeEmail: true,
  slaResponseMinutes: true,
  slaResolutionMinutes: true,
} as const

export interface KategoriVarsayilanlari {
  defaultPriority: TicketPriority
  defaultTeamId: string | null
  defaultAssigneeEmail: string | null
  slaResponseMinutes: number | null
  slaResolutionMinutes: number | null
}

/**
 * İstemci bu alanı AÇIKÇA gönderdi mi?
 *
 * `undefined` (gövdede yok) ve `null` (açıkça boşaltıldı) "göndermedi" sayılır.
 * Bu ayrım kritik: eskiden POST'ta `priority = 'NORMAL'` destructure varsayılanı
 * vardı ve "istemci göndermedi" ile "istemci NORMAL gönderdi" durumlarını
 * birbirinden ayırt edilemez kılıyordu — kategori varsayılanı bu yüzden hiç
 * devreye giremiyordu.
 */
export function istemciGonderdiMi(deger: unknown): boolean {
  return deger !== undefined && deger !== null
}

/**
 * Etkin öncelik zinciri:
 *   1. istemci açıkça gönderdiyse  → o
 *   2. kategori verildiyse         → kategori.defaultPriority
 *   3.                             → gerileme (POST'ta 'NORMAL', PUT'ta mevcut öncelik)
 *
 * Çağıran, kategori varsayılanının devreye girmesini İSTEMİYORSA (örn. PUT'ta
 * kategori değişmediyse) `kategori` yerine null geçer.
 *
 * Değer doğrulaması KASITLI olarak yok: geçersiz bir öncelik Prisma'da patlar,
 * eskiden de öyleydi (gövdeden gelen değer doğrudan create/update'e gidiyordu).
 * Burada sessizce düzeltmek hatalı girdiyi gizlerdi — bu yüzden istemci değeri
 * yalnızca TİP sınırında cast ediliyor, doğrulama Prisma'da kalıyor.
 */
export function etkinOncelik(
  istemciPriority: unknown,
  kategori: Pick<KategoriVarsayilanlari, 'defaultPriority'> | null | undefined,
  gerileme: TicketPriority,
): TicketPriority {
  if (istemciGonderdiMi(istemciPriority)) return istemciPriority as TicketPriority
  if (kategori) return kategori.defaultPriority
  return gerileme
}

export interface KategoriAtamasi {
  assignedTeamId: string | null
  assignedTo: string | null
}

/**
 * HAVUZ MODELİ — ÖNCELİK: takım > kişi.
 *
 * Kategori bir TAKIMA bağlıysa ticket takıma düşer ve assignedTo BOŞ kalır:
 * kimseye özel atanmamıştır, üyelerden biri üstlenene kadar havuzda bekler.
 * Takım yoksa defaultAssigneeEmail varsa kişiye atanır. İkisi de yoksa atamasız.
 */
export function kategoriAtamasi(
  kategori: Pick<KategoriVarsayilanlari, 'defaultTeamId' | 'defaultAssigneeEmail'> | null | undefined,
): KategoriAtamasi {
  if (kategori?.defaultTeamId) {
    return { assignedTeamId: kategori.defaultTeamId, assignedTo: null }
  }
  if (kategori?.defaultAssigneeEmail) {
    return { assignedTeamId: null, assignedTo: kategori.defaultAssigneeEmail }
  }
  return { assignedTeamId: null, assignedTo: null }
}
