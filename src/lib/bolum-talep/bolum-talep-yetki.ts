// Bölüm Değişikliği Talep Formu — yetki TEK KAYNAĞI (28.09.2026).
//
// TALEP AÇAN: yalnız bir departmanın MÜDÜRÜ (DepartmentDefinition.mudurId) ya da
// MÜDÜR YARDIMCISI (mudurYardimcisiId). Kapsam = kendi departmanı + ALT AĞACI
// (resolveMudurKoltukDeptler — mesai/KPI ile aynı çözücü). Başka bölümün
// personeli için talep AÇILAMAZ.
//
// İV kendisi talep AÇMAZ (Melih kararı): onun yolu personel kartındaki doğrudan
// "Bölüm Değiştir" ve o yol aynen korunuyor. İV yalnız KARAR verir ve tüm
// talepleri görür. İV kümesi department-transfer ucuyla BİREBİR aynı:
// rol ∈ {ADMIN, HR_MANAGER, SUPER_ADMIN} ∨ departman = İnsan Varlıkları.
//
// LDAP department metni yalnız İV tespitinde kullanılır; müdür/müdür-yrd kararı
// DAİMA Personnel FK'sı üzerinden (ia-yetki / kadro-talep ile aynı desen).

import { prisma } from '@/lib/prisma'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { resolveMudurKoltukDeptler } from '@/lib/overtime-performance'
import { platformYoneticiIdMi } from '@/lib/auth/platform-yonetici'

const IV_ROLLERI = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

export type BolumTalepRol = 'MUDUR' | 'MUDUR_YRD'

export interface BolumTalepYetki {
  userId: string
  personnelId: string | null
  /** Müdür/müdür-yrd koltuğu — yoksa null (talep açamaz). */
  rol: BolumTalepRol | null
  /** Kendi departmanı + alt ağacı (talep açılabilecek bölümler). İV'de boş olabilir. */
  kapsamBolumler: { id: string; name: string }[]
  /** İnsan Varlıkları — karar verir, tüm talepleri görür. */
  iv: boolean
  /** Talep açma ekranı/ucu. İV için FALSE (kendi yolu personel kartı). */
  talepAcabilir: boolean
  /** Forma/uçlara erişim: talep açabilen ya da İV. */
  erisebilir: boolean
  /**
   * Kapsam/talep hakkı PLATFORM YÖNETİCİSİ kuralından geldiyse true (29.09.2026,
   * Melih kararı: test edebilmek için tüm personel için talep açabilir).
   * KARAR (onay/red) bu bayrakla AÇILMAZ — o `iv` ile gelir.
   */
  platformBypass: boolean
}

export function ivMi(role: string | null | undefined, department: string | null | undefined): boolean {
  return IV_ROLLERI.includes(role ?? '') || isInsanVarliklari(department)
}

/**
 * Yetki çekirdeği — oturumdan BAĞIMSIZ (userId + rol + departman verilir).
 * NextResponse döndürmez; hem uçlar hem server component'ler bunu çağırır.
 */
export async function bolumTalepYetkisiCore(
  userId: string,
  role: string | null | undefined,
  department: string | null | undefined,
): Promise<BolumTalepYetki> {
  const iv = ivMi(role, department)

  const u = await prisma.user.findUnique({ where: { id: userId }, select: { personnelId: true } })
  const personnelId = u?.personnelId ?? null

  let rol: BolumTalepRol | null = null
  if (personnelId) {
    const dept = await prisma.departmentDefinition.findFirst({
      where: { OR: [{ mudurId: personnelId }, { mudurYardimcisiId: personnelId }] },
      select: { mudurId: true, mudurYardimcisiId: true },
    })
    if (dept?.mudurId === personnelId) rol = 'MUDUR'
    else if (dept?.mudurYardimcisiId === personnelId) rol = 'MUDUR_YRD'
  }

  // PLATFORM YÖNETİCİSİ: koltuk kapsamı yerine TÜM aktif departmanlar. Talep
  // açabilir (rol yoksa MUDUR sayılır — kayıtta acanRol bu değerle yazılır).
  const platformBypass = platformYoneticiIdMi(userId)
  if (platformBypass) {
    const hepsi = await prisma.departmentDefinition.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return {
      userId,
      personnelId,
      rol: rol ?? 'MUDUR',
      kapsamBolumler: hepsi,
      iv,
      talepAcabilir: true,
      erisebilir: true,
      platformBypass: true,
    }
  }

  // Kapsam yalnız koltuk sahibinde hesaplanır (İV'nin kapsam kısıtı yok, talep de açmaz).
  const kapsamBolumler = rol ? await resolveMudurKoltukDeptler(userId) : []

  return {
    userId,
    personnelId,
    rol,
    kapsamBolumler,
    iv,
    talepAcabilir: rol !== null,
    erisebilir: rol !== null || iv,
    platformBypass: false,
  }
}
