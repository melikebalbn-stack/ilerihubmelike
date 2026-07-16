import { describe, it, expect } from 'vitest'
import {
  approvalPendingSubject,
  buildApprovalPendingMailText,
  buildApprovalPendingMailHtml,
  pickApprovalNotifyRecipient,
  type ApprovalPendingMailInput,
} from './overtime-approval-pending'

const base: ApprovalPendingMailInput = {
  formNo: 'OT-2026-026',
  olusturan: 'Erol Sahin',
  tarihStr: '06 Temmuz 2026',
  personelSayisi: 3,
  link: 'https://hub.ilerigroup.com/forms/overtime/abc123',
  isVardiya: false,
  role: 'Genel Müdür Yardımcısı',
}

describe('approvalPendingSubject', () => {
  it('MESAI → "mesai formu"', () => {
    expect(approvalPendingSubject('OT-2026-026', false)).toBe('Onayınızı bekleyen mesai formu: OT-2026-026')
  })
  it('VARDIYA → "vardiya formu"', () => {
    expect(approvalPendingSubject('VRD-2026-005', true)).toBe('Onayınızı bekleyen vardiya formu: VRD-2026-005')
  })
})

describe('buildApprovalPendingMailText', () => {
  it('formNo/oluşturan/tarih/personel sayısı/link/rol içerir', () => {
    const t = buildApprovalPendingMailText(base)
    expect(t).toContain('OT-2026-026')
    expect(t).toContain('Erol Sahin')
    expect(t).toContain('06 Temmuz 2026')
    expect(t).toContain('Personel sayısı: 3')
    expect(t).toContain('https://hub.ilerigroup.com/forms/overtime/abc123')
    expect(t).toContain('Onay adımı: Genel Müdür Yardımcısı')
    expect(t).toContain('mesai formu')
  })
  it('rol yoksa "Onay adımı" satırı yok; VARDIYA metni', () => {
    const t = buildApprovalPendingMailText({ ...base, role: undefined, isVardiya: true })
    expect(t).not.toContain('Onay adımı')
    expect(t).toContain('vardiya formu')
  })
})

describe('buildApprovalPendingMailHtml', () => {
  it('navy #1B4F72, formNo, link, buton içerir', () => {
    const h = buildApprovalPendingMailHtml(base)
    expect(h).toContain('#1B4F72')
    expect(h).toContain('OT-2026-026')
    expect(h).toContain('href="https://hub.ilerigroup.com/forms/overtime/abc123"')
    expect(h).toContain('Formu Görüntüle')
    expect(h).toContain('Personel sayısı')
  })
  it('HTML özel karakterleri escape edilir (XSS)', () => {
    const h = buildApprovalPendingMailHtml({ ...base, olusturan: '<script>alert(1)</script>' })
    expect(h).not.toContain('<script>alert(1)</script>')
    expect(h).toContain('&lt;script&gt;')
  })
})

describe('pickApprovalNotifyRecipient', () => {
  it('email + name → {email, name}', () => {
    expect(pickApprovalNotifyRecipient({ email: 'g@x.com', name: 'Gürhan' })).toEqual({ email: 'g@x.com', name: 'Gürhan' })
  })
  it('name yok → email fallback', () => {
    expect(pickApprovalNotifyRecipient({ email: 'g@x.com', name: null })).toEqual({ email: 'g@x.com', name: 'g@x.com' })
  })
  it('email yok / null / undefined / whitespace → null (gönderme yok)', () => {
    expect(pickApprovalNotifyRecipient({ email: null, name: 'X' })).toBeNull()
    expect(pickApprovalNotifyRecipient({ email: '   ', name: 'X' })).toBeNull()
    expect(pickApprovalNotifyRecipient(null)).toBeNull()
    expect(pickApprovalNotifyRecipient(undefined)).toBeNull()
  })
})
