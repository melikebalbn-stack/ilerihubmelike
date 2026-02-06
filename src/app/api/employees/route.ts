import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllLDAPUsers, LDAPUser } from '@/lib/ldap'

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
    const location = searchParams.get('location') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // LDAP'tan tüm kullanıcıları al
    const allUsers = await getAllLDAPUsers()

    // Filtreleme
    let filteredUsers = allUsers

    if (search) {
      const normalizedSearch = normalizeText(search)
      filteredUsers = filteredUsers.filter(user =>
        normalizeText(user.displayName || '').includes(normalizedSearch) ||
        normalizeText(user.department || '').includes(normalizedSearch) ||
        normalizeText(user.title || '').includes(normalizedSearch) ||
        normalizeText(user.email || '').includes(normalizedSearch)
      )
    }

    if (department) {
      const normalizedDept = normalizeText(department)
      filteredUsers = filteredUsers.filter(user =>
        normalizeText(user.department || '').includes(normalizedDept)
      )
    }

    if (location) {
      const normalizedLoc = normalizeText(location)
      filteredUsers = filteredUsers.filter(user =>
        normalizeText(user.ou || '').includes(normalizedLoc)
      )
    }

    // Sıralama (ada göre)
    filteredUsers.sort((a, b) =>
      (a.displayName || '').localeCompare(b.displayName || '', 'tr')
    )

    // Toplam sayı
    const total = filteredUsers.length

    // Sayfalama
    const startIndex = (page - 1) * limit
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + limit)

    // Benzersiz departmanlar ve lokasyonlar (filtre için)
    const departments = [...new Set(allUsers.map(u => u.department).filter(Boolean))]
      .sort((a, b) => (a || '').localeCompare(b || '', 'tr'))
    const locations = [...new Set(allUsers.map(u => u.ou).filter(Boolean))]
      .sort((a, b) => (a || '').localeCompare(b || '', 'tr'))

    // Employee format'a dönüştür
    const employees = paginatedUsers.map(user => ({
      id: user.username,
      name: user.displayName,
      email: user.email,
      department: user.department,
      title: user.title,
      location: user.ou,
      phone: null, // LDAP'ta telefon bilgisi yok
      avatar: null, // Avatar URL'si yok
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
        locations,
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
