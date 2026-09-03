import { prisma } from '@/lib/prisma'
import { isIvBolumuFk } from '@/lib/auth/iv-bolum-fk'
import { getManagedPersonnelIds } from './approvers'

export type BulkCardScanAccessLevel = 'NONE' | 'FULL' | 'GRI' | 'SELF'

export interface BulkCardScanAccess {
  level: BulkCardScanAccessLevel
  personnelId: string | null
  /** Personel Yönetimi'ndeki Personnel.bolum değeri (görüntüleme amaçlı). */
  bolum: string | null
  /**
   * GRİ kapsamının HAZIR personel listesi — yalnız BÖLÜM HESAPLARINDA dolu.
   * Kişiye bağlı normal kullanıcılarda null'dır ve kapsam eskisi gibi çağrı
   * anında getManagedPersonnelIds(personnelId) ile çözülür (davranış değişmedi).
   * Bölüm hesabının Personnel kaydı olmadığı için o yol boş dönerdi; kapsam
   * bunun yerine BulkCardScanBolumYetki.bolumAdi'den önceden çözülüp buraya konur.
   */
  scopePersonnelIds: string[] | null
}

// Eskiden FULL veren roller — ARTIK FULL VERMEZ (Melih kararı). İV-dışıysa org
// şemasına iner: sorumluysa GRİ, değilse SELF.
const DEMOTE_ROLES = ['SUPER_ADMIN', 'ADMIN']

/**
 * Kart Okutamama yetki seviyesi — görünürlük ORGANİZASYON ŞEMASINDAN gelir:
 *   - İnsan Varlıkları (isInsanVarliklari) -> FULL (tüm fabrika: Eski Kayıtlar, bulk,
 *     İV onayı, sorumsuz/orphan kararı). SUPER_ADMIN/ADMIN ROLÜ FABRİKA GÖRÜNÜRLÜĞÜ VERMEZ.
 *   - MAVI -> NONE (forma hiç erişemez — ama başkasının kaydına konu olabilir).
 *   - İV-dışı SUPER_ADMIN/ADMIN -> sorumluysa (getManagedPersonnelIds > 0) GRİ (ekip),
 *     değilse SELF (yalnız kendi). Rol artık en fazla GRİ/SELF'e iner.
 *   - GRİ yaka -> GRI · BEYAZ yaka -> SELF. Her ikisi kendi adına girer + sorumlusu
 *     olduğu ekip için açabilir; GRI/SELF ayrımı Excel import gibi ikincil farklar içindir.
 */
export async function getBulkCardScanAccess(userId: string): Promise<BulkCardScanAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      personnelId: true,
      personnel: { select: { id: true, yakaRengi: true, bolum: true, departmentId: true } },
    },
  })

  const yakaRengi = user?.personnel?.yakaRengi
  const personnelId = user?.personnel?.id ?? null
  const bolum = user?.personnel?.bolum ?? null

  // Fabrika görünürlüğü YALNIZ İnsan Varlıkları'ndan gelir (rol DEĞİL).
  // FAZ 3a: karar Personnel.departmentId FK'sından; FK boşsa eski normalize yolu.
  if (await isIvBolumuFk(user?.personnel?.departmentId, bolum)) {
    return { level: 'FULL', personnelId, bolum, scopePersonnelIds: null }
  }
  // MAVI -> forma erişemez.
  if (yakaRengi === 'MAVI') {
    return { level: 'NONE', personnelId, bolum, scopePersonnelIds: null }
  }
  // İV-dışı SUPER_ADMIN/ADMIN: eskiden rolle FULL'du; artık org şemasına iner —
  // sorumluysa ekibini (GRİ), değilse yalnız kendini (SELF). Personnel kaydı şart.
  if (user && DEMOTE_ROLES.includes(user.role) && personnelId) {
    const managed = await getManagedPersonnelIds(personnelId)
    return { level: managed.length > 0 ? 'GRI' : 'SELF', personnelId, bolum, scopePersonnelIds: null }
  }
  if (yakaRengi === 'GRI' && personnelId) {
    return { level: 'GRI', personnelId, bolum, scopePersonnelIds: null }
  }
  if (yakaRengi === 'BEYAZ' && personnelId) {
    return { level: 'SELF', personnelId, bolum, scopePersonnelIds: null }
  }

  // BÖLÜM HESABI — Personnel bağı YOK (paylaşımlı hesap: Bakımhane, Final Kalite,
  // Preshane...). Kişiye bağlı GRİ kapsamı bu hesaplarda hiç doğmaz (adSoyad'ı
  // kimsenin 1./2./3. Sorumlu alanında geçmez), o yüzden kapsam bölüm adından
  // çözülüp scopePersonnelIds ile taşınır. Seviye GRİ: bölüm hesabı yalnız
  // kapsamındaki kişiler için kayıt girer, fabrika geneli görünürlüğü YOKTUR.
  if (!personnelId) {
    const yetki = await prisma.bulkCardScanBolumYetki.findUnique({
      where: { userId },
      select: { bolumAdi: true },
    })
    if (yetki) {
      return {
        level: 'GRI',
        personnelId: null,
        bolum: yetki.bolumAdi,
        scopePersonnelIds: await bolumPersonelleri(yetki.bolumAdi),
      }
    }
  }

  // Personnel kaydı/yakaRengi hiç yok -> erişim yok.
  return { level: 'NONE', personnelId, bolum, scopePersonnelIds: null }
}

/**
 * Bölüm adının kapsadığı AKTİF personel id'leri.
 *
 * bolum VEYA bolumDetay ile tam eşleşme (büyük/küçük harf duyarsız): "Bakımhane"
 * ve "Preshane" gerçek bolum değerleridir, ama Kalite kırılımları ("FİNAL KALİTE",
 * "PROSES KALİTE") YALNIZ bolumDetay'da yaşar — o kişilerin bolum'u hepsi için
 * "Kalite Müdürlüğü"dür, dolayısıyla tek başına bolum eşleşmesi Kalite hesaplarına
 * sıfır kişi verirdi.
 *
 * Tam eşleşme bilinçli: "PROSES KALİTE OPERATÖRÜ" yazılı tek kayıt (görevi FİNAL
 * KALİTE OPERATÖRÜ) hangi kırılıma ait belirsiz olduğu için kapsam DIŞINDA kalır —
 * prefix eşleşmesi onu yanlış bölüme sokardı. Veri İV tarafından düzeltilince
 * kendiliğinden kapsama girer.
 */
async function bolumPersonelleri(bolumAdi: string): Promise<string[]> {
  const kayitlar = await prisma.personnel.findMany({
    where: {
      aktif: true,
      OR: [
        { bolum: { equals: bolumAdi, mode: 'insensitive' } },
        { bolumDetay: { equals: bolumAdi, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  })
  return kayitlar.map((k) => k.id)
}
