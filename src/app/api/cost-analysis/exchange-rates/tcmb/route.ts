import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CostCurrency } from '@/generated/prisma'

interface TCMBCurrency {
  code: string
  name: string
  forexBuying: number
  forexSelling: number
  banknoteBuying: number
  banknoteSelling: number
}

// Desteklenen para birimleri (Prisma enum ile uyumlu)
const SUPPORTED_CURRENCIES: string[] = ['USD', 'EUR', 'GBP']

// String'i CostCurrency enum'a dönüştür
function toCostCurrency(code: string): CostCurrency | null {
  if (['USD', 'EUR', 'GBP', 'TRY'].includes(code)) {
    return code as CostCurrency
  }
  return null
}

// TCMB XML'den döviz kurlarını parse et
function parseTCMBXml(xmlText: string): TCMBCurrency[] {
  const currencies: TCMBCurrency[] = []

  // Currency blokları bul
  const currencyRegex = /<Currency.*?Kod="(\w+)".*?>([\s\S]*?)<\/Currency>/g
  let match

  while ((match = currencyRegex.exec(xmlText)) !== null) {
    const code = match[1]
    const content = match[2]

    // Değerleri çıkar
    const getName = (tag: string) => {
      const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`)
      const result = content.match(regex)
      return result ? result[1].trim() : ''
    }

    const getValue = (tag: string): number => {
      const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`)
      const result = content.match(regex)
      if (result && result[1].trim()) {
        return parseFloat(result[1].trim())
      }
      return 0
    }

    const forexBuying = getValue('ForexBuying')
    const forexSelling = getValue('ForexSelling')

    // Sadece forex değeri olanları ekle
    if (forexBuying > 0 && forexSelling > 0) {
      currencies.push({
        code,
        name: getName('Isim'),
        forexBuying,
        forexSelling,
        banknoteBuying: getValue('BanknoteBuying'),
        banknoteSelling: getValue('BanknoteSelling'),
      })
    }
  }

  return currencies
}

// GET - TCMB'den güncel kurları getir (sadece göster, kaydetme)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TCMB'den güncel kurları çek
    const tcmbUrl = 'https://www.tcmb.gov.tr/kurlar/today.xml'

    const response = await fetch(tcmbUrl, {
      headers: {
        'User-Agent': 'ILERIHub/1.0',
      },
      next: { revalidate: 3600 }, // 1 saat cache
    })

    if (!response.ok) {
      throw new Error(`TCMB yanıt vermedi: ${response.status}`)
    }

    const xmlText = await response.text()

    // Tarih bilgisini al
    const dateMatch = xmlText.match(/<Tarih_Date.*?Tarih="([\d.]+)"/)
    const dateStr = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('tr-TR')

    const currencies = parseTCMBXml(xmlText)

    // Sadece desteklenen para birimlerini göster
    const filtered = currencies.filter(c => SUPPORTED_CURRENCIES.includes(c.code))

    return NextResponse.json({
      date: dateStr,
      currencies: filtered,
      source: 'TCMB',
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('TCMB kurları alınırken hata:', error)
    return NextResponse.json(
      { error: 'TCMB kurları alınırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' },
      { status: 500 }
    )
  }
}

// POST - TCMB'den kurları çek ve kaydet
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { currencies: selectedCurrencies } = body // İsteğe bağlı: sadece seçili para birimlerini kaydet

    // TCMB'den güncel kurları çek
    const tcmbUrl = 'https://www.tcmb.gov.tr/kurlar/today.xml'

    const response = await fetch(tcmbUrl, {
      headers: {
        'User-Agent': 'ILERIHub/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`TCMB yanıt vermedi: ${response.status}`)
    }

    const xmlText = await response.text()
    const currencies = parseTCMBXml(xmlText)

    // Tarih bilgisini al ve parse et
    const dateMatch = xmlText.match(/<Tarih_Date.*?Tarih="([\d.]+)"/)
    let effectiveDate = new Date()
    if (dateMatch) {
      const [day, month, year] = dateMatch[1].split('.')
      effectiveDate = new Date(`${year}-${month}-${day}`)
    }

    // Hangi para birimlerini kaydedeceğimize karar ver - sadece desteklenen para birimleri
    const currenciesToSave = currencies.filter(c => {
      const isSupported = SUPPORTED_CURRENCIES.includes(c.code)
      const isSelected = !selectedCurrencies?.length || selectedCurrencies.includes(c.code)
      return isSupported && isSelected
    })

    const results = {
      saved: [] as string[],
      skipped: [] as string[],
      errors: [] as string[],
    }

    // Her para birimi için TRY karşılığını kaydet
    for (const currency of currenciesToSave) {
      try {
        const fromCurrency = toCostCurrency(currency.code)
        if (!fromCurrency) {
          results.skipped.push(`${currency.code} (desteklenmiyor)`)
          continue
        }

        // Ortalama kur (alış-satış ortalaması)
        const avgRate = (currency.forexBuying + currency.forexSelling) / 2

        // Önce bu tarih ve para birimi çifti için mevcut kayıt var mı kontrol et
        const existing = await prisma.costExchangeRate.findFirst({
          where: {
            fromCurrency: fromCurrency,
            toCurrency: 'TRY' as CostCurrency,
            effectiveDate: effectiveDate,
          },
        })

        if (existing) {
          // Güncelle
          await prisma.costExchangeRate.update({
            where: { id: existing.id },
            data: { rate: avgRate },
          })
          results.saved.push(`${currency.code}/TRY (güncellendi)`)
        } else {
          // Yeni kayıt oluştur
          await prisma.costExchangeRate.create({
            data: {
              fromCurrency: fromCurrency,
              toCurrency: 'TRY' as CostCurrency,
              rate: avgRate,
              effectiveDate: effectiveDate,
            },
          })
          results.saved.push(`${currency.code}/TRY`)
        }
      } catch (error: any) {
        results.errors.push(`${currency.code}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      date: effectiveDate.toISOString().split('T')[0],
      results,
      message: `${results.saved.length} kur kaydedildi`,
    })
  } catch (error) {
    console.error('TCMB kurları kaydedilirken hata:', error)
    return NextResponse.json(
      { error: 'TCMB kurları kaydedilirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
