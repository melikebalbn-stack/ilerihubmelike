/**
 * Ticket erişim yetkisi — TEK KAYNAK.
 *
 * Kural PUT /api/tickets/[id] içinde doğmuştu ve yalnız orada duruyordu;
 * yorum uçları (GET/POST /api/tickets/[id]/comments) ise oturum açmış olmayı
 * yeterli sayıyordu — ticket id'sini bilen herkes başkasının talebine yorum
 * yazabiliyor, dahili olmayan yorumlarını okuyabiliyordu. Aynı mantığı iki
 * yerde tekrarlamamak için kural buraya taşındı; PUT dahil üç nokta da bu
 * dosyayı kullanır.
 *
 * Kural (davranış PUT'takiyle BİREBİR aynı, değiştirilmedi):
 *   userIsITStaff || isOwner || isAssignee || isTicketTeamMember
 *
 * E-posta karşılaştırması: `requesterEmail` ve `assignedTo` PR-EMAIL-NORMALIZE
 * sonrası DB'de lowercase, `user.email` de lowercase → doğrudan eşitlik güvenli.
 * Takım üyeliği zaten team-members.ts içinde normalize ediliyor.
 */

import { parseMembers, isTeamMember } from '@/lib/tickets/team-members'

/** Yetki için gereken ticket alanları — tam kayıt şart değil, bu kadarı yeter. */
export interface TicketYetkiGirdisi {
  requesterEmail: string
  assignedTo: string | null
  /** HAVUZ: ticket bir takıma düştüyse üyeleri de yetkilidir. */
  assignedTeam?: { members: string | null } | null
}

/**
 * Yetki sorulan kullanıcı. `isITStaff` oturumdaki `helpdesk.admin` izninden
 * gelir (DB User kaydında yok), bu yüzden çağıran taraf hesaplayıp verir.
 */
export interface TicketYetkiKullanicisi {
  email: string
  isITStaff: boolean
}

export interface TicketYetkileri {
  /** Talebi açan kişi. */
  isOwner: boolean
  /** Ticket'ın atandığı teknisyen. */
  isAssignee: boolean
  /** Ticket'ın düştüğü takımın üyesi (henüz kimse üstlenmemiş olsa bile). */
  isTicketTeamMember: boolean
  /** helpdesk.admin izni. */
  isITStaff: boolean
  /**
   * Durum değiştirebilir mi. Talep sahibi BURAYA DAHİL DEĞİL — kendi talebini
   * görebilir/yorumlayabilir ama yalnız CANCELLED yapabilir (kural PUT'ta).
   */
  canChangeStatus: boolean
  /** Ticket'ı görme/yorumlama/güncelleme kapısı. */
  canAccess: boolean
}

/** Alt bayrakların hepsi — PUT'un ihtiyacı (durum ve atama kuralları ayrışıyor). */
export function ticketYetkileri(
  ticket: TicketYetkiGirdisi,
  user: TicketYetkiKullanicisi,
): TicketYetkileri {
  const isOwner = ticket.requesterEmail === user.email
  // Atanmamış ticket'ta isAssignee false kalmalı: null === null tuzağına
  // düşmemek için önce dolu olduğu doğrulanıyor.
  const isAssignee = !!ticket.assignedTo && ticket.assignedTo === user.email
  const isTicketTeamMember = isTeamMember(
    parseMembers(ticket.assignedTeam?.members ?? null),
    user.email,
  )
  const isITStaff = user.isITStaff

  return {
    isOwner,
    isAssignee,
    isTicketTeamMember,
    isITStaff,
    canChangeStatus: isITStaff || isAssignee || isTicketTeamMember,
    canAccess: isITStaff || isOwner || isAssignee || isTicketTeamMember,
  }
}

/** Tek soru soranlar için kısayol (yorum uçları). */
export function canAccessTicket(
  ticket: TicketYetkiGirdisi,
  user: TicketYetkiKullanicisi,
): boolean {
  return ticketYetkileri(ticket, user).canAccess
}
