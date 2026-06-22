// Yemek Menüsü Excel Şablon İndirme API
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

// GET - Excel şablon dosyası indir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('weekStart')

    // Şablon verileri oluştur
    const templateData: Record<string, string>[] = []

    // Başlangıç tarihi
    let startDate: Date
    if (weekStart) {
      startDate = new Date(weekStart)
    } else {
      // Varsayılan: Bu haftanın Pazartesi'si
      const today = new Date()
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1)
      startDate = new Date(today.setDate(diff))
    }

    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

    // 7 günlük şablon oluştur
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

      const dateStr = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`

      templateData.push({
        'Tarih': dateStr,
        'Gün': days[dayOfWeek],
        'Çorba': isWeekend ? '' : 'Mercimek Çorbası',
        'Ana Yemek': isWeekend ? '' : 'Tavuk Sote',
        'Yan Yemek': isWeekend ? '' : 'Pilav',
        'İçecek': isWeekend ? '' : 'Ayran',
        'Tatil': isWeekend ? 'Evet' : '',
        'Tatil Adı': isWeekend ? days[dayOfWeek] : '',
        'Not': ''
      })
    }

    // Excel dosyası oluştur
    const worksheet = XLSX.utils.json_to_sheet(templateData)

    // Sütun genişlikleri
    worksheet['!cols'] = [
      { wch: 12 },  // Tarih
      { wch: 12 },  // Gün
      { wch: 20 },  // Çorba
      { wch: 20 },  // Ana Yemek
      { wch: 20 },  // Yan Yemek
      { wch: 15 },  // İçecek
      { wch: 8 },   // Tatil
      { wch: 15 },  // Tatil Adı
      { wch: 25 },  // Not
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Yemek Menüsü')

    // Talimatlar sayfası ekle
    const instructionsData = [
      { 'Talimat': 'Yemek Menüsü Şablonu Kullanım Kılavuzu' },
      { 'Talimat': '' },
      { 'Talimat': '1. Tarih: DD.MM.YYYY formatında girin (örn: 07.01.2026)' },
      { 'Talimat': '2. Gün: Otomatik doldurulur, değiştirmenize gerek yok' },
      { 'Talimat': '3. Çorba: Günün çorbasını yazın' },
      { 'Talimat': '4. Ana Yemek: Ana yemeği yazın' },
      { 'Talimat': '5. Yan Yemek: Yan yemeği yazın (pilav, makarna vb.)' },
      { 'Talimat': '6. İçecek: İçeceği yazın' },
      { 'Talimat': '7. Tatil: Tatil günü ise "Evet" yazın' },
      { 'Talimat': '8. Tatil Adı: Tatil adını yazın (Cumartesi, Pazar, Resmi Tatil vb.)' },
      { 'Talimat': '9. Not: Ekstra notlar ekleyebilirsiniz' },
      { 'Talimat': '' },
      { 'Talimat': 'Not: Tatil günlerinde yemek sütunlarını boş bırakabilirsiniz.' },
      { 'Talimat': 'Hafta sonu otomatik olarak tatil olarak işaretlenmiştir.' },
    ]
    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData)
    instructionsSheet['!cols'] = [{ wch: 70 }]
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Talimatlar')

    // Buffer'a çevir
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })

    // Response oluştur
    const response = new NextResponse(excelBuffer)
    response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response.headers.set('Content-Disposition', `attachment; filename=yemek_menusu_sablonu.xlsx`)

    return response
  } catch (error) {
    console.error('Şablon indirme hatası:', error)
    return NextResponse.json({ error: 'Şablon indirilemedi' }, { status: 500 })
  }
}
