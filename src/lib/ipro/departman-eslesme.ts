/**
 * IFS iş merkezi (WC) ↔ IFS departman eşlemesi — SAF yardımcılar (server/client fark etmez).
 *
 * İki farklı WC evreni vardır (keşifle ölçüldü):
 *  - Açık iş emirlerinde WC W-prefixlidir (WPH01, WCN02, …). Departman = HARF KÖKÜ
 *    (WPH01→WPH). WorkCenterSet.DepartmentNo KULLANILMAZ (W-prefixli WC'lerin 5'inde boş).
 *  - ipro_tezgah.ifsWorkCenterNo ise 3 haneli NUMERİK WC'dir (201, 502, …). Departman
 *    numerik aralıktan türetilir (aşağıdaki tek tablo).
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
 * ipro_tezgah.ifsWorkCenterNo (3 haneli numerik WC) → IFS departman kodu.
 *
 * Aralıklar TEK yerde tutulur (koda dağıtılmaz). Kaynak/DOĞRULAMA: IFS
 * WorkCenterHandling.svc/WorkCenterSet.DepartmentNo — numerik WC'lerde DOLU; keşifte
 * 109/109 tezgah temiz eşleşti. WC evreni büyürse yalnız bu tablo güncellenir.
 */
const TEZGAH_WC_ARALIK: ReadonlyArray<{ min: number; max: number; dept: string }> = [
  { min: 101, max: 101, dept: 'WLZ' }, // LAZER KESİM
  { min: 201, max: 212, dept: 'WPH' }, // PRESHANE
  { min: 301, max: 318, dept: 'WKY' }, // KAYNAK
  { min: 401, max: 409, dept: 'WCN' }, // CNC TALAŞLI İMALAT
  { min: 501, max: 506, dept: 'WPE' }, // PLASTİK ENJEKSİYON
  { min: 701, max: 705, dept: 'WMM' }, // MONTAJ
  { min: 751, max: 755, dept: 'WPK' }, // PAKETLEME
  { min: 90000, max: 90003, dept: 'FSN' }, // FASON
]

export function tezgahWcDepartmani(ifsWorkCenterNo: string | null | undefined): string | null {
  if (!ifsWorkCenterNo) return null
  const n = Number(ifsWorkCenterNo.trim())
  if (!Number.isInteger(n)) return null
  for (const r of TEZGAH_WC_ARALIK) {
    if (n >= r.min && n <= r.max) return r.dept
  }
  return null
}
