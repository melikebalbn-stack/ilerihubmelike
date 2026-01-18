// Yemek Menüsü API - Liste ve CRUD
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Haftalık menü getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('weekStart')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    let startDate: Date
    let endDate: Date

    if (weekStart) {
      // Haftalık görünüm
      startDate = new Date(weekStart)
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 6)
    } else if (month && year) {
      // Aylık görünüm
      startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      endDate = new Date(parseInt(year), parseInt(month), 0)
    } else {
      // Varsayılan: Bu hafta
      const today = new Date()
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1)
      startDate = new Date(today.setDate(diff))
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 6)
    }

    const menus = await prisma.dailyMenu.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    })

    // Tarihleri string formatına çevir
    const formattedMenus = menus.map(menu => ({
      ...menu,
      date: menu.date.toISOString().split('T')[0]
    }))

    return NextResponse.json(formattedMenus)
  } catch (error) {
    console.error('Menü listesi hatası:', error)
    return NextResponse.json({ error: 'Menü listesi alınamadı' }, { status: 500 })
  }
}

// POST - Yeni menü ekle veya güncelle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    // Yetki kontrolü
    const allowedRoles = ['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { date, items, isHoliday, holidayName, notes } = body

    if (!date) {
      return NextResponse.json({ error: 'Tarih zorunludur' }, { status: 400 })
    }

    const menuDate = new Date(date)
    menuDate.setHours(0, 0, 0, 0)

    // Upsert - varsa güncelle, yoksa oluştur
    const menu = await prisma.dailyMenu.upsert({
      where: { date: menuDate },
      update: {
        items: items || [],
        isHoliday: isHoliday || false,
        holidayName: holidayName || null,
        notes: notes || null,
        createdBy: session.user.email,
        createdByName: session.user.name || session.user.email
      },
      create: {
        date: menuDate,
        items: items || [],
        isHoliday: isHoliday || false,
        holidayName: holidayName || null,
        notes: notes || null,
        createdBy: session.user.email,
        createdByName: session.user.name || session.user.email
      }
    })

    return NextResponse.json({
      ...menu,
      date: menu.date.toISOString().split('T')[0]
    }, { status: 201 })
  } catch (error) {
    console.error('Menü kaydetme hatası:', error)
    return NextResponse.json({ error: 'Menü kaydedilemedi' }, { status: 500 })
  }
}

// DELETE - Menü sil
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    // Yetki kontrolü
    const allowedRoles = ['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json({ error: 'Tarih zorunludur' }, { status: 400 })
    }

    const menuDate = new Date(date)
    menuDate.setHours(0, 0, 0, 0)

    await prisma.dailyMenu.delete({
      where: { date: menuDate }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Menü silme hatası:', error)
    return NextResponse.json({ error: 'Menü silinemedi' }, { status: 500 })
  }
}
