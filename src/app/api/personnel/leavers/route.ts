// PR-PERSONNEL-LEAVERS-LIST + PR-EXIT-READ-FROM-PERIODS:
// Ayrılan personel raporlaması artık EmploymentPeriod (dönem) bazlı.
// Kapalı dönemi (cikisTarihi != null) olan HER dönem bir satırdır — bir kişinin
// birden çok çıkışı varsa hepsi ayrı satır (İK çıkış-giriş geçmişini görür).
//
// DURUM: bir kapalı dönemin cikisTarihi'nden sonra aynı personelin başka bir
// dönemi (yeni giriş) varsa → REENTRY (Çıkış-Giriş, kişi geri dönmüş).
// Yoksa → LEFT (gerçek ayrılma).
//
// Filtreler: from/to (cikisTarihi aralığı), bolum (personnel.bolum), taraf
// (dönem exitParty), tip (dönem exitTurnoverType), q (personnel ad/sicil).
// Çalışma süresi runtime hesaplanır — dönem girisTarihi→cikisTarihi.
// Personnel.exit* / aktif filtresi TAMAMEN kalktı (PR-4'te alanlar da düşecek).

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { ayrilanPersonelSatirlari } from '@/lib/personnel/leavers-sorgu'

const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  return isInsanVarliklari(dept)
}

function hasAccess(role: string, department?: string | null): boolean {
  return EDIT_ROLES.includes(role) || isHRDepartment(department)
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasAccess(user.role, user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    // Sorgu çekirdeği paylaşılıyor — Excel ucu (leavers/export) da aynı fonksiyonu
    // çağırır, böylece ekranda görülenle inen dosya birebir aynı kalır.
    const rows = await ayrilanPersonelSatirlari(request)
    return NextResponse.json(rows)
  } catch (err) {
    console.error('Leavers GET hatası:', err)
    return NextResponse.json({ error: 'Liste yüklenemedi' }, { status: 500 })
  }
}
