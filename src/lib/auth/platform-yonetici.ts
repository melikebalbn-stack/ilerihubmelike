// PLATFORM YÖNETİCİSİ — Hub genelinde okuma/kapsam bypass'ı (29.09.2026, Melih kararı).
//
// NE İŞE YARAR: bazı kapılar bilinçli olarak ROLE değil ORGANİZASYON KOLTUĞUNA
// bakıyor (kart okutamama DEMOTE_ROLES, avans sorumlu metni, müdür koltuğu
// kapsamları). Bu tasarım doğru — ama platformu geliştiren/işleten kişinin tüm
// ekranları görebilmesi gerekiyor. Bu modül o bypass'ın TEK KAYNAĞI.
//
// KAPSAM — YALNIZ OKUMA/KAPSAM:
//   ✔ ekran/uç erişimi (erisebilir), liste `where`'i, kapsam listeleri
//   ✘ ONAY ADIMI SAHİPLİĞİ: OvertimeApproval.approverId, deneme adimSahibiMi,
//     PersonnelRequestApproval, izin onayci1/2/3Id, FİF durum geçişi
//   ✘ BİLDİRİM ALICILARI: resolveApprovers, resolveHRRecipients, *-bildirim.ts,
//     onay/muafiyet.ts
// Yani "görebilir ama onaylayamaz". Bu ayrım bilinçli: atanmadığı formu
// onaylayabilir hale gelmek denetim izini anlamsızlaştırırdı.
//
// LİSTE NASIL TUTULUR: User.id ile (LDAP hesabı). Personnel eşleşmesi SİCİL NO
// ile — ad eşleşmesi KULLANILMAZ, çünkü aynı ad-soyada sahip PASİF mükerrer
// Personnel kaydı var (29.09 ölçümü) ve ad eşleşmesi yanlış kişiyi seçebilir.

import { prisma } from '@/lib/prisma'

/** Platform yöneticisi User.id listesi. Genişletmek bilinçli bir karardır. */
export const PLATFORM_YONETICI_USER_IDLERI = ['ad_melih.dilben'] as const

/** Aynı kişilerin Personnel kaydı — SİCİL ile (ad eşleşmesi değil). */
export const PLATFORM_YONETICI_SICILLERI = ['ILR-00375'] as const

/** Denetim action'ı — bypass sayesinde açılan YAZMA işlemleri buna düşer. */
export const PLATFORM_YONETICI_AKSIYON = 'PLATFORM_YONETICI_ERISIM'

type OturumParcasi = { user?: { id?: string | null } | null } | null | undefined

/** Oturum sahibi platform yöneticisi mi? (senkron — DB'ye gitmez) */
export function platformYoneticisiMi(session: OturumParcasi): boolean {
  const id = session?.user?.id
  return !!id && (PLATFORM_YONETICI_USER_IDLERI as readonly string[]).includes(id)
}

/** userId doğrudan elde varken (uçlar requireUser sonrası bunu kullanır). */
export function platformYoneticiIdMi(userId: string | null | undefined): boolean {
  return !!userId && (PLATFORM_YONETICI_USER_IDLERI as readonly string[]).includes(userId)
}

/**
 * Platform yöneticilerinin Personnel id'leri — sicilden çözülür (aktif kayıt).
 * Kapsam listelerine (ör. GRİ scopePersonnelIds) kendisini eklemek için.
 */
export async function platformYoneticiPersonnelIdleri(): Promise<string[]> {
  const kayitlar = await prisma.personnel.findMany({
    where: { sicilNo: { in: [...PLATFORM_YONETICI_SICILLERI] }, aktif: true },
    select: { id: true },
  })
  return kayitlar.map((k) => k.id)
}

/**
 * Bypass sayesinde yapılan YAZMA işlemini denetime yazar. Best-effort:
 * denetim yazılamazsa asıl işlem geri ALINMAZ (çağıranlar zaten kendi
 * denetim satırlarını yazıyor; bu ek bir iz).
 *
 * `islem`: hangi kapının açtığı ("kart-okutamama", "bolum-talep", "avans" …).
 */
export async function platformYoneticiDenetim(args: {
  userId: string
  userEmail?: string | null
  islem: string
  targetType?: 'PERSONNEL' | 'USER'
  targetId?: string | null
  detay?: Record<string, unknown>
}): Promise<void> {
  try {
    await prisma.permissionAuditLog.create({
      data: {
        action: PLATFORM_YONETICI_AKSIYON,
        actorId: args.userId,
        targetType: args.targetType ?? 'USER',
        targetId: args.targetId ?? args.userId,
        details: {
          islem: args.islem,
          actorEmail: args.userEmail ?? null,
          // Kapının normalde kapalı olduğunu açıkça yaz: denetim okuyan kişi
          // "bu erişim koltuktan değil, platform yöneticisi kuralından geldi"
          // bilgisini kaydın kendisinden görsün.
          gerekce: 'Platform yöneticisi kapsam bypassı (okuma/kapsam kuralı)',
          ...(args.detay ?? {}),
        },
      },
    })
  } catch (err) {
    console.error('[platform-yonetici] denetim yazılamadı:', err)
  }
}
