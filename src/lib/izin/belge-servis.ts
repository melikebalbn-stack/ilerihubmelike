import 'server-only'
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { belgeOku } from './belge-depo'
import { IzinYetkiHatasi } from './gun-sayimi'
import type { Baglam } from './talep-ortak'

/**
 * İzin belgesi görüntüleme (Faz 4). Belgeyi YALNIZ talebin sahibi (çalışan) ve İV görür:
 *   rapor (özel nitelikli, sağlık verisi) → izin.rapor.gor · diğer belgeler → izin.admin ya da izin.rapor.gor.
 * Yönetici / ekip GÖREMEZ (onay kalemine belge listesi yalnız İV kısmında girer). Her açılış ÖNCE denetime
 * yazılır (PersonnelAccessLog + permission_audit_log, tek transaction) — denetim yazılamazsa belge VERİLMEZ.
 * Bulunamayan ile yetkisiz aynı yanıtı alır (varlık sızdırmaz).
 */
export async function belgeAc(ctx: Baglam, belgeId: string, ip: string | null) {
  const b = await prisma.izinBelge.findUnique({
    where: { id: belgeId },
    select: { id: true, dosyaAdi: true, orijinalAd: true, mime: true, silindiAt: true, talep: { select: { id: true, personnelId: true, tur: { select: { ozelNitelikli: true } } } } },
  })
  const yetkisiz = new IzinYetkiHatasi('Bu belgeyi görme yetkiniz yok')
  if (!b) throw yetkisiz
  const izinler = await getUserPermissions(ctx.userId)
  const kendi = !!ctx.personnelId && ctx.personnelId === b.talep.personnelId
  const ozel = b.talep.tur.ozelNitelikli
  const iv = ozel ? izinler.has('izin.rapor.gor') : izinler.has('izin.admin') || izinler.has('izin.rapor.gor')
  if (!kendi && !iv) throw yetkisiz
  if (b.silindiAt) throw new IzinYetkiHatasi('Belge saklama süresi dolduğu için imha edildi')

  await prisma.$transaction([
    prisma.personnelAccessLog.create({
      data: { personnelId: b.talep.personnelId, accessedBy: ctx.userId, accessType: ozel ? 'IZIN_RAPOR_BELGE' : 'IZIN_BELGE', ipAddress: ip },
    }),
    prisma.permissionAuditLog.create({
      data: { action: 'IZIN_BELGE_ACILDI', actorId: ctx.userId, targetType: 'IZIN_BELGE', targetId: b.id, details: { talepId: b.talep.id, kendi, ozelNitelikli: ozel } },
    }),
  ])
  return { icerik: belgeOku(b.dosyaAdi), mime: b.mime, ad: b.orijinalAd }
}
