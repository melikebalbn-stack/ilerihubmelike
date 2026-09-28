import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Toplantı bildirim katmanı. 28.09.2026'ya kadar modülde HİÇ bildirim yoktu
 * (Notification tablosunda /meetings bağlantılı 0 kayıt, loglarda 0 mail).
 * Bu testler dört akışın DAVRANIŞINI sabitler: kime gider, kime GİTMEZ,
 * ve gönderim patlarsa ne olur.
 *
 * Prisma bellek içi sahte DB ile taklit edilir (onay/yonetici-cozumu deseni);
 * mail ve push tamamen mock'lanır — gerçek SMTP/webpush çağrısı YOKTUR.
 */

const db = vi.hoisted(() => ({
  kullanicilar: [] as { id: string; email: string | null; name: string | null; isActive: boolean }[],
  toplantilar: [] as Record<string, unknown>[],
  katilimcilar: [] as { meetingId: string; userId: string | null }[],
  kararlar: [] as Record<string, unknown>[],
  bildirimler: [] as { userId: string; title: string; message: string; link: string; createdAt: Date }[],
  guncellenenKararlar: [] as { id: string; status: string }[],
  mailPatlasin: false,
}))

const mailler = vi.hoisted(() => [] as { to: string; konu: string }[])
const pushlar = vi.hoisted(() => [] as { userId: string }[])

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: async ({ where }: { where: { id: string; isActive?: boolean } }) => {
        const u = db.kullanicilar.find((k) => k.id === where.id && (where.isActive === undefined || k.isActive))
        return u ?? null
      },
    },
    meeting: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        db.toplantilar.find((m) => m.id === where.id) ?? null,
    },
    meetingAttendee: {
      findMany: async ({ where }: { where: { meetingId: string } }) =>
        db.katilimcilar
          .filter((k) => k.meetingId === where.meetingId)
          .map((k) => ({ userId: k.userId, user: db.kullanicilar.find((u) => u.id === k.userId) ?? null })),
    },
    meetingDecision: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        db.kararlar.find((k) => k.id === where.id) ?? null,
      findMany: async () => db.kararlar.filter((k) => k.status === 'PENDING' && k.dueDate),
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        db.guncellenenKararlar.push({ id: where.id, status: data.status })
        return { id: where.id }
      },
    },
    notification: {
      create: async ({ data }: { data: { userId: string; title: string; message: string; link: string } }) => {
        db.bildirimler.push({ ...data, createdAt: new Date() })
        return { id: 'n' + db.bildirimler.length }
      },
      findFirst: async ({ where }: { where: { userId: string; link: string; title: string; createdAt: { gte: Date } } }) =>
        db.bildirimler.find(
          (b) => b.userId === where.userId && b.link === where.link && b.title === where.title &&
            b.createdAt >= where.createdAt.gte,
        ) ?? null,
    },
    pushSubscription: { findMany: async () => [] },
  },
}))

vi.mock('@/lib/email', () => ({
  sendEmail: async (to: { email: string }[], konu: string) => {
    if (db.mailPatlasin) throw new Error('SMTP patladi')
    mailler.push({ to: to[0].email, konu })
    return { success: true, messageId: '<test>' }
  },
}))

vi.mock('@/lib/push-notifications', () => ({
  sendPushToUser: async (_p: unknown, userId: string) => { pushlar.push({ userId }) },
}))

import {
  toplantiDavetiGonder, kararBildirimiGonder, toplantiOzetiGonder, gecikmisKararlariIsle,
} from './toplanti-bildirim'

const GECEN_HAFTA = new Date(Date.now() - 7 * 86400000)

beforeEach(() => {
  db.kullanicilar = [
    { id: 'u1', email: 'ahmet.cicek@ilerigroup.com', name: 'Ahmet Cicek', isActive: true },
    { id: 'u2', email: 'elif.karadeniz@ilerigroup.com', name: 'Elif Karadeniz', isActive: true },
    { id: 'u3', email: 'ILR-00999@bluecollar.ilerigroup.com', name: 'Mavi Yaka', isActive: true },
    { id: 'u4', email: 'pasif@ilerigroup.com', name: 'Pasif Kisi', isActive: false },
  ]
  db.toplantilar = [{
    id: 'm1', meetingNumber: 'TPL-2026-0007', title: 'ÖNERİ SİSTEMİ', description: 'detay',
    scheduledDate: new Date('2026-09-25'), startTime: null, endTime: null,
    location: 'Toplantı Odası', isOnline: false, onlineLink: null,
    chairman: { name: 'Elif Karadeniz' }, organizer: { name: 'Ahmet Cicek' },
    agendaItems: [{ orderNo: 1, title: 'Süreç', plannedDuration: 30 }],
    generalNotes: 'özet', closingRemarks: null,
    decisions: [{ decisionNumber: 'K-001', title: 'Süreç adımları', dueDate: null, priority: 'HIGH', responsible: { name: 'Ahmet Cicek' }, responsibleName: null }],
  }]
  db.katilimcilar = [{ meetingId: 'm1', userId: 'u1' }, { meetingId: 'm1', userId: 'u2' }]
  db.kararlar = []
  db.bildirimler = []
  db.guncellenenKararlar = []
  db.mailPatlasin = false
  mailler.length = 0
  pushlar.length = 0
})

function karar(over: Record<string, unknown> = {}) {
  return {
    id: 'k1', decisionNumber: 'K-001', title: 'Süreç adımları', description: 'detay',
    priority: 'HIGH', dueDate: null, status: 'PENDING', responsibleId: 'u1',
    meeting: { id: 'm1', meetingNumber: 'TPL-2026-0007', title: 'ÖNERİ SİSTEMİ', scheduledDate: new Date('2026-09-25') },
    ...over,
  }
}

