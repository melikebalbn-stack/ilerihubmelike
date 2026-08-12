import { createHash } from 'node:crypto'
import type { MicrosoftCalendarPayload, MicrosoftMailboxIdentity } from './adapter'

const TIME_ZONE = 'Europe/Istanbul' as const
const CONTROL = /[\u0000-\u001f\u007f]/g
export interface MicrosoftIdentityInput { azureAdId?: string | null; email?: string | null; emailVerified?: Date | null }
export type MicrosoftIdentityResult = { available: true; identity: MicrosoftMailboxIdentity } | { available: false; reason: 'MICROSOFT_IDENTITY_UNAVAILABLE' }

export function resolveMicrosoftIdentity(user: MicrosoftIdentityInput, corporateDomains: readonly string[]): MicrosoftIdentityResult {
  const azureAdId = user.azureAdId?.trim()
  if (azureAdId) return { available: true, identity: { kind: 'azureAdId', value: azureAdId } }
  const email = user.email?.trim().toLocaleLowerCase('en-US')
  const domain = email?.split('@')[1]
  if (email && user.emailVerified && domain && corporateDomains.some(item => item.toLocaleLowerCase('en-US') === domain)) {
    return { available: true, identity: { kind: 'email', value: email } }
  }
  return { available: false, reason: 'MICROSOFT_IDENTITY_UNAVAILABLE' }
}

export interface YctMicrosoftPayloadInput {
  id: string; anaKonu: string; surec: string; kisaBaslik?: string | null; kayitTuru: string
  tumGunMu: boolean; baslangicTarihi?: Date | null; bitisTarihi?: Date | null
  plananUygulamaTarihi?: Date | null; nihaiSonTarih?: Date | null; lokasyon?: string | null
  attendeeEmails?: string[]; appBaseUrl: string; transactionVersion?: string
}
function parts(date: Date, includeTime: boolean): string {
  if (Number.isNaN(date.getTime())) throw new Error('Geçersiz etkinlik tarihi')
  const options: Intl.DateTimeFormatOptions = { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', ...(includeTime && { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }) }
  const formatted = new Intl.DateTimeFormat('en-CA', options).formatToParts(date)
  const get = (type: string) => formatted.find(item => item.type === type)?.value
  return includeTime ? `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}` : `${get('year')}-${get('month')}-${get('day')}T00:00:00`
}
function addUtcDay(date: Date): Date { const next = new Date(date); next.setUTCDate(next.getUTCDate() + 1); return next }
function safeText(value: string, max: number): string { return value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max) }
function safeBaseUrl(value: string): string {
  const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Geçersiz İleriHub adresi')
  return url.origin
}
function safeAttendees(values: string[] = []) {
  return [...new Set(values.map(value => value.trim().toLocaleLowerCase('en-US')).filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))].map(address => ({ emailAddress: { address }, type: 'required' as const }))
}
export function microsoftTransactionId(recordId: string, version: string): string {
  return createHash('sha256').update(`ilerihub:yct:${recordId}:${version}`).digest('hex')
}

export function buildYctMicrosoftEvent(input: YctMicrosoftPayloadInput): MicrosoftCalendarPayload {
  const subject = safeText(input.kisaBaslik || input.surec || input.anaKonu, 180)
  if (!subject) throw new Error('Etkinlik başlığı bulunamadı')
  const fallback = input.plananUygulamaTarihi || input.nihaiSonTarih
  const start = input.baslangicTarihi || fallback
  if (!start) throw new Error('Etkinlik tarihi bulunamadı')
  let end: Date
  if (input.tumGunMu) end = addUtcDay(input.bitisTarihi || start)
  else {
    if (!input.baslangicTarihi || !input.bitisTarihi || input.bitisTarihi <= input.baslangicTarihi) throw new Error('Saatli etkinlik için geçerli başlangıç ve bitiş zorunludur')
    end = input.bitisTarihi
  }
  const attendees = safeAttendees(input.attendeeEmails)
  const teams = input.kayitTuru === 'TEAMS_TOPLANTISI'
  return {
    subject,
    body: { contentType: 'text', content: `İleriHub kaydını görüntüleyin: ${safeBaseUrl(input.appBaseUrl)}/strategic-hr/yillik-calisma-takvimi` },
    start: { dateTime: parts(start, !input.tumGunMu), timeZone: TIME_ZONE },
    end: { dateTime: parts(end, !input.tumGunMu), timeZone: TIME_ZONE },
    isAllDay: input.tumGunMu,
    ...(input.lokasyon?.trim() && { location: { displayName: safeText(input.lokasyon, 200) } }),
    ...(attendees.length && { attendees }),
    ...(teams && { isOnlineMeeting: true as const, onlineMeetingProvider: 'teamsForBusiness' as const }),
    ...(input.transactionVersion && { transactionId: microsoftTransactionId(input.id, input.transactionVersion) }),
  }
}
