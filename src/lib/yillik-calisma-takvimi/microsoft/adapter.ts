import 'server-only'

export type MicrosoftMailboxIdentity = { kind: 'azureAdId' | 'email'; value: string }
export interface MicrosoftEventDateTime { dateTime: string; timeZone: 'Europe/Istanbul' }
export interface MicrosoftCalendarPayload {
  subject: string
  body: { contentType: 'text'; content: string }
  start: MicrosoftEventDateTime
  end: MicrosoftEventDateTime
  isAllDay: boolean
  location?: { displayName: string }
  attendees?: { emailAddress: { address: string }; type: 'required' }[]
  isOnlineMeeting?: true
  onlineMeetingProvider?: 'teamsForBusiness'
  transactionId?: string
}
export interface MicrosoftRemoteEvent { id: string; onlineMeetingUrl: string | null }

/** DB ve HTTP'den bağımsız Graph sınırı; gerçek tenant implementasyonu migration sonrasına aittir. */
export interface MicrosoftCalendarAdapter {
  createEvent(mailbox: MicrosoftMailboxIdentity, payload: MicrosoftCalendarPayload): Promise<MicrosoftRemoteEvent>
  updateEvent(mailbox: MicrosoftMailboxIdentity, remoteEventId: string, payload: MicrosoftCalendarPayload): Promise<MicrosoftRemoteEvent>
  getEvent(mailbox: MicrosoftMailboxIdentity, remoteEventId: string): Promise<MicrosoftRemoteEvent | null>
  cancelEvent(mailbox: MicrosoftMailboxIdentity, remoteEventId: string): Promise<void>
}
