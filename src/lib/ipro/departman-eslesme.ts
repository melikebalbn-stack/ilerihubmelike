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

/**
 * Bir WC kodunu (operasyonun ya da tezgahın) departmana çevirir — İKİ KAYNAKLI, sırayla:
 *   1. WorkCenterSet.DepartmentNo dolu ise ONU kullan. Numerik WC'ler (501→WPE) ve
 *      DepartmentNo'su dolu W-prefixli WC'ler (WPE01→WPE) böyle çözülür.
 *   2. Boş/yoksa ad-kökü fallback'i (isEmriWcDepartmanKoku): WCN01→WCN, WMM01→WMM —
 *      bunların WorkCenterSet.DepartmentNo'su IFS'te boş, ad-kökü hâlâ gerekli.
 *   3. İkisi de çözemezse null (WYD, 90001 gibi — departmana bağlanamaz).
 *
 * NEDEN İKİSİ DE: yeni iş emirleri numerik WC'ye planlanıyor (501, DepartmentNo dolu,
 * ad-kökü ÇALIŞMAZ); eski W-prefixli planlama WC'lerinin (WMM01) DepartmentNo'su boş,
 * yalnız ad-kökü çalışır. Biri diğerinin yerine konamaz.
 *
 * wcMap: getWorkCenters() → Map<workCenterNo, departmentNo> (boş DepartmentNo'lar
 * dahil edilse de edilmese de çalışır; boş/undefined → fallback).
 */
export function wcDepartmani(
  wc: string | null | undefined,
  wcMap: Map<string, string>,
): string | null {
  if (!wc) return null
  const kod = wc.trim()
  const dept = wcMap.get(kod)
  if (dept && dept.trim()) return dept.trim()
  return isEmriWcDepartmanKoku(kod)
}
