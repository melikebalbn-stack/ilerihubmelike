import { describe, it, expect, vi, beforeEach } from 'vitest'

const deptFindMany = vi.fn()
const userFindMany = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    departmentDefinition: { findMany: (...a: unknown[]) => deptFindMany(...a) },
    user: { findMany: (...a: unknown[]) => userFindMany(...a) },
  },
}))

const sendEmailMock = vi.fn()
vi.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => sendEmailMock(...a) }))

import {
  buildPersonelByDept,
  resolveDeptResponsibleRecipients,
  notifyDeptResponsiblesOnApproval,
} from './overtime-dept-responsible-notify'
import { approvedDeptResponsibleSubject } from './email-templates/overtime-approved-dept-responsible'

beforeEach(() => {
  deptFindMany.mockReset()
  userFindMany.mockReset()
  sendEmailMock.mockReset()
})

describe('buildPersonelByDept', () => {
  it('personelleri workDepartment’a göre gruplar', () => {
    const map = buildPersonelByDept({
      id: 'f1',
      formNo: 'OT-1',
      date: new Date('2026-07-08'),
      formTipi: 'MESAI',
      vardiyaHaftaMi: false,
      personnel: [
        { workDepartment: 'A', personnel: { adSoyad: 'P1' } },
        { workDepartment: 'A', personnel: { adSoyad: 'P2' } },
        { workDepartment: 'B', personnel: { adSoyad: 'P3' } },
        { workDepartment: '', personnel: { adSoyad: 'Yok' } }, // boş dept → atlanır
      ],
    })
    expect(map.get('A')).toEqual(['P1', 'P2'])
    expect(map.get('B')).toEqual(['P3'])
    expect(map.has('')).toBe(false)
  })
})

describe('approvedDeptResponsibleSubject', () => {
  it('MESAI vs VARDIYA konu kelimesi', () => {
    expect(approvedDeptResponsibleSubject('OT-2026-5', false)).toBe('Onaylanan mesai formu: OT-2026-5')
    expect(approvedDeptResponsibleSubject('VRD-2026-3', true)).toBe('Onaylanan vardiya formu: VRD-2026-3')
  })
})

describe('resolveDeptResponsibleRecipients', () => {
  it('boş harita → boş sonuç, DB’ye gitmez', async () => {
    const res = await resolveDeptResponsibleRecipients(new Map())
    expect(res.recipients).toHaveLength(0)
    expect(res.unresolved).toHaveLength(0)
    expect(deptFindMany).not.toHaveBeenCalled()
  })

  it('kişi bazında tekilleştirir + resolve edilemeyeni ayırır', async () => {
    deptFindMany.mockResolvedValue([
      { name: 'A', mudurId: 'r1', mudurYardimcisiId: null, sorumlu1Id: 'r2', sorumlu2Id: null, sorumlu3Id: null },
      { name: 'B', mudurId: 'r1', mudurYardimcisiId: null, sorumlu1Id: null, sorumlu2Id: null, sorumlu3Id: null },
    ])
    userFindMany.mockResolvedValue([{ id: 'u1', email: 'u1@x.com', name: 'U1', personnelId: 'r1' }])

    const { recipients, unresolved } = await resolveDeptResponsibleRecipients(
      new Map([['A', ['P1', 'P2']], ['B', ['P3']]])
    )
    expect(recipients).toHaveLength(1)
    expect(recipients[0].userId).toBe('u1')
    expect(recipients[0].departments).toEqual([
      { name: 'A', personel: ['P1', 'P2'] },
      { name: 'B', personel: ['P3'] },
    ])
    expect(unresolved).toEqual([{ dept: 'A', personnelId: 'r2' }])
  })

  it('email null olan sorumlu → unresolved’a düşer', async () => {
    deptFindMany.mockResolvedValue([
      { name: 'A', mudurId: 'r1', mudurYardimcisiId: null, sorumlu1Id: null, sorumlu2Id: null, sorumlu3Id: null },
    ])
    userFindMany.mockResolvedValue([{ id: 'u1', email: null, name: 'U1', personnelId: 'r1' }])
    const { recipients, unresolved } = await resolveDeptResponsibleRecipients(new Map([['A', ['P1']]]))
    expect(recipients).toHaveLength(0)
    expect(unresolved).toEqual([{ dept: 'A', personnelId: 'r1' }])
  })
})

describe('notifyDeptResponsiblesOnApproval — MESAI/VARDIYA', () => {
  const dept = [{ name: 'İDARİ İŞLER', mudurId: 'r1', mudurYardimcisiId: null, sorumlu1Id: null, sorumlu2Id: null, sorumlu3Id: null }]
  const users = [{ id: 'u1', email: 'sorumlu@x.com', name: 'Sorumlu', personnelId: 'r1' }]

  it('MESAI → konu "Onaylanan mesai formu", tarih label "Mesai tarihi"', async () => {
    deptFindMany.mockResolvedValue(dept)
    userFindMany.mockResolvedValue(users)
    sendEmailMock.mockResolvedValue({ success: true })
    await notifyDeptResponsiblesOnApproval({
      id: 'f1', formNo: 'OT-2026-9', date: new Date('2026-07-08'), formTipi: 'MESAI', vardiyaHaftaMi: false,
      personnel: [{ workDepartment: 'İDARİ İŞLER', personnel: { adSoyad: 'Ali' } }],
    })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const [to, subject, text, html] = sendEmailMock.mock.calls[0]
    expect(to).toEqual([{ email: 'sorumlu@x.com', name: 'Sorumlu' }])
    expect(subject).toBe('Onaylanan mesai formu: OT-2026-9')
    expect(text).toContain('Mesai tarihi:')
    expect(html).toContain('İDARİ İŞLER')
  })

  it('VARDIYA hafta modu → konu "Onaylanan vardiya formu", hafta metni içerir', async () => {
    deptFindMany.mockResolvedValue(dept)
    userFindMany.mockResolvedValue(users)
    sendEmailMock.mockResolvedValue({ success: true })
    await notifyDeptResponsiblesOnApproval({
      id: 'f2', formNo: 'VRD-2026-3', date: new Date('2026-07-14'), formTipi: 'VARDIYA', vardiyaHaftaMi: true,
      personnel: [{ workDepartment: 'İDARİ İŞLER', personnel: { adSoyad: 'Ayşe' } }],
    })
    const [, subject, text] = sendEmailMock.mock.calls[0]
    expect(subject).toBe('Onaylanan vardiya formu: VRD-2026-3')
    expect(text).toContain('Vardiya haftası:')
    expect(text).toMatch(/Hafta/) // formatVardiyaHafta çıktısı "NN. Hafta (...)"
  })
})
