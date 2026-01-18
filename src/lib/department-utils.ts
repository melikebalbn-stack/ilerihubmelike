import { prisma } from '@/lib/prisma'

// Cache for department mappings
let departmentCache: { data: Map<string, string>; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 dakika

/**
 * AD OU isminden Türkçe departman ismini döndürür
 * Örnek: "information technology" -> "Sistem Geliştirme"
 */
export async function mapAdOuToDepartment(adOuName: string | null | undefined): Promise<string | null> {
  if (!adOuName) return null

  const now = Date.now()

  // Cache kontrolü
  if (departmentCache && (now - departmentCache.timestamp) < CACHE_TTL) {
    const mapped = departmentCache.data.get(adOuName.toLowerCase())
    return mapped || adOuName
  }

  // Cache'i yenile
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        name: true,
        adOuName: true,
      },
    })

    const newCache = new Map<string, string>()
    for (const dept of departments) {
      if (dept.adOuName) {
        newCache.set(dept.adOuName.toLowerCase(), dept.name)
      }
    }

    departmentCache = { data: newCache, timestamp: now }

    const mapped = newCache.get(adOuName.toLowerCase())
    return mapped || adOuName
  } catch (error) {
    console.error('Departman eşleştirme hatası:', error)
    return adOuName
  }
}

/**
 * Tüm departman eşleştirmelerini döndürür (client-side için)
 */
export async function getAllDepartmentMappings(): Promise<Record<string, string>> {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        name: true,
        adOuName: true,
      },
    })

    const mappings: Record<string, string> = {}
    for (const dept of departments) {
      if (dept.adOuName) {
        mappings[dept.adOuName.toLowerCase()] = dept.name
      }
    }

    return mappings
  } catch (error) {
    console.error('Departman listesi hatası:', error)
    return {}
  }
}
