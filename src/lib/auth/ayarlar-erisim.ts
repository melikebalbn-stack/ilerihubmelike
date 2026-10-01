/**
 * Ayarlar ekranına BÖLÜM üzerinden erişim — İnsan Varlıkları ve İdari İşler.
 *
 * Melih kararı (01.10.2026): bu iki bölüm Ayarlar menüsünü görsün ve altı
 * bölümü kullanabilsin — Yemek Menüsü, Duyuru Sistemi, Öneri Sistemi,
 * İV Ayarları, Mesai Formu Yetkilendirme, Mesai Formu Onay Pozisyonları.
 * Diğer Ayarlar bölümleri (Dashboard, IT Ticket, Kalibrasyon, Planlı Görevler,
 * Yangın Güvenliği, E-Posta) ADMIN/SUPER_ADMIN'de KALIR.
 *
 * Kapsam sınırı — bilerek: bu kural mesai formu VERİSİNE erişim açmaz.
 * Yalnız "kim mesai formu açabilir" listesi (OvertimeAuthorizedUser) ve onay
 * pozisyonu atamaları içindir; 16.09.2026'da `overtime.report.all` ile
 * daraltılan görme/onaylama kapsamı aynen durur.
 *
 * Eşleşme METİN üzerinden (User.department / ou — LDAP'tan gelir, FK yoktur);
 * Personnel kaydından karar veren yerler için FK öncelikli sürüm
 * `ayarlar-bolum-fk.ts` içindedir. `hr-departments/route.ts`'teki
 * `isInsanVarliklari` deseninin genişletilmişi.
 */

import { normalizeDept } from '@/lib/auth/personnel-access'
import { canAccessKalite } from '@/lib/auth/kalite-access'

/** DepartmentDefinition adları — FK sürümü de bu listeyi kullanır. */
export const AYARLAR_BOLUM_ADLARI = ['İnsan Varlıkları Müdürlüğü', 'İdari İşler'] as const

/**
 * Normalize edilmiş bir bölüm/OU metni İV ya da İdari İşler'i gösteriyor mu.
 * Önek değil ÖNEK-İÇEREN eşleşme: AD'den "Insan Varliklari Departmanı",
 * "IDARI ISLER" gibi farklı yazımlar geliyor.
 */
export function ayarlarBolumMetniMi(metin: string | null | undefined): boolean {
  const s = normalizeDept(metin)
  if (!s) return false
  return s.includes('insan varl') || s.includes('idari is')
}

/** User.department ya da ou'dan biri İV/İdari İşler mi. */
export function isAyarlarBolumu(
  department: string | null | undefined,
  ou: string | null | undefined,
): boolean {
  return ayarlarBolumMetniMi(department) || ayarlarBolumMetniMi(ou)
}

/**
 * /settings giriş kapısı — mevcut Kalite kuralı ∪ İV/İdari İşler.
 * Layout, middleware ve Sidebar üçü de bunu kullanır (ıraksamasınlar).
 */
export function canAccessAyarlar(
  role: string | null | undefined,
  department: string | null | undefined,
  ou: string | null | undefined,
): boolean {
  return canAccessKalite(role, department, ou) || isAyarlarBolumu(department, ou)
}
