// Depo Terminali — mock veri (EL-2). EL-3b sonrası liste/detay GERÇEK IFS'ten geliyor;
// bu dosya artık KULLANILMIYOR, yalnız referans/örnek olarak duruyor.
//
// DepoStokKaydi tipi gerçek sözleşme olarak src/lib/ifs/depo-stok.ts'e taşındı;
// buradan import edilir (import type → server-only runtime guard tetiklenmez).
import type { DepoStokKaydi, StokKimlik } from '@/lib/ifs/depo-stok'

export interface DepoRaf {
  kod: string
  ad: string
}

export const MOCK_RAFLAR: DepoRaf[] = [
  { kod: 'RFA10B5', ad: 'A Blok · Koridor 10 · Göz B5' },
  { kod: 'RFA10B6', ad: 'A Blok · Koridor 10 · Göz B6' },
  { kod: 'RFB02C1', ad: 'B Blok · Koridor 02 · Göz C1' },
  { kod: 'RFB02C2', ad: 'B Blok · Koridor 02 · Göz C2' },
  { kod: 'RFC01A1', ad: 'C Blok · Koridor 01 · Göz A1' },
  { kod: 'RFC01A2', ad: 'C Blok · Koridor 01 · Göz A2' },
]

// 10-anahtar kimlik üreteci (mock — gerçekçi IFS varsayılanları).
const k = (partNo: string, locationNo: string, lotBatchNo = '*'): StokKimlik => ({
  contract: 'ILER2',
  partNo,
  configurationId: '*',
  locationNo,
  lotBatchNo,
  serialNo: '*',
  engChgLevel: '*',
  waivDevRejNo: '*',
  activitySeq: 0,
  handlingUnitId: 0,
})

export const MOCK_STOK: DepoStokKaydi[] = [
  { stokKodu: '21970032', stokAdi: '', lot: 'L26-0341', miktar: 400, birim: 'ad', kimlik: k('21970032', '40', 'L26-0341') },
  { stokKodu: '31450027', stokAdi: '', miktar: 120, birim: 'ad', kimlik: k('31450027', '40') },
  { stokKodu: '21970029', stokAdi: '', lot: 'L26-0355', miktar: 250, birim: 'ad', kimlik: k('21970029', '61', 'L26-0355') },
]
