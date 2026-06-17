import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { logAuditEvent } from '@/lib/audit-log'
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
  return isInsanVarliklari(dept)
}

function hasPersonnelAccess(role: string, department?: string | null): boolean {
  return ALLOWED_ROLES.includes(role) || isHRDepartment(department)
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('tr-TR')
}

function toExcelDate(date: Date | null | undefined): Date | string {
  if (!date) return ''
  return new Date(date)
}

function boolToStr(val: boolean | null | undefined): string {
  if (val === null || val === undefined) return ''
  return val ? 'Evet' : 'Hayır'
}

export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-personnel: requireUser — admin role + sensitive data export check
    const { user, error } = await requireUser()
    if (error) return error

    if (!hasPersonnelAccess(user.role, user.department)) {
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

    const includeSensitive = ALLOWED_ROLES.includes(user.role)
    const includeBank = FULL_SENSITIVE_ROLES.includes(user.role)

    const personnel = await prisma.personnel.findMany({
      where,
      include: includeSensitive ? { sensitive: true } : undefined,
      orderBy: { adSoyad: 'asc' },
    })

    // Build Excel data
    // Excel sırasıyla birebir aynı sütun düzeni
    const data = personnel.map((p: any, idx: number) => {
      const s = (includeSensitive && p.sensitive) ? p.sensitive : null
      const bank = (includeBank && s) ? true : false

      const row: Record<string, any> = {
        'NO': idx + 1,
        'SİCİL NO': p.sicilNo,
        'SINIF': p.sinif || '',
        'CİNSİYET': CINSIYET_LABELS[p.cinsiyet] || p.cinsiyet,
        'ADI VE SOYADI': p.adSoyad,
        'YAKA': YAKA_LABELS[p.yakaRengi] || p.yakaRengi,
        'DİREK ENDİREK': p.direktEndirekt ? (DIREKT_ENDIREKT_LABELS[p.direktEndirekt] || p.direktEndirekt) : '',
        'ASANSÖR/MEKANİK': p.asansorMekanik ? (ASANSOR_MEKANIK_LABELS[p.asansorMekanik] || p.asansorMekanik) : '',
        'SGK NO': s ? (s.sgkNo || '') : '',
        'TC KİMLİK NO': s ? (s.tcKimlikNo || '') : '',
        'İŞE GİRİŞ TARİHİ': toExcelDate(p.iseGirisTarihi),
        'DENEME (2 AY) DEĞERLENDİRME': toExcelDate(p.denemeDegerlendirme),
        'İLK 6 AY DEĞERLENDİRME': toExcelDate(p.altiAyDegerlendirme),
        'GÖREV': p.gorev,
        'BÖLÜM/DETAY': p.bolumDetay || '',
        'BÖLÜM': p.bolum,
        '1. SORUMLU': p.birimSorumlusu || '',
        '2. SORUMLU': p.sorumlu2 || '',
        '3. SORUMLU': p.sorumlu3 || '',
        'BÖLÜM MÜDÜRÜ': p.bolumMuduru || '',
        'BANKA ŞUBE': bank ? (s.bankaSube || '') : '',
        'BANKA HESAP NO': bank ? (s.bankaHesapNo || '') : '',
        'TELEFON NO': p.telefon || '',
        'DOĞUM TARİHİ': s ? toExcelDate(s.dogumTarihi) : '',
        'EMEKLİ': boolToStr(p.emekli),
        'ENGELLİ': boolToStr(p.engelli),
        'EĞİTİM YERİ': p.egitimYeri || '',
        'EĞİTİM TİPİ': p.egitimTipi || '',
        'EĞİTİM ALANI': p.egitimAlani || '',
        'MEZUNİYET YILI': p.mezuniyetYili || '',
        'KEP ADRESLERİ': p.interKepMail || '',
        'MASRAF MERKEZİ': p.masrafMerkezi || '',
        'KAN GRUBU': p.kanGrubu ? (KAN_GRUBU_LABELS[p.kanGrubu] || p.kanGrubu) : '',
        'İKAMET ADRESİ': p.ikametAdresi || '',
        'MAİL ADRESİ': p.mailAdresi || '',
        'SERVİS': p.serviceRoute || '',
        'DURAK ADI': p.serviceStop || '',
        'IBAN NO': bank ? (s.ibanNo || '') : '',
        'İLKYARDIMCI BELGESİ': toExcelDate(p.ilkYardimciBelgesi),
        'KALFALIK BELGESİ': toExcelDate(p.kalfalikBelgesi),
        'USTALIK BELGESİ': toExcelDate(p.ustalikBelgesi),
        'FORKLİFT EHLİYETİ': boolToStr(p.forkliftEhliyeti),
        'E.TRANSPALET EHLİYETİ': boolToStr(p.eTrans),
        'YANGIN SERTİFİKASI': toExcelDate(p.yanginSertifikasi),
        'USTA ÖĞRETİCİ BELGESİ': boolToStr(p.ustaOgreticiBelgesi),
      }

      return row
    })

    // Excel ile birebir aynı sırada header
    const headers = [
      'NO', 'SİCİL NO', 'SINIF', 'CİNSİYET', 'ADI VE SOYADI', 'YAKA',
      'DİREK ENDİREK', 'ASANSÖR/MEKANİK',
      'SGK NO', 'TC KİMLİK NO',
      'İŞE GİRİŞ TARİHİ', 'DENEME (2 AY) DEĞERLENDİRME', 'İLK 6 AY DEĞERLENDİRME',
      'GÖREV', 'BÖLÜM/DETAY', 'BÖLÜM',
      '1. SORUMLU', '2. SORUMLU', '3. SORUMLU', 'BÖLÜM MÜDÜRÜ',
      'BANKA ŞUBE', 'BANKA HESAP NO',
      'TELEFON NO', 'DOĞUM TARİHİ',
      'EMEKLİ', 'ENGELLİ',
      'EĞİTİM YERİ', 'EĞİTİM TİPİ', 'EĞİTİM ALANI', 'MEZUNİYET YILI',
      'KEP ADRESLERİ', 'MASRAF MERKEZİ', 'KAN GRUBU',
      'İKAMET ADRESİ', 'MAİL ADRESİ',
      'SERVİS', 'DURAK ADI', 'IBAN NO',
      'İLKYARDIMCI BELGESİ', 'KALFALIK BELGESİ', 'USTALIK BELGESİ',
      'FORKLİFT EHLİYETİ', 'E.TRANSPALET EHLİYETİ',
      'YANGIN SERTİFİKASI', 'USTA ÖĞRETİCİ BELGESİ',
    ]

    // Add example row when no data exists (template download)
    if (data.length === 0) {
      const exampleRow: Record<string, any> = {
        'NO': 1,
        'SİCİL NO': 'ILR-00001',
        'SINIF': 'İŞÇİ',
        'CİNSİYET': 'Erkek',
        'ADI VE SOYADI': 'Ahmet Yılmaz',
        'YAKA': 'Mavi Yaka',
        'DİREK ENDİREK': 'Direkt',
        'ASANSÖR/MEKANİK': 'Mekanik',
        'SGK NO': '1234567890123',
        'TC KİMLİK NO': '12345678901',
        'İŞE GİRİŞ TARİHİ': '15.03.2024',
        'DENEME (2 AY) DEĞERLENDİRME': 'Başarılı',
        'İLK 6 AY DEĞERLENDİRME': 'Başarılı',
        'GÖREV': 'CNC Operatörü',
        'BÖLÜM/DETAY': 'CNC Atölyesi',
        'BÖLÜM': 'Üretim',
        '1. SORUMLU': 'Mehmet Demir',
        '2. SORUMLU': 'Ali Kaya',
        '3. SORUMLU': '',
        'BÖLÜM MÜDÜRÜ': 'Veli Yıldız',
        'BANKA ŞUBE': '389',
        'BANKA HESAP NO': '6645044',
        'TELEFON NO': '05321234567',
        'DOĞUM TARİHİ': '01.01.1990',
        'EMEKLİ': 'Hayır',
        'ENGELLİ': 'Hayır',
        'EĞİTİM YERİ': 'İstanbul Teknik Üniversitesi',
        'EĞİTİM TİPİ': 'Lisans',
        'EĞİTİM ALANI': 'Makine Mühendisliği',
        'MEZUNİYET YILI': '2020',
        'KEP ADRESLERİ': 'ahmet.yilmaz@hs09.kep.tr',
        'MASRAF MERKEZİ': '720.1.01',
        'KAN GRUBU': 'A Rh(+)',
        'İKAMET ADRESİ': 'Örnek Mah. No:1 Çayırova',
        'MAİL ADRESİ': 'ahmet.yilmaz@ilerigroup.com',
        'SERVİS': 'BEYLİKBAĞI',
        'DURAK ADI': 'CAN EMLAK',
        'IBAN NO': 'TR85 0006 2000 3890 0006 6450 44',
        'İLKYARDIMCI BELGESİ': 'Hayır',
        'KALFALIK BELGESİ': '',
        'USTALIK BELGESİ': '',
        'FORKLİFT EHLİYETİ': 'Hayır',
        'E.TRANSPALET EHLİYETİ': 'Hayır',
        'YANGIN SERTİFİKASI': 'Hayır',
        'USTA ÖĞRETİCİ BELGESİ': 'Hayır',
      }
      data.push(exampleRow)
    }

    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers, cellDates: true })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Personel')

    // Tarih sütunlarına DD.MM.YYYY formatı uygula
    const dateColumns = ['İŞE GİRİŞ TARİHİ', 'DENEME (2 AY) DEĞERLENDİRME', 'İLK 6 AY DEĞERLENDİRME', 'DOĞUM TARİHİ', 'İLKYARDIMCI BELGESİ', 'KALFALIK BELGESİ', 'USTALIK BELGESİ', 'YANGIN SERTİFİKASI']
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    for (let C = range.s.c; C <= range.e.c; C++) {
      const headerCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })]
      if (headerCell && dateColumns.includes(headerCell.v)) {
        for (let R = range.s.r + 1; R <= range.e.r; R++) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })]
          if (cell && cell.t === 'd') {
            cell.z = 'DD.MM.YYYY'
          }
        }
      }
    }

    // Auto-size columns
    const colWidths = headers.map((key) => ({
      wch: Math.max(key.length + 2, 15),
    }))
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // PR-AUDIT-LOG-EXPANSION (KVKK): toplu kişisel veri export'u kritik
    // Hassas alan KAYDEDİLMEZ — sadece kapsam ve filtre özeti
    await logAuditEvent({
      action: 'PERSONNEL_EXPORTED',
      actorId: user.id,
      targetType: 'PERSONNEL',
      details: {
        actorEmail: user.email,
        recordCount: personnel.length,
        includeSensitive,
        includeBank,
        filters: { bolum, yakaRengi, aktif, search: search ? '<filtered>' : null },
      },
    })

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
