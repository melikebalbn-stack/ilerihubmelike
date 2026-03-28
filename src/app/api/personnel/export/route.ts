import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import {
  KAN_GRUBU_LABELS,
  CINSIYET_LABELS,
  YAKA_LABELS,
  DIREKT_ENDIREKT_LABELS,
  ASANSOR_MEKANIK_LABELS,
} from '@/lib/personnel-constants'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']
const FULL_SENSITIVE_ROLES = ['ADMIN', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  if (!dept) return false
  const d = dept.toLowerCase()
  return d.includes('insan') || d.includes('human') || d.includes('hr') || d.includes('ik')
}

function hasPersonnelAccess(role: string, department?: string | null): boolean {
  return ALLOWED_ROLES.includes(role) || isHRDepartment(department)
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('tr-TR')
}

function boolToStr(val: boolean | null | undefined): string {
  if (val === null || val === undefined) return ''
  return val ? 'Evet' : 'Hayır'
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any).role
    const userDept = (session.user as any).department
    if (!hasPersonnelAccess(userRole, userDept)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const bolum = searchParams.get('bolum')
    const yakaRengi = searchParams.get('yakaRengi')
    const aktifParam = searchParams.get('aktif')
    const search = searchParams.get('search')

    const aktif = aktifParam === 'false' ? false : true

    const where: any = { aktif }
    if (bolum) where.bolum = bolum
    if (yakaRengi) where.yakaRengi = yakaRengi
    if (search) {
      where.OR = [
        { adSoyad: { contains: search, mode: 'insensitive' } },
        { sicilNo: { contains: search, mode: 'insensitive' } },
        { gorev: { contains: search, mode: 'insensitive' } },
      ]
    }

    const includeSensitive = ALLOWED_ROLES.includes(userRole)
    const includeBank = FULL_SENSITIVE_ROLES.includes(userRole)

    const personnel = await prisma.personnel.findMany({
      where,
      include: includeSensitive ? { sensitive: true } : undefined,
      orderBy: { adSoyad: 'asc' },
    })

    // Build Excel data
    const data = personnel.map((p: any) => {
      const row: Record<string, any> = {
        'SİCİL NO': p.sicilNo,
        'ADI VE SOYADI': p.adSoyad,
        'SINIF': p.sinif || '',
        'CİNSİYET': CINSIYET_LABELS[p.cinsiyet] || p.cinsiyet,
        'YAKA': YAKA_LABELS[p.yakaRengi] || p.yakaRengi,
        'DİREK ENDİREK': p.direktEndirekt ? (DIREKT_ENDIREKT_LABELS[p.direktEndirekt] || p.direktEndirekt) : '',
        'ASANSÖR/MEKANİK': p.asansorMekanik ? (ASANSOR_MEKANIK_LABELS[p.asansorMekanik] || p.asansorMekanik) : '',
        'İŞE GİRİŞ TARİHİ': formatDate(p.iseGirisTarihi),
        'GÖREV': p.gorev,
        'BÖLÜM/DETAY': p.bolumDetay || '',
        'BÖLÜM': p.bolum,
        'BİRİM SORUMLUSU': p.birimSorumlusu || '',
        'BÖLÜM MÜDÜRÜ': p.bolumMuduru || '',
        'TELEFON': p.telefon || '',
        'KAN GRUBU': p.kanGrubu ? (KAN_GRUBU_LABELS[p.kanGrubu] || p.kanGrubu) : '',
        'MASRAF MERKEZİ': p.masrafMerkezi || '',
        'İNTERKEP MAİL ADRESLERİ': p.interKepMail || '',
        'MYK USTALIK-KALFALIK': boolToStr(p.mykUstalikKalfalik),
        'İLK YARDIMCI': boolToStr(p.ilkYardimci),
        'EMEKLİ': boolToStr(p.emekli),
        'ENGELLİ': boolToStr(p.engelli),
        'EĞİTİM YERİ': p.egitimYeri || '',
        'EĞİTİM TİPİ': p.egitimTipi || '',
        'EĞİTİM ALANI': p.egitimAlani || '',
        'MEZUNİYET YILI': p.mezuniyetYili || '',
        'DENEME (2 AY) DEĞERLENDİRME': p.denemeDegerlendirme || '',
        'İLK 6 AY DEĞERLENDİRME': p.altiAyDegerlendirme || '',
      }

      // Add sensitive data based on role
      if (includeSensitive && p.sensitive) {
        row['SGK NO'] = p.sensitive.sgkNo || ''
        row['TC KİMLİK NUMARASI'] = p.sensitive.tcKimlikNo || ''
        row['DOĞUM TARİHLERİ'] = formatDate(p.sensitive.dogumTarihi)

        if (includeBank) {
          row['BANKA ŞUBE'] = p.sensitive.bankaSube || ''
          row['BANKA HESAP NO'] = p.sensitive.bankaHesapNo || ''
        }
      }

      return row
    })

    // Define headers explicitly so they always appear even with empty data
    const headers = [
      'SİCİL NO', 'ADI VE SOYADI', 'SINIF', 'CİNSİYET', 'YAKA',
      'DİREK ENDİREK', 'ASANSÖR/MEKANİK', 'İŞE GİRİŞ TARİHİ',
      'GÖREV', 'BÖLÜM/DETAY', 'BÖLÜM', 'BİRİM SORUMLUSU', 'BÖLÜM MÜDÜRÜ',
      'TELEFON', 'KAN GRUBU', 'MASRAF MERKEZİ', 'İNTERKEP MAİL ADRESLERİ',
      'MYK USTALIK-KALFALIK', 'İLK YARDIMCI', 'EMEKLİ', 'ENGELLİ',
      'EĞİTİM YERİ', 'EĞİTİM TİPİ', 'EĞİTİM ALANI', 'MEZUNİYET YILI',
      'DENEME (2 AY) DEĞERLENDİRME', 'İLK 6 AY DEĞERLENDİRME',
    ]
    if (includeSensitive) {
      headers.push('SGK NO', 'TC KİMLİK NUMARASI', 'DOĞUM TARİHLERİ')
      if (includeBank) headers.push('BANKA ŞUBE', 'BANKA HESAP NO')
    }

    // Add example row when no data exists (template download)
    if (data.length === 0) {
      const exampleRow: Record<string, any> = {
        'SİCİL NO': 'V001',
        'ADI VE SOYADI': 'Ahmet Yılmaz',
        'SINIF': 'B',
        'CİNSİYET': 'Erkek',
        'YAKA': 'Mavi Yaka',
        'DİREK ENDİREK': 'Direkt',
        'ASANSÖR/MEKANİK': 'Asansör',
        'İŞE GİRİŞ TARİHİ': '15.03.2024',
        'GÖREV': 'CNC Operatörü',
        'BÖLÜM/DETAY': 'CNC Atölyesi',
        'BÖLÜM': 'Üretim',
        'BİRİM SORUMLUSU': 'Mehmet Demir',
        'BÖLÜM MÜDÜRÜ': 'Ali Kaya',
        'TELEFON': '05321234567',
        'KAN GRUBU': 'A Rh(+)',
        'MASRAF MERKEZİ': 'ÜRETİM-01',
        'İNTERKEP MAİL ADRESLERİ': 'ahmet.yilmaz@ilerigroup.com',
        'MYK USTALIK-KALFALIK': 'Evet',
        'İLK YARDIMCI': 'Hayır',
        'EMEKLİ': 'Hayır',
        'ENGELLİ': 'Hayır',
        'EĞİTİM YERİ': 'İstanbul Teknik Üniversitesi',
        'EĞİTİM TİPİ': 'Lisans',
        'EĞİTİM ALANI': 'Makine Mühendisliği',
        'MEZUNİYET YILI': '2020',
        'DENEME (2 AY) DEĞERLENDİRME': 'Başarılı',
        'İLK 6 AY DEĞERLENDİRME': 'Başarılı',
      }
      if (includeSensitive) {
        exampleRow['SGK NO'] = '1234567890'
        exampleRow['TC KİMLİK NUMARASI'] = '12345678901'
        exampleRow['DOĞUM TARİHLERİ'] = '01.01.1990'
        if (includeBank) {
          exampleRow['BANKA ŞUBE'] = 'Ziraat Bankası - Merkez'
          exampleRow['BANKA HESAP NO'] = 'TR00 0000 0000 0000 0000 00'
        }
      }
      data.push(exampleRow)
    }

    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Personel')

    // Auto-size columns
    const colWidths = headers.map((key) => ({
      wch: Math.max(key.length + 2, 15),
    }))
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="personel_listesi_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Excel export hatası:', error)
    return NextResponse.json({ error: 'Excel export sırasında bir hata oluştu' }, { status: 500 })
  }
}
