import type { ZimmetTuru } from '@/generated/prisma'

// Gerçek Syteline verisinin (200 kayıt) doluluk analizine dayanıyor - hangi
// türde hangi alan %95+ doluysa o zorunlu. Zimmet Sahibi ve Tür HER türde
// zaten zorunlu (ayrı, sabit kontrol - bu tabloda değil, bkz. useZimmetFormu.ts
// ve route.ts). Açıklama HİÇBİR türde zorunlu değil (LOGO ürünlerinde %0 dolu).
// MAC Adresi/PC Adı/Marka/Model/Alt Zimmet Sahibi de hiçbir türde zorunlu
// değil (bilinçli karar, %70-76 doluluk yeterli görülmedi).
//
// turDiger sadece DIGER (Yazılım) türünde zorunlu - "Yazılım" seçilip hangi
// yazılım olduğu (bkz. tur.ts ZIMMET_YAZILIM_SECENEKLERI) belirtilmezse
// anlamsız bir kayıt olur.
//
// Wizard (Türkçe etiket) + Düzenle dialogu (zaten enum) + sunucu (route.ts,
// preview-pdf/route.ts, [id]/route.ts PATCH) HEPSİ bu TEK tablodan geçer.
export type ZimmetZorunluAlanKey = 'seriNumarasi' | 'ozellik' | 'imeiNumarasi' | 'turDiger'

export const ZIMMET_ZORUNLU_ALAN_ETIKET: Record<ZimmetZorunluAlanKey, string> = {
  seriNumarasi: 'Seri numarası',
  ozellik: 'Özellik',
  imeiNumarasi: 'IMEI Numarası',
  turDiger: 'Hangi yazılım',
}

const TUR_ZORUNLU_ALANLAR: Record<ZimmetTuru, ZimmetZorunluAlanKey[]> = {
  NOTEBOOK_BILGISAYAR: ['seriNumarasi', 'ozellik'],
  DESKTOP_BILGISAYAR: ['seriNumarasi', 'ozellik'],
  CEP_TELEFONU: ['seriNumarasi', 'imeiNumarasi'],
  EL_TERMINALI: ['seriNumarasi'],
  YAZICI: ['seriNumarasi'],
  OFFICE_365: ['seriNumarasi'],
  DIGER: ['seriNumarasi', 'turDiger'], // "Yazılım" (bkz. tur.ts)
  MONITOR: ['seriNumarasi'],
  MIKROFON: ['seriNumarasi'],
}

// `tur` gevşek (plain string) tipte - çağıran taraflar (wizard'ın Türkçe
// etiketi enum'a çevirdikten sonra, Düzenle dialogunun zaten enum olan
// z.tur'u, API body'sindeki ham string) hepsi cast'siz kullanabilsin diye.
export function zorunluAlanlar(tur: string): ZimmetZorunluAlanKey[] {
  if (!tur) return []
  return TUR_ZORUNLU_ALANLAR[tur as ZimmetTuru] ?? ['seriNumarasi']
}

// Verilen tür + alan değerlerine göre EKSİK zorunlu alanların Türkçe
// etiketlerini döndürür. `degerler` en azından zorunlu-olabilecek alan
// adlarını (seriNumarasi/ozellik/imeiNumarasi/turDiger) taşıyan herhangi bir
// nesne olabilir (ZimmetFormuStep1Data, DuzenleFormData, API body'si vb.).
export function zimmetEksikAlanlar(
  tur: string,
  degerler: Partial<Record<ZimmetZorunluAlanKey, string | null | undefined>>
): string[] {
  return zorunluAlanlar(tur)
    .filter((key) => !degerler[key]?.trim())
    .map((key) => ZIMMET_ZORUNLU_ALAN_ETIKET[key])
}
