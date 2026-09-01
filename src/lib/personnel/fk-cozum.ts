import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'

/**
 * FAZ 1 · ÇİFT YAZIM — metin alanlarından FK türetme. TEK KAYNAK.
 *
 * `Personnel.bolum` / `birimSorumlusu` / `sorumlu2` / `sorumlu3` serbest METİN olarak
 * YAZILMAYA DEVAM EDER; bu yardımcı yalnız yanlarına FK'ları doldurur. Okuma tarafı
 * (311 satır, 11 yetki noktası) bu turda DEĞİŞMEDİ — hepsi hâlâ metinden okuyor.
 *
 * KURALLAR (backfill migration'ıyla birebir aynı olmalı, yoksa yeni kayıtlar
 * eskilerden farklı bağlanır):
 *   · bölüm    : DepartmentDefinition.name ile BİREBİR eşleşme (normalize YOK)
 *   · sorumlu  : Personnel.adSoyad ile birebir + `aktif = true` ZORUNLU
 *                (7 isimde pasif mükerrer kayıt var; filtre olmadan FK pasife bağlanır)
 *
 * ÇÖZÜLEMEZSE: FK null kalır, METİN yazılır, uyarı loglanır. Kayıt ASLA reddedilmez —
 * Excel import ve Azure AD senkronu dışarıdan serbest metin getiriyor ve bir ad
 * tutmadı diye personel kaydının açılmaması kabul edilemez.
 */

type DbClient = Prisma.TransactionClient | typeof prisma

export interface PersonelMetinAlanlari {
  bolum?: string | null
  birimSorumlusu?: string | null
  sorumlu2?: string | null
  sorumlu3?: string | null
}

export interface PersonelFkAlanlari {
  departmentId?: string | null
  sorumlu1Id?: string | null
  sorumlu2Id?: string | null
  sorumlu3Id?: string | null
}

function temiz(v: string | null | undefined): string {
  return (v ?? '').trim()
}

export async function bolumFkCoz(db: DbClient, bolum: string | null | undefined): Promise<string | null> {
  const ad = temiz(bolum)
  if (!ad) return null
  const d = await db.departmentDefinition.findFirst({ where: { name: ad }, select: { id: true } })
  if (!d) {
    console.warn(`[personnel-fk] bölüm çözülemedi: "${ad}" — departmentId null, metin korunuyor`)
    return null
  }
  return d.id
}

export async function sorumluFkCoz(
  db: DbClient,
  ad: string | null | undefined,
  haricId?: string | null,
): Promise<string | null> {
  const isim = temiz(ad)
  if (!isim) return null
  const p = await db.personnel.findFirst({
    where: { adSoyad: isim, aktif: true, ...(haricId ? { id: { not: haricId } } : {}) },
    select: { id: true },
  })
  if (!p) {
    console.warn(`[personnel-fk] sorumlu çözülemedi: "${isim}" — FK null, metin korunuyor`)
    return null
  }
  return p.id
}

/**
 * Verilen metin alanları için FK karşılıklarını üretir. Yalnız GÖNDERİLEN alanlar
 * için anahtar döner — kısmi güncellemede (PATCH/PUT) dokunulmayan alanın FK'sı
 * sıfırlanmasın diye.
 */
export async function personelFkAlanlari(
  db: DbClient,
  metin: PersonelMetinAlanlari,
  kendiId?: string | null,
): Promise<PersonelFkAlanlari> {
  const out: PersonelFkAlanlari = {}
  if (metin.bolum !== undefined) out.departmentId = await bolumFkCoz(db, metin.bolum)
  if (metin.birimSorumlusu !== undefined) out.sorumlu1Id = await sorumluFkCoz(db, metin.birimSorumlusu, kendiId)
  if (metin.sorumlu2 !== undefined) out.sorumlu2Id = await sorumluFkCoz(db, metin.sorumlu2, kendiId)
  if (metin.sorumlu3 !== undefined) out.sorumlu3Id = await sorumluFkCoz(db, metin.sorumlu3, kendiId)
  return out
}
