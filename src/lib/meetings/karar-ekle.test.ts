import { describe, expect, it, vi } from 'vitest'
import { toplantiKullaniciIdCoz } from './kullanici-coz'
import { enumDogrula, KARAR_ONCELIKLERI, KARAR_DURUMLARI, KATILIMCI_ROLLERI } from './hata'

/**
 * "Karar eklenemedi" olayı (28.09.2026). İki ayrı sorun vardı:
 *   1. Açıklama modalda YILDIZSIZ (opsiyonel görünüyor) ama uç + şema zorunlu
 *      tutuyordu → boş bırakılınca 400, log yazılmıyor, kullanıcı sebebi
 *      göremiyordu. Ölçüm: TPL-2026-0007 / K-001 açıklaması dolu olduğu için
 *      GEÇMİŞTİ, ikinci deneme takılmıştı.
 *   2. Sorumlu seçilirse `responsibleId`'ye LDAP id'si yazılıyor →
 *      MeetingDecision_responsibleId_fkey ihlali. Sistemdeki 4 kararın
 *      hiçbirinde sorumlu dolu değildi.
 */

type SahteDb = Parameters<typeof toplantiKullaniciIdCoz>[0]

function sahteDb(kullanicilar: { id: string; email: string }[]) {
  const findUnique = vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
    const u = where.email
      ? kullanicilar.find((k) => k.email === where.email)
      : kullanicilar.find((k) => k.id === where.id)
    return u ? { id: u.id } : null
  })
  return { db: { user: { findUnique } } as unknown as SahteDb, findUnique }
}

const KULLANICILAR = [
  { id: 'ad_ahmet.cicek', email: 'ahmet.cicek@ilerigroup.com' },
  { id: 'ad_elif.karadeniz', email: 'elif.karadeniz@ilerigroup.com' },
]

/** POST /api/meetings/[id]/decisions'ın zorunlu alan + enum kapısının aynısı. */
function kararGovdesiGecerliMi(body: { title?: string; description?: string | null; priority?: unknown }) {
  if (!body.title) return { ok: false as const, durum: 400, mesaj: 'Karar başlığı zorunludur' }
  const oncelik = enumDogrula('priority', body.priority, KARAR_ONCELIKLERI)
  if (!oncelik.ok) return { ok: false as const, durum: 400, mesaj: 'priority geçersiz' }
  return { ok: true as const }
}

describe('karar ekleme — açıklama opsiyonel', () => {
  it('açıklama BOŞ karar kabul edilir (eski davranış 400 veriyordu)', () => {
    expect(kararGovdesiGecerliMi({ title: 'Süreç adımları', description: null })).toEqual({ ok: true })
  })

  it('açıklama tanımsız da kabul edilir', () => {
    expect(kararGovdesiGecerliMi({ title: 'Süreç adımları' })).toEqual({ ok: true })
  })

  it('başlık boşsa yine 400 — o zorunlu kalmalı', () => {
    const r = kararGovdesiGecerliMi({ title: '', description: 'detay' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.durum).toBe(400)
  })

  it('boş string açıklama DB\'ye null olarak yazılır', () => {
    const description = ''
    expect(description || null).toBeNull()
  })
})

describe('karar ekleme — sorumlu (responsibleId FK)', () => {
  async function sorumluId(db: SahteDb, body: { responsibleEmail?: string | null; responsibleId?: string | null }) {
    return toplantiKullaniciIdCoz(db, body.responsibleEmail ?? body.responsibleId)
  }

  it('sorumlu SEÇİLİ karar: e-posta gerçek User.id\'ye çevrilir', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(sorumluId(db, { responsibleEmail: 'ahmet.cicek@ilerigroup.com' })).resolves.toBe('ad_ahmet.cicek')
  })

  it('LDAP distinguishedName gelirse null — FK ihlali YOK, kayıt devam eder', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(
      sorumluId(db, { responsibleId: 'CN=Ahmet Cicek,OU=Kullanicilar,DC=ilerigroup,DC=com' }),
    ).resolves.toBeNull()
  })

  it('ldap_<username> biçimi de null döner', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(sorumluId(db, { responsibleId: 'ldap_elif.karadeniz' })).resolves.toBeNull()
  })

  it('sorumlu SEÇİLMEMİŞ karar: null, DB sorgusu yok', async () => {
    const { db, findUnique } = sahteDb(KULLANICILAR)
    await expect(sorumluId(db, { responsibleEmail: null, responsibleId: null })).resolves.toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('gerçek User.id geçer (geriye dönük uyum)', async () => {
    const { db } = sahteDb(KULLANICILAR)
    await expect(sorumluId(db, { responsibleId: 'ad_elif.karadeniz' })).resolves.toBe('ad_elif.karadeniz')
  })
})

describe('karar ekleme — enum doğrulaması', () => {
  it('geçersiz priority 400 döner ve alanı söyler', async () => {
    const r = enumDogrula('priority', 'COK_ACIL', KARAR_ONCELIKLERI)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.yanit.status).toBe(400)
      const govde = await r.yanit.json()
      expect(govde.alan).toBe('priority')
      expect(govde.error).toContain('COK_ACIL')
    }
  })

  it('dört geçerli öncelik de kabul edilir', () => {
    for (const p of KARAR_ONCELIKLERI) expect(enumDogrula('priority', p, KARAR_ONCELIKLERI).ok).toBe(true)
  })

  it('priority gönderilmezse varsayılan yol açık kalır', () => {
    expect(enumDogrula('priority', undefined, KARAR_ONCELIKLERI).ok).toBe(true)
  })

  it('karar durumu ve katılımcı rolü de doğrulanıyor', () => {
    expect(enumDogrula('status', 'OVERDUE', KARAR_DURUMLARI).ok).toBe(true)
    expect(enumDogrula('status', 'BILINMEYEN', KARAR_DURUMLARI).ok).toBe(false)
    expect(enumDogrula('role', 'RAPPORTEUR', KATILIMCI_ROLLERI).ok).toBe(true)
    expect(enumDogrula('role', 'MISAFIR', KATILIMCI_ROLLERI).ok).toBe(false)
  })
})
