/**
 * IFS iş merkezi (WC) ↔ IFS departman eşlemesi — SAF yardımcılar (server/client fark etmez).
 *
 * ipro_tezgah.ifsWorkCenterNo → departman eşlemesi ARTIK IFS WorkCenterSet'ten CANLI gelir
 * (bkz. work-center-departments.ts:getWorkCenters + page.tsx'te Map<workCenterNo,departmentNo>).
 * Eski sabit aralık tablosu (201-212→WPH …) KALDIRILDI: IFS WC kodları yeniden numaralandı
 * (89→67, aralıklar kaydı) ve tekrar kayacak; sabit tablo geçersizdi.
 *
 * Bu dosyada YALNIZ açık-iş-emri WC kökü kaldı: onun kaynağı ShopOrderOperations.WorkCenterNo'dur
 * (W-prefixli, WPH01…) ve W-prefixli planlama WC'lerinin DepartmentNo'su IFS'te tutarsız/boş
 * olduğundan harf-kökü türetmesi hâlâ gerekli.
 */

/**
 * Açık iş emri WC kodundan departman kökü. W-prefixli koddan sondaki haneleri atar:
 *   WPH01 → WPH, WCN02 → WCN. Sondaki hane yoksa (WYD) veya harf kökü yoksa (502, 90001)
 *   → null (departmana bağlanamaz). Dönen kökün geçerli bir departman olup olmadığı
 *   ÇAĞIRAN tarafça (IFS'ten gelen gerçek departman listesiyle) doğrulanır.
 */
export function isEmriWcDepartmanKoku(wc: string | null | undefined): string | null {
  if (!wc) return null
  const m = /^([A-Z]+)\d+$/.exec(wc.trim())
  return m ? m[1] : null
}
