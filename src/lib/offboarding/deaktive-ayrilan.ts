import type { PrismaClient, Prisma } from '@/generated/prisma'

// Ayrılmış personelin açık kalan portal hesaplarını kapatan TEK KAYNAK.
// Hem gecelik cron ucu (/api/cron/deaktive-ayrilan-personel) hem CLI script'i
// (prisma/deaktive-ayrilan-personel.ts) buradan çağırır — iki ayrı uygulama
// zamanla ayrışır, mantık burada kalır.
//
// Neden gerekli: ilişik kesme akışı User.isActive'e dokunmuyor; hesabı kapatan
// tek diğer yol src/lib/ldap-sync.ts (AD-disabled debounce) ve mavi yaka
// hesaplarının AD karşılığı olmadığı için o yol onları hiç kapatmıyor.
//
// KURAL: SİLME YOK. Yalnız User.isActive=false yazılır; user_role bağlarına
//   dokunulmaz — hesap geri açılırsa yetki kaybı olmasın.
// db: transaction içinden çağrılıyorsa tx geçirin.

type DbClient = PrismaClient | Prisma.TransactionClient

/**
 * Güvenlik ağı: tek turda bu sayıdan FAZLA hesap kapatılacaksa hiçbiri
 * kapatılmaz. Girdi Personnel.aktif — o da IFS personel senkronundan geliyor;
 * hatalı bir senkron turu çok sayıda personeli pasife düşürebilir.
 * ldap-sync.ts'teki DEACTIVATION_ABORT_LIMIT ile aynı desen (orada eşik 5;
 * burada toplu ayrılış dönemleri için 10).
 */
export const DEACTIVATION_ABORT_LIMIT = 10

export type AyrilanAday = {
  userId: string
  email: string
  adSoyad: string
  sicilNo: string | null
  roller: string[]
  sonGiris: Date | null
  /** Personnel'de ayrılma tarihi sütunu yok; pasifleştirme anı için tek vekil updatedAt. */
  pasiflestirme: Date
}

export type DeaktiveSonuc = {
  dryRun: boolean
  /** Sorgunun bulduğu toplam kayıt (atlananlar dahil). */
  bulundu: number
  /** Kapatılan (dry-run'da: kapatılacak olan) kayıtlar. */
  hedefler: AyrilanAday[]
  kapatildi: number
  /** Ayrılma SONRASI girişi olduğu için dokunulmayanlar — elle karar gerekir. */
  atlananlar: AyrilanAday[]
  /** Güvenlik ağı tetiklendiyse true; bu turda HİÇBİR kayıt kapatılmadı. */
  abortedLimit: boolean
}

/**
 * Hedefi SORGUYLA bulur (Personnel.aktif=false + User.isActive=true), sabit
 * liste tutmaz → her koşuda yeni düşenleri de yakalar. İdempotenttir: kapatılan
 * kayıt bir sonraki turda sorguya girmez.
 */
export async function deaktiveAyrilanPersonel(
  db: DbClient,
  opts: { dryRun: boolean },
): Promise<DeaktiveSonuc> {
  const kayitlar = await db.user.findMany({
    where: { isActive: true, personnel: { aktif: false } },
    select: {
      id: true,
      email: true,
      lastLoginAt: true,
      personnel: { select: { sicilNo: true, adSoyad: true, updatedAt: true } },
      userRoles: { select: { role: { select: { slug: true } } } },
    },
  })

  const adaylar: AyrilanAday[] = kayitlar
    .filter((u) => u.personnel !== null)
    .map((u) => ({
      userId: u.id,
      email: u.email,
      adSoyad: u.personnel!.adSoyad,
      sicilNo: u.personnel!.sicilNo,
      roller: u.userRoles.map((ur) => ur.role.slug).sort(),
      sonGiris: u.lastLoginAt,
      pasiflestirme: u.personnel!.updatedAt,
    }))
    .sort((a, b) => b.pasiflestirme.getTime() - a.pasiflestirme.getTime())

  // Ayrılma SONRASI giriş varsa dokunma — ayrılma tarihi yanlış girilmiş, kişi
  // hâlâ çalışıyor ya da hesap başkasınca kullanılıyor olabilir. Elle karar.
  const atlananlar = adaylar.filter((a) => a.sonGiris !== null && a.sonGiris > a.pasiflestirme)
  const hedefler = adaylar.filter((a) => !atlananlar.includes(a))

  // Güvenlik ağı: eşik aşıldıysa TÜMÜ iptal (dry-run'da da rapor edilir).
  if (hedefler.length > DEACTIVATION_ABORT_LIMIT) {
    return {
      dryRun: opts.dryRun,
      bulundu: adaylar.length,
      hedefler,
      kapatildi: 0,
      atlananlar,
      abortedLimit: true,
    }
  }

  let kapatildi = 0
  if (!opts.dryRun) {
    for (const a of hedefler) {
      // Yalnız isActive; rol bağları korunuyor.
      await db.user.update({ where: { id: a.userId }, data: { isActive: false } })
      kapatildi++
    }
  }

  return {
    dryRun: opts.dryRun,
    bulundu: adaylar.length,
    hedefler,
    kapatildi,
    atlananlar,
    abortedLimit: false,
  }
}

/** Log/mail için tek satırlık kayıt özeti. */
export function adayOzet(a: AyrilanAday): string {
  const t = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 19) : '—')
  return `${a.sicilNo ?? '(sicil yok)'} ${a.adSoyad} <${a.email}> roller: ${
    a.roller.length ? a.roller.join(', ') : '(rol yok)'
  } | son giriş: ${t(a.sonGiris)} | pasifleştirme: ${t(a.pasiflestirme)}`
}
