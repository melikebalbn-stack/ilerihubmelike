/**
 * Bölüm → ÜST DEPARTMAN çözümü. Sunucu tarafı, saf hesap (DB erişimi çağıranda).
 *
 * Kural: bölümün kendi OrgUnit kutusundan başlayıp zincirde YUKARI yürünür ve
 * ilk DEPARTMENT tipli kutu döndürülür. Kutunun KENDİSİ hariçtir — aksi hâlde
 * her müdürlük kendi üstü olurdu (kutular DEPARTMENT tipli).
 *
 * DIŞLANANLAR (koltuk-eslesme.ts / pozisyon-secenekleri.ts ile aynı aile):
 *   ORG-KR-*  kurul/komite birimleri — ek görev yapıları, hiyerarşi değil
 *   ORG-TF    kök ayna ağaç ("İleri Group (Tüm Firma)") — her şeyin üstü,
 *             grup başlığı olarak anlamsız
 *
 * orgUnitId null ise sonuç null (çağıran "şemada tanımsız" grubuna koyar).
 */

const MAX_DERINLIK = 15
const KURUL_ONEKI = "ORG-KR-"
const KOK_KODU = "ORG-TF"

export interface UstDepartman {
  code: string
  name: string
}

/** Zincir yürüyüşü için gereken asgari kutu alanları. */
export interface KutuDugumu {
  id: string
  code: string
  name: string
  parentId: string | null
  unitType: string
}

/**
 * @param orgUnitId bölümün kendi kutusu (null ise null döner)
 * @param byId      tüm kutuların id haritası
 */
export function ustDepartmanBul(
  orgUnitId: string | null | undefined,
  byId: Map<string, KutuDugumu>,
): UstDepartman | null {
  if (!orgUnitId) return null
  const baslangic = byId.get(orgUnitId)
  if (!baslangic) return null

  // KENDİSİNDEN DEĞİL, ebeveyninden başla.
  let cur = baslangic.parentId ? byId.get(baslangic.parentId) : undefined
  for (let i = 0; i < MAX_DERINLIK && cur; i++) {
    if (
      cur.unitType === "DEPARTMENT" &&
      !cur.code.startsWith(KURUL_ONEKI) &&
      cur.code !== KOK_KODU
    ) {
      return { code: cur.code, name: cur.name }
    }
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return null
}
