import { prisma } from '@/lib/prisma'

/**
 * Pozisyon/unvan bazlı onaylayan bulma
 * Örnek: getApproverByTitle("Fabrika Müdürü") → Personnel kaydı
 */
export async function getApproverByTitle(gorev: string) {
  return prisma.personnel.findFirst({
    where: {
      gorev: { contains: gorev, mode: 'insensitive' },
      aktif: true,
    },
  })
}

/**
 * Departman bazlı onaylayan bulma
 * Örnek: getApproverByDepartmentRole("CNC", "mudur") → CNC bölüm müdürü
 */
export async function getApproverByDepartmentRole(
  bolum: string,
  rol: 'mudur' | 'sorumlu'
) {
  if (rol === 'mudur') {
    // Bölüm müdürü alanında belirtilen kişiyi bul
    const deptPerson = await prisma.personnel.findFirst({
      where: { bolum: { contains: bolum, mode: 'insensitive' }, aktif: true, bolumMuduru: { not: null } },
      select: { bolumMuduru: true },
    })
    if (deptPerson?.bolumMuduru) {
      return prisma.personnel.findFirst({
        where: { adSoyad: { contains: deptPerson.bolumMuduru, mode: 'insensitive' }, aktif: true },
      })
    }
  } else {
    // Birim sorumlusu alanında belirtilen kişiyi bul
    const deptPerson = await prisma.personnel.findFirst({
      where: { bolum: { contains: bolum, mode: 'insensitive' }, aktif: true, birimSorumlusu: { not: null } },
      select: { birimSorumlusu: true },
    })
    if (deptPerson?.birimSorumlusu) {
      return prisma.personnel.findFirst({
        where: { adSoyad: { contains: deptPerson.birimSorumlusu, mode: 'insensitive' }, aktif: true },
      })
    }
  }
  return null
}

/**
 * Varsayılan onay zinciri döndür
 * Mesai, izin, doküman gibi süreçler için
 */
export async function getDefaultApprovalChain(
  type: 'OVERTIME' | 'LEAVE' | 'DOCUMENT',
  bolum?: string
) {
  const chain = []

  // 1. Birim Sorumlusu
  if (bolum) {
    const sorumlu = await getApproverByDepartmentRole(bolum, 'sorumlu')
    if (sorumlu) chain.push(sorumlu)
  }

  // 2. Bölüm Müdürü
  if (bolum) {
    const mudur = await getApproverByDepartmentRole(bolum, 'mudur')
    if (mudur) chain.push(mudur)
  }

  // 3. Tip bazlı ek onaylayan
  if (type === 'OVERTIME') {
    const fabrikaMuduru = await getApproverByTitle('Fabrika Müdürü')
    if (fabrikaMuduru) chain.push(fabrikaMuduru)
  } else if (type === 'DOCUMENT') {
    const kaliteMuduru = await getApproverByTitle('Kalite Müdürü')
    if (kaliteMuduru) chain.push(kaliteMuduru)
  }

  return chain
}
