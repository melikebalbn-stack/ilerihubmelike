// Kadro (personel) talebinin AÇILABİLECEĞİ bölümler — TEK KAYNAK (07.10.2026).
//
// Forma "Bölüm" alanı eklenince gerekti: pozisyon listesi bölümün org ağacından
// geliyor, bölüm de serbest metin olamaz. Kapsam, talep AÇMA yetkisiyle BİREBİR
// aynı mantıktan türer (kadroTalepYetkisiCore); yeni bir yetki açmaz:
//   · İK (recruitment.admin ∨ hr.admin) / platform yöneticisi → tüm aktif bölümler
//   · müdür / müdür yardımcısı                                → koltuk bölümü + alt ağacı
//   · yalnız kadro.talep.ac (koltuksuz)                       → yalnız kendi bölümü
//
// NEDEN LDAP `User.department` DEĞİL: 07.10.2026 ölçümünde aktif kullanıcıların
// LDAP departman metninin HİÇBİRİ DepartmentDefinition.name ile eşleşmiyor (0/189),
// Personnel.bolum ise 189/189 eşleşiyor ve hepsinin orgUnitId bağı var. Bölüm bu
// yüzden DAİMA Personnel FK'sından çözülür (kapsam çözücüleriyle aynı desen).

import { prisma } from '@/lib/prisma'
import { platformYoneticiIdMi } from '@/lib/auth/platform-yonetici'
import { resolveMudurKoltukDepts } from '@/lib/overtime-performance'

export type TalepBolumu = { id: string; name: string; orgUnitId: string | null }

export type TalepBolumleri = {
  bolumler: TalepBolumu[]
  /** Formun açılışta seçeceği bölüm (açanın kendi bölümü, kapsamdaysa). */
  varsayilan: string | null
}

export async function talepBolumleriCoz(userId: string, perms: string[]): Promise<TalepBolumleri> {
  const tumBolumler = perms.includes('recruitment.admin') || perms.includes('hr.admin') || platformYoneticiIdMi(userId)

  // Açanın kendi bölümü (Personnel FK) — varsayılan ve koltuksuz kullanıcının tek seçeneği.
  const kullanici = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnel: { select: { department: { select: { id: true, name: true, orgUnitId: true } } } } },
  })
  const kendi = kullanici?.personnel?.department ?? null

  if (tumBolumler) {
    const bolumler = await prisma.departmentDefinition.findMany({
      where: { isActive: true },
      select: { id: true, name: true, orgUnitId: true },
      orderBy: { name: 'asc' },
    })
    return { bolumler, varsayilan: kendi && bolumler.some((b) => b.id === kendi.id) ? kendi.name : null }
  }

  const koltukAdlari = await resolveMudurKoltukDepts(userId)
  const bolumler = koltukAdlari.length
    ? await prisma.departmentDefinition.findMany({
        where: { isActive: true, name: { in: koltukAdlari } },
        select: { id: true, name: true, orgUnitId: true },
        orderBy: { name: 'asc' },
      })
    : []

  // Koltuksuz (yalnız kadro.talep.ac) ya da koltuk adları DepartmentDefinition'da
  // bulunamadı → kendi bölümü. Hiç bölüm bulunamazsa boş liste döner: form bölüm
  // seçemez, pozisyon listesi de üretilemez (elle yazma yolu açık kalır).
  if (bolumler.length === 0) return { bolumler: kendi ? [kendi] : [], varsayilan: kendi?.name ?? null }

  return { bolumler, varsayilan: kendi && bolumler.some((b) => b.id === kendi.id) ? kendi.name : bolumler[0].name }
}

/** Uçlarda gövdeden gelen bölüm adının kapsamda olup olmadığı (fail-closed). */
export function bolumKapsamdaMi(bolumler: TalepBolumu[], ad: string): TalepBolumu | null {
  return bolumler.find((b) => b.name === ad) ?? null
}
