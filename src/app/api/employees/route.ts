import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
 * GET /api/employees
 *
 * Çalışan Rehberi master kaynak: Personnel.aktif=true (İK whitelist).
 * 189 aktif personel = 130 mavi yaka + 59 beyaz yaka. User link'i
 * varsa email/avatar enrich edilir, yoksa Personnel.mailAdresi kullanılır.
 *
 * Personnel pasife çekilince anında listeden düşer; yeni Personnel
 * eklendiğinde anında görünür. Sync gerekmez.
 */
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

    // Aktif whitelist'ler (Ayarlar → İV Tanımları)
    const [activeDepartments, activeJobTitles] = await Promise.all([
      prisma.departmentDefinition.findMany({
        where: { isActive: true },
        select: { name: true },
      }),
      prisma.jobTitle.findMany({
        where: { isActive: true },
        select: { name: true },
      }),
    ])
    const activeBolumNames = activeDepartments.map(d => d.name)
    const activeGorevNames = activeJobTitles.map(j => j.name)

    // Personnel master — Personnel.aktif=true VE bolum/gorev whitelist'lerinde olmalı
    const personnelList = await prisma.personnel.findMany({
      where: {
        aktif: true,
        bolum: { in: activeBolumNames },
        gorev: { in: activeGorevNames },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            extension3cx: true,
          },
        },
      },
    })

    // Employee shape'e dönüştür
    type EmployeeRow = {
      id: string
      name: string
      email: string | null
      department: string
      rawDepartment: string
      title: string
      phone: string | null
      avatar: null
    }

    const allEmployees: EmployeeRow[] = personnelList.map(p => ({
      // Detay sayfası için ID: User varsa LDAP username (id 'ad_xxx' → 'xxx'),
      // yoksa Personnel ID prefix'li (`personnel-${cuid}`)
      id: p.user?.id?.startsWith('ad_')
        ? p.user.id.slice(3)
        : `personnel-${p.id}`,
      name: p.adSoyad,
      email: p.user?.email || p.mailAdresi || null,
      department: p.bolum,
      rawDepartment: p.bolum,
      title: p.gorev,
      // SADECE şirket dahili (extension3cx). Personnel.telefon (cep) ASLA paylaşılmaz — KVKK.
      phone: p.user?.extension3cx || null,
      avatar: null,
    }))

    // Filtreleme
    let filtered = allEmployees

    if (search) {
      const ns = normalizeText(search)
      filtered = filtered.filter(e =>
        normalizeText(e.name).includes(ns) ||
        normalizeText(e.department).includes(ns) ||
        normalizeText(e.title).includes(ns) ||
        normalizeText(e.email || '').includes(ns)
      )
    }

    if (department) {
      filtered = filtered.filter(e => e.department === department)
    }

    // Türkçe-aware ad sıralaması
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'tr'))

    const total = filtered.length

    // Sayfalama
    const paginated = limit === 0
      ? filtered
      : filtered.slice((page - 1) * limit, (page - 1) * limit + limit)

    // Departman dropdown — sadece aktif personel olan bölümler
    const departments = Array.from(
      new Set(allEmployees.map(e => e.department))
    ).sort((a, b) => a.localeCompare(b, 'tr'))

    return NextResponse.json({
      employees: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: limit === 0 ? 1 : Math.ceil(total / limit),
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
