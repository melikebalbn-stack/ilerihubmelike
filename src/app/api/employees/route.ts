import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllLDAPUsers } from '@/lib/ldap'
import { prisma } from '@/lib/prisma'

// Türkçe karakterleri normalize et (arama için)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

/**
 * LDAP raw department string → DB Department name mapping
 * LDAP'tan gelen departman string'lerini DB'deki temiz isimlere eşler
 */
const DEPARTMENT_MAPPING: Record<string, string> = {
  // Asansör
  'ASANSÖR': 'Asansör',
  // İnsan Varlıkları
  'Insan Varliklari Departmanı': 'İnsan Varlıkları',
  // Muhasebe
  'Muhasebe Departmanı': 'Muhasebe',
  'Muhasebe Departmani': 'Muhasebe',
  // Kalite
  'Kalite Departmanı': 'Kalite',
  'Kalite Kontrol': 'Kalite',
  'Kalite Mudurlugu': 'Kalite',
  'KALİTE MÜDÜRLÜĞÜ': 'Kalite',
  'Laboratuvar': 'Kalite',
  // Mühendislik
  'PROTOTİP ATÖLYE': 'Mühendislik',
  // Satınalma
  'Satinalma Mudurlugu': 'Satınalma',
  'Satınalma': 'Satınalma',
  // Satış Pazarlama
  'Satıs Pazarlama Mudurlugu': 'Satış Pazarlama',
  // Sistem Geliştirme
  'Sistem Geliştirme Departmanı': 'Sistem Geliştirme',
  'Sistem Gelistirme Mudurlugu': 'Sistem Geliştirme',
  // Üretim
  'BAKIMHANE': 'Üretim',
  'DEPO': 'Üretim',
  'Fabrika Mudurlugu': 'Üretim Planlama',
  'KALIPHANE': 'Üretim',
  'KAYNAKHANE': 'Üretim',
  'LAZER & DAİRE TESTERE': 'Üretim',
  'MEKANİK MONTAJ': 'Üretim',
  'PAKETLEME & DİREKSİYON': 'Üretim',
  'PLASTİK ENJEKSİYON': 'Üretim',
  'PRESHANE': 'Üretim',
  'TALAŞLI İMALAT': 'Üretim',
  'Üretim': 'Üretim',
  // Yönetim
  'İDARİ İŞLER': 'Yönetim',
  'Yatırım Ve Tesvik': 'Yönetim',
  'Yönetim': 'Yönetim',
}

/**
 * LDAP raw department string'ini DB Department name'e çevir
 * Mapping'de yoksa null döner (Diğer kategorisine gider)
 */
function mapDepartment(rawDept: string | null | undefined): string | null {
  if (!rawDept) return null
  const trimmed = rawDept.trim()
  if (!trimmed) return null
  return DEPARTMENT_MAPPING[trimmed] || null
}

// GET /api/employees - Tüm çalışanları listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const department = searchParams.get('department') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // DB'den temiz departman listesini al (dropdown için)
    const dbDepartments = await prisma.department.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    const departmentNames = dbDepartments.map(d => d.name)

    // LDAP'tan tüm kullanıcıları al
    let allUsers = await getAllLDAPUsers()

    // LDAP boş dönerse DB fallback
    if (allUsers.length === 0) {
      const dbUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          jobTitle: true,
          officeLocation: true,
        },
      })
      allUsers = dbUsers.map(u => ({
        username: u.id,
        displayName: u.name || '',
        email: u.email,
        department: u.department,
        title: u.jobTitle,
        distinguishedName: '',
        memberOf: [],
        ou: u.officeLocation,
        managerDN: null,
        ipPhone: null,
      }))
    }

    // Mail adresi olmayanları gizle
    const usersWithEmail = allUsers.filter(user => user.email)

    // Her kullanıcıya mappedDepartment ekle
    const usersWithMappedDept = usersWithEmail.map(user => ({
      ...user,
      mappedDepartment: mapDepartment(user.department),
    }))

    // Filtreleme
    let filteredUsers = usersWithMappedDept

    if (search) {
      const normalizedSearch = normalizeText(search)
      filteredUsers = filteredUsers.filter(user =>
        normalizeText(user.displayName || '').includes(normalizedSearch) ||
        normalizeText(user.department || '').includes(normalizedSearch) ||
        normalizeText(user.mappedDepartment || '').includes(normalizedSearch) ||
        normalizeText(user.title || '').includes(normalizedSearch) ||
        normalizeText(user.email || '').includes(normalizedSearch)
      )
    }

    if (department) {
      if (department === 'Diğer') {
        // Mapping'de eşleşmeyen kullanıcıları göster
        filteredUsers = filteredUsers.filter(user => user.mappedDepartment === null)
      } else {
        // DB departman adına göre filtrele
        filteredUsers = filteredUsers.filter(user => user.mappedDepartment === department)
      }
    }

    // Sıralama (ada göre)
    filteredUsers.sort((a, b) =>
      (a.displayName || '').localeCompare(b.displayName || '', 'tr')
    )

    // Toplam sayı
    const total = filteredUsers.length

    // Sayfalama (limit=0 ise tümünü döndür)
    const paginatedUsers = limit === 0
      ? filteredUsers
      : filteredUsers.slice((page - 1) * limit, (page - 1) * limit + limit)

    // Sadece en az 1 kullanıcısı olan departmanları göster
    const activeDepts = new Set(usersWithMappedDept.map(u => u.mappedDepartment).filter(Boolean))
    const departments: string[] = departmentNames.filter(name => activeDepts.has(name))

    // Eşleşmeyen departman var mı kontrol et ("Diğer" kategorisi)
    const hasUnmapped = usersWithMappedDept.some(u => u.mappedDepartment === null && u.department)
    if (hasUnmapped) departments.push('Diğer')

    // DB'den extension3cx map'i oluştur
    const dbExtensions = await prisma.user.findMany({
      where: { extension3cx: { not: null } },
      select: { email: true, extension3cx: true },
    })
    const extensionMap = new Map(dbExtensions.map(u => [u.email.toLowerCase(), u.extension3cx]))

    // Employee format'a dönüştür
    const employees = paginatedUsers.map(user => ({
      id: user.username,
      name: user.displayName,
      email: user.email,
      department: user.mappedDepartment || user.department,
      rawDepartment: user.department,
      title: user.title,
      phone: extensionMap.get(user.email!.toLowerCase()) || null,
      avatar: null,
      managerDN: user.managerDN,
    }))

    return NextResponse.json({
      employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        departments,
      },
    })

  } catch (error) {
    console.error('Employees API error:', error)
    return NextResponse.json(
      { error: 'Çalışan listesi alınamadı' },
      { status: 500 }
    )
  }
}
