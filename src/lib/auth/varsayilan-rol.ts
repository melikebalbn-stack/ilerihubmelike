import { prisma } from '@/lib/prisma'
import { isSystemAccount } from './sistem-hesaplari'

// VARSAYILAN ROL — hiç RBAC rolü olmayan kullanıcıya "Kullanıcı" (slug: kullanici).
//
// NEDEN: Roller 05.05.2026'da tek seferlik göç betiğiyle (migrate-user-roles)
// dağıtıldı; sonrasında yeni hesap açan iki yol da (auth.ts giriş upsert'i,
// ldap-sync) rol yazmıyordu. LDAP eşlemesi (ilerigroup → kullanici) 176 aktifin
// yalnız 38'ini kapsıyor. Sonuç: 05.05'ten sonra giren herkes biri elle
// ekleyene kadar rolsüz kalıyordu (11.09 ölçümü: 3 gerçek personel).
//
// KURALLAR:
//  - Sistem/terminal hesabı → ATLA. Paylaşımlı terminal izin.create ve
//    helpdesk.ticket.create almasın; kimin yaptığı bilinmez.
//  - Kullanıcının HERHANGİ bir rolü varsa → dokunma. Bu "kullanici eksikse
//    ekle" değil, "hiç rolü yoksa temel rolü ver"dir; bilerek daraltılmış
//    roller (yalnız Depo Operatörü gibi) korunur.
//  - source='manual' ŞART: syncUserAzureRoles 'azure_ad' satırlarını AD grup
//    üyeliğine göre siler, 'manual'e dokunmaz. 'azure_ad' yazılsaydı kişi
//    ilerigroup'tan çıkınca rolü kaybederdi.
//  - ASLA fırlatmaz. Rol atanamazsa loglar; giriş/senkron devam eder.
//
// Idempotent: PK (userId, roleId) + öndeki sayım; yarışta P2002 yakalanır.

export const VARSAYILAN_ROL_SLUG = 'kullanici'

export type VarsayilanRolSonuc = 'atandi' | 'zaten-rollu' | 'sistem-hesabi' | 'rol-tanimsiz' | 'hata'

export async function varsayilanRoluGaranti(
  userId: string,
  email: string,
  kaynak: 'login' | 'ldap-sync',
): Promise<VarsayilanRolSonuc> {
  try {
    if (isSystemAccount(email)) return 'sistem-hesabi'

    const mevcut = await prisma.userRole.count({ where: { userId } })
    if (mevcut > 0) return 'zaten-rollu'

    const rol = await prisma.role.findUnique({
      where: { slug: VARSAYILAN_ROL_SLUG },
      select: { id: true },
    })
    if (!rol) {
      console.error(`[VARSAYILAN-ROL] '${VARSAYILAN_ROL_SLUG}' rolü tanımsız — ${email} rolsüz kaldı (${kaynak})`)
      return 'rol-tanimsiz'
    }

    await prisma.userRole.create({
      data: {
        userId,
        roleId: rol.id,
        scope: null,
        source: 'manual',
        assignedById: null,
      },
    })
    console.info(`[VARSAYILAN-ROL] ${email} → ${VARSAYILAN_ROL_SLUG} (${kaynak})`)
    return 'atandi'
  } catch (err) {
    // P2002 = aynı anda iki istek yazdı; ikincisi kaybeder, rol zaten var.
    const kod = (err as { code?: string })?.code
    if (kod === 'P2002') return 'zaten-rollu'
    console.error(`[VARSAYILAN-ROL] ${email} rol atanamadı (${kaynak}):`, err instanceof Error ? err.message : String(err))
    return 'hata'
  }
}
