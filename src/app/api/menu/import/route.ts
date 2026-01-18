// Yemek Menüsü Excel Import API
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

// POST - Excel dosyasından menü import et
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

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    }

    // Dosyayı buffer'a çevir
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Excel dosyasını oku
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as Record<string, string>[]

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Dosya boş veya geçersiz format' }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Her satırı işle
    for (const row of data) {
      try {
        // Tarih sütununu bul (Tarih, Date, date vb.)
        const dateKey = Object.keys(row).find(k =>
          k.toLowerCase().includes('tarih') || k.toLowerCase().includes('date')
        )

        if (!dateKey || !row[dateKey]) {
          results.failed++
          results.errors.push('Tarih sütunu bulunamadı veya boş')
          continue
        }

        // Tarihi parse et
        let menuDate: Date
        const dateValue = row[dateKey]

        if (typeof dateValue === 'string') {
          // DD.MM.YYYY veya DD/MM/YYYY formatı
          const parts = dateValue.split(/[./-]/)
          if (parts.length === 3) {
            const day = parseInt(parts[0])
            const month = parseInt(parts[1]) - 1
            const year = parseInt(parts[2])
            menuDate = new Date(year, month, day)
          } else {
            menuDate = new Date(dateValue)
          }
        } else {
          menuDate = new Date(dateValue)
        }

        if (isNaN(menuDate.getTime())) {
          results.failed++
          results.errors.push(`Geçersiz tarih: ${dateValue}`)
          continue
        }

        menuDate.setHours(0, 0, 0, 0)

        // Yemek sütunlarını bul
        const items: string[] = []
        const itemKeys = ['corba', 'çorba', 'soup', 'ana yemek', 'ana', 'main', 'yan yemek', 'yan', 'side', 'icecek', 'içecek', 'drink', 'tatli', 'tatlı', 'dessert', 'yemek1', 'yemek2', 'yemek3', 'yemek4', 'item1', 'item2', 'item3', 'item4']

        for (const key of Object.keys(row)) {
          const lowerKey = key.toLowerCase()
          if (itemKeys.some(ik => lowerKey.includes(ik)) || lowerKey.includes('yemek') || lowerKey.includes('item')) {
            const value = row[key]?.trim()
            if (value && value.length > 0) {
              items.push(value)
            }
          }
        }

        // Tatil kontrolü
        const holidayKey = Object.keys(row).find(k =>
          k.toLowerCase().includes('tatil') || k.toLowerCase().includes('holiday')
        )
        const isHoliday = holidayKey ?
          ['evet', 'yes', 'true', '1', 'x'].includes(row[holidayKey]?.toLowerCase?.() || '') :
          false

        // Tatil adı
        const holidayNameKey = Object.keys(row).find(k =>
          k.toLowerCase().includes('tatil adı') || k.toLowerCase().includes('holiday name')
        )
        const holidayName = holidayNameKey ? row[holidayNameKey] : null

        // Not
        const notesKey = Object.keys(row).find(k =>
          k.toLowerCase().includes('not') || k.toLowerCase().includes('note')
        )
        const notes = notesKey ? row[notesKey] : null

        // Veritabanına kaydet (upsert)
        await prisma.dailyMenu.upsert({
          where: { date: menuDate },
          update: {
            items,
            isHoliday,
            holidayName,
            notes,
            createdBy: session.user.email,
            createdByName: session.user.name || session.user.email
          },
          create: {
            date: menuDate,
            items,
            isHoliday,
            holidayName,
            notes,
            createdBy: session.user.email,
            createdByName: session.user.name || session.user.email
          }
        })

        results.success++
      } catch (error) {
        results.failed++
        results.errors.push(`Satır işleme hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
      }
    }

    return NextResponse.json({
      message: `${results.success} menü başarıyla import edildi`,
      ...results
    })
  } catch (error) {
    console.error('Menü import hatası:', error)
    return NextResponse.json({ error: 'Menü import edilemedi' }, { status: 500 })
  }
}
