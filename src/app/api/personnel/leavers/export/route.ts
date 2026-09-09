// GET /api/personnel/leavers/export — Ayrılan Personel listesi Excel çıktısı.
//
// Desen: api/personnel/export/route.ts (XLSX + json_to_sheet + DD.MM.YYYY + attachment).
// Yetki: leavers ucuyla AYNI kapı (EDIT_ROLES ∪ İnsan Varlıkları departmanı).
// Filtreler: sorgu çekirdeği paylaşıldığı için ekranda görülen satırlar birebir iner
// (tarih aralığı, bölüm, taraf, tip, arama).
//
// HASSAS VERİ: bu uç PersonnelSensitive/PersonnelBankAccount OKUMAZ — TC, IBAN, adres
// çıktıda YOKTUR. Bu yüzden canViewSensitive kademesi gerekmez. Çıkış gerekçesi /
// kök neden / genel not kurumsal olarak dar erişimlidir; üstteki yetki kapısı bunu
// zaten sağlıyor (Melih kararı: GENEL NOT sütunu dahil).

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { logAuditEvent } from '@/lib/audit-log'
import { ayrilanPersonelSatirlari } from '@/lib/personnel/leavers-sorgu'

export const dynamic = 'force-dynamic'

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  return isInsanVarliklari(dept)
}
function hasAccess(role: string, department?: string | null): boolean {
  return EDIT_ROLES.includes(role) || isHRDepartment(department)
}

const TARAF_ETIKET: Record<string, string> = {
  ISTIFA: 'İstifa',
  ISVEREN: 'İşveren',
  KARSILIKLI: 'Karşılıklı',
  DIGER: 'Diğer',
}
const TIP_ETIKET: Record<string, string> = {
  GONULLU: 'Gönüllü',
  GONULSUZ: 'Gönülsüz',
}
const DURUM_ETIKET: Record<string, string> = {
  LEFT: 'Ayrıldı',
  REENTRY: 'Tekrar Giriş',
}

/** Çalışma süresi: ekrandaki "X yıl Y ay" biçimi. */
function sureMetni(wp: { years: number; months: number } | null): string {
  if (!wp) return ''
  const p: string[] = []
  if (wp.years) p.push(`${wp.years} yıl`)
  if (wp.months) p.push(`${wp.months} ay`)
  return p.length ? p.join(' ') : '0 ay'
}

const HEADERS = [
  'SİCİL NO', 'ADI VE SOYADI', 'BÖLÜM', 'GÖREV',
  'İŞE GİRİŞ TARİHİ', 'ÇIKIŞ TARİHİ', 'ÇALIŞMA SÜRESİ',
  'DURUM', 'TARAF', 'ÇIKIŞ KODU', 'TİP',
  'SEBEP', 'KÖK NEDEN', 'GENEL NOT', 'KAYIT EDEN', 'KAYIT TARİHİ',
] as const

const TARIH_SUTUNLARI = ['İŞE GİRİŞ TARİHİ', 'ÇIKIŞ TARİHİ', 'KAYIT TARİHİ']

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const rows = await ayrilanPersonelSatirlari(request)

    const data = rows.map((r) => ({
      'SİCİL NO': r.sicilNo ?? '',
      'ADI VE SOYADI': r.adSoyad,
      'BÖLÜM': r.bolum ?? '',
      'GÖREV': r.gorev ?? '',
      'İŞE GİRİŞ TARİHİ': r.girisTarihi ? new Date(r.girisTarihi) : '',
      'ÇIKIŞ TARİHİ': r.cikisTarihi ? new Date(r.cikisTarihi) : '',
      'ÇALIŞMA SÜRESİ': sureMetni(r.workingPeriod),
      'DURUM': DURUM_ETIKET[r.status] ?? r.status,
      'TARAF': r.exitParty ? (TARAF_ETIKET[r.exitParty] ?? r.exitParty) : '',
      'ÇIKIŞ KODU': r.exitCode ?? '',
      'TİP': r.exitTurnoverType ? (TIP_ETIKET[r.exitTurnoverType] ?? r.exitTurnoverType) : '',
      'SEBEP': r.exitReason ?? '',
      'KÖK NEDEN': r.exitRootCause ?? '',
      'GENEL NOT': r.exitGeneralNote ?? '',
      'KAYIT EDEN': r.exitRecordedBy?.name ?? '',
      'KAYIT TARİHİ': r.exitRecordedAt ? new Date(r.exitRecordedAt) : '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(data, { header: [...HEADERS], cellDates: true })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ayrılan Personel')

    // Tarih sütunlarına DD.MM.YYYY (personnel/export ile aynı yöntem)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    for (let C = range.s.c; C <= range.e.c; C++) {
      const baslik = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })]
      if (baslik && TARIH_SUTUNLARI.includes(baslik.v)) {
        for (let R = range.s.r + 1; R <= range.e.r; R++) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })]
          if (cell && cell.t === 'd') cell.z = 'DD.MM.YYYY'
        }
      }
    }
    worksheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 14) }))

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // KVKK: toplu kişisel veri export'u — kapsam ve filtre özeti loglanır, DEĞER yazılmaz.
    const sp = request.nextUrl.searchParams
    await logAuditEvent({
      action: 'PERSONNEL_LEAVERS_EXPORTED',
      actorId: user.id,
      targetType: 'PERSONNEL',
      details: {
        actorEmail: user.email,
        recordCount: rows.length,
        // Hassas alan İÇERMEZ (TC/IBAN/adres okunmuyor); çıkış gerekçeleri dahildir.
        sensitiveIncluded: false,
        filters: {
          from: sp.get('from'), to: sp.get('to'), bolum: sp.get('bolum'),
          taraf: sp.get('taraf'), tip: sp.get('tip'),
          search: sp.get('q') ? '<filtered>' : null,
        },
      },
    })

    const dosyaAdi = `ayrilan_personel_${new Date().toISOString().slice(0, 10)}.xlsx`
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${dosyaAdi}"`,
      },
    })
  } catch (err) {
    console.error('Leavers export hatası:', err)
    return NextResponse.json({ error: 'Excel oluşturulamadı' }, { status: 500 })
  }
}
