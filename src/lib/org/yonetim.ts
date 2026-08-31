import { prisma } from '@/lib/prisma'
import { normalizeDept } from '@/lib/auth/personnel-access'

/**
 * Org şeması yönetim uçlarının ORTAK yetki kontrolü.
 *
 * Mevcut org-chart uçları (uye-ata, vekil-ata, pozisyon-ekle, pozisyon-cikar,
 * sorumluluk, personel-listesi) bu bloğun birebir kopyasını taşıyor — o dosyalar
 * `checkAccess` private olduğu için kopyalamak zorunda kalmış. Yeni uçlarda
 * kopyayı çoğaltmak yerine tek yerden okunuyor; KURAL AYNI, yeni yetki anahtarı
 * eklenmedi.
 */
export function orgYonetimYetkisi(session: any) {
  const userRole = session?.user?.role
  const userDepartment = session?.user?.department || ''

  const fullAccessRoles = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'IT_MANAGER']
  const hrDepartments = ['insan varliklari', 'insan varlıkları', 'human resources', 'hr']
  // TR-normalize (personnel-access · normalizeDept) — düz toLowerCase() Türkçe "İ"yi
  // i+birleşen nokta yapıp eşleşmeyi düşürüyordu.
  const normDept = normalizeDept(userDepartment)
  const isHrDepartment = hrDepartments.some((dept) => normDept.includes(normalizeDept(dept)))

  return { hasFullAccess: fullAccessRoles.includes(userRole) || isHrDepartment }
}

/** Zincir yürürken sonsuz döngüye düşmemek için üst sınır (şema derinliği 8). */
const MAX_DERINLIK = 100

/**
 * parentId döngü koruması: `hedefParentId`'nin ata zincirinde `birimId` varsa
 * (ya da hedef birimin kendisiyse) taşıma bir çevrim yaratır.
 * @returns döngü varsa true
 */
export async function parentDongusuVarMi(birimId: string, hedefParentId: string | null) {
  if (!hedefParentId) return false
  if (hedefParentId === birimId) return true

  let mevcut: string | null = hedefParentId
  for (let i = 0; i < MAX_DERINLIK && mevcut; i++) {
    const ust: { parentId: string | null } | null = await prisma.orgUnit.findUnique({
      where: { id: mevcut },
      select: { parentId: true },
    })
    if (!ust) return false
    if (ust.parentId === birimId) return true
    mevcut = ust.parentId
  }
  return false
}

/**
 * reportsToId döngü koruması: A→B→A olamaz.
 * @returns döngü varsa true
 */
export async function raporlamaDongusuVarMi(koltukId: string, hedefKoltukId: string | null) {
  if (!hedefKoltukId) return false
  if (hedefKoltukId === koltukId) return true

  let mevcut: string | null = hedefKoltukId
  for (let i = 0; i < MAX_DERINLIK && mevcut; i++) {
    const ust: { reportsToId: string | null } | null = await prisma.orgEmployee.findUnique({
      where: { id: mevcut },
      select: { reportsToId: true },
    })
    if (!ust) return false
    if (ust.reportsToId === koltukId) return true
    mevcut = ust.reportsToId
  }
  return false
}

export type TasimaHata = { kod: string; mesaj: string }

/**
 * Üye taşımanın ön koşulları. Hem tekli hem toplu uç aynı kontrolü kullanır.
 * Hedef kutu BOŞ olmalı — pozisyon↔kişi 1:1 kuralı korunur.
 */
export async function tasimaKontrol(orgEmployeeId: string, hedefOrgUnitId: string): Promise<TasimaHata | null> {
  const koltuk = await prisma.orgEmployee.findUnique({
    where: { id: orgEmployeeId },
    select: { id: true, orgUnitId: true, displayName: true },
  })
  if (!koltuk) return { kod: 'KOLTUK_YOK', mesaj: 'Taşınacak üye kaydı bulunamadı.' }

  const hedef = await prisma.orgUnit.findUnique({
    where: { id: hedefOrgUnitId },
    select: { id: true, name: true, unitType: true, vekaletDurumu: true },
  })
  if (!hedef) return { kod: 'HEDEF_YOK', mesaj: 'Hedef birim bulunamadı.' }
  if (hedef.unitType !== 'POSITION')
    return { kod: 'HEDEF_POZISYON_DEGIL', mesaj: `"${hedef.name}" bir pozisyon değil; üye yalnız pozisyona taşınabilir.` }
  if (koltuk.orgUnitId === hedefOrgUnitId)
    return { kod: 'AYNI_KUTU', mesaj: `"${koltuk.displayName}" zaten bu kutuda.` }
  if (hedef.vekaletDurumu === true)
    return { kod: 'VEKALETLI', mesaj: `"${hedef.name}" vekaletli; önce vekaleti kaldırın.` }

  const doluluk = await prisma.orgEmployee.count({ where: { orgUnitId: hedefOrgUnitId, isActive: true } })
  if (doluluk !== 0)
    return { kod: 'HEDEF_DOLU', mesaj: `"${hedef.name}" dolu — üye yalnız BOŞ kadroya taşınabilir.` }

  return null
}