describe('1) toplantı daveti', () => {
  it('katılımcılara mail + in-app + push gider', async () => {
    const r = await toplantiDavetiGonder('m1')
    expect(r.bildirilen).toBe(2)
    expect(mailler.map((m) => m.to).sort()).toEqual(['ahmet.cicek@ilerigroup.com', 'elif.karadeniz@ilerigroup.com'])
    expect(db.bildirimler).toHaveLength(2)
    expect(pushlar).toHaveLength(2)
  })

  it('User hesabı olmayan (harici) katılımcı ATLANIR, sayılır', async () => {
    db.katilimcilar.push({ meetingId: 'm1', userId: null })
    const r = await toplantiDavetiGonder('m1')
    expect(r.bildirilen).toBe(2)
    expect(r.atlanan).toBe(1)
  })

  it('pasif kullanıcıya gönderilmez', async () => {
    db.katilimcilar.push({ meetingId: 'm1', userId: 'u4' })
    const r = await toplantiDavetiGonder('m1')
    expect(r.bildirilen).toBe(2)
    expect(r.atlanan).toBe(1)
  })

  it('sentetik mavi yaka adresine MAIL gitmez, in-app yine oluşur', async () => {
    db.katilimcilar.push({ meetingId: 'm1', userId: 'u3' })
    const r = await toplantiDavetiGonder('m1')
    expect(r.bildirilen).toBe(3)
    expect(mailler.map((m) => m.to)).not.toContain('ILR-00999@bluecollar.ilerigroup.com')
    expect(db.bildirimler.filter((b) => b.userId === 'u3')).toHaveLength(1)
    expect(r.mailUlasmayan).toEqual(['ILR-00999@bluecollar.ilerigroup.com'])
  })

  it('aynı kullanıcı iki kez eklenmişse tek bildirim', async () => {
    db.katilimcilar.push({ meetingId: 'm1', userId: 'u1' })
    const r = await toplantiDavetiGonder('m1')
    expect(r.bildirilen).toBe(2)
  })

  it('mail patlasa da in-app oluşur ve alıcı bildirilmiş sayılır', async () => {
    db.mailPatlasin = true
    const r = await toplantiDavetiGonder('m1')
    expect(r.bildirilen).toBe(2)
    expect(db.bildirimler).toHaveLength(2)
  })
})

describe('2) karar bildirimi', () => {
  it('sorumluya gider', async () => {
    db.kararlar = [karar()]
    const r = await kararBildirimiGonder('k1')
    expect(r.bildirilen).toBe(1)
    expect(mailler[0].to).toBe('ahmet.cicek@ilerigroup.com')
    expect(mailler[0].konu).toContain('Size bir karar atandı')
  })

  it('SORUMLU YOKSA bildirim gitmez', async () => {
    db.kararlar = [karar({ responsibleId: null })]
    const r = await kararBildirimiGonder('k1')
    expect(r.bildirilen).toBe(0)
    expect(mailler).toHaveLength(0)
    expect(db.bildirimler).toHaveLength(0)
  })

  it('güncellemede konu farklı', async () => {
    db.kararlar = [karar()]
    await kararBildirimiGonder('k1', { guncelleme: true })
    expect(mailler[0].konu).toContain('güncellendi')
  })

  it('katılımcılara GİTMEZ — yalnız sorumlu', async () => {
    db.kararlar = [karar()]
    await kararBildirimiGonder('k1')
    expect(db.bildirimler.map((b) => b.userId)).toEqual(['u1'])
  })
})

describe('3) tutanak / özet', () => {
  it('tamamlanınca katılımcılara kararlarla birlikte gider', async () => {
    const r = await toplantiOzetiGonder('m1')
    expect(r.bildirilen).toBe(2)
    expect(mailler[0].konu).toContain('Toplantı Tamamlandı')
  })
})

describe('4) gecikme hatırlatması', () => {
  it('süresi geçmiş PENDING karar OVERDUE yapılır ve sorumluya hatırlatılır', async () => {
    db.kararlar = [karar({ dueDate: GECEN_HAFTA })]
    const r = await gecikmisKararlariIsle()
    expect(r.taranan).toBe(1)
    expect(r.overdueYapilan).toBe(1)
    expect(r.hatirlatilan).toBe(1)
    expect(db.guncellenenKararlar).toEqual([{ id: 'k1', status: 'OVERDUE' }])
    expect(mailler[0].konu).toContain('Karar süresi geçti')
  })

  it('sorumlusuz karar da OVERDUE olur ama bildirim çıkmaz', async () => {
    db.kararlar = [karar({ dueDate: GECEN_HAFTA, responsibleId: null })]
    const r = await gecikmisKararlariIsle()
    expect(r.overdueYapilan).toBe(1)
    expect(r.hatirlatilan).toBe(0)
    expect(mailler).toHaveLength(0)
  })

  it('aynı gün ikinci koşuda hatırlatma TEKRARLANMAZ', async () => {
    db.kararlar = [karar({ dueDate: GECEN_HAFTA })]
    await gecikmisKararlariIsle()
    mailler.length = 0
    const r2 = await gecikmisKararlariIsle()
    expect(r2.atlanan).toBe(1)
    expect(r2.hatirlatilan).toBe(0)
    expect(mailler).toHaveLength(0)
  })

  it('kuru koşu hiçbir şey YAZMAZ', async () => {
    db.kararlar = [karar({ dueDate: GECEN_HAFTA })]
    const r = await gecikmisKararlariIsle({ kuru: true })
    expect(r.taranan).toBe(1)
    expect(r.overdueYapilan).toBe(1)
    expect(db.guncellenenKararlar).toHaveLength(0)
    expect(db.bildirimler).toHaveLength(0)
    expect(mailler).toHaveLength(0)
  })
})
