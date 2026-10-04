// Excel toplu atama dosya/satır sınırları — TEK KAYNAK (C5-2).
//
// PRISMA'SIZ saf modül: sunucu (excel-atama.ts, uç doğrulamaları, şablon metni) ve istemci sayfa AYNI
// sabiti buradan okur; sınır bir yerde değişir. (excel-atama.ts prisma/pg çeker, istemciye değer olarak
// alınamaz — bkz. istemci-importlari.test.ts.)
//
// 300 satır: 63 atamalık göç + geniş pay; tek transaction'ı kısa tutar (sorgu ölçümü: C5-3).
export const EXCEL_LIMITLERI = { maksSatir: 300, maksDosyaBayt: 2 * 1024 * 1024 } as const

export const EXCEL_MAKS_MB = EXCEL_LIMITLERI.maksDosyaBayt / 1024 / 1024

/** Satır sınırı aşıldığında kullanıcıya gösterilen NET mesaj. */
export const EXCEL_SATIR_SINIRI_MESAJI =
  `Dosyada en fazla ${EXCEL_LIMITLERI.maksSatir} satır olabilir (başlık hariç). ` +
  `Dosyayı ${EXCEL_LIMITLERI.maksSatir} satırlık parçalara bölüp ayrı ayrı yükleyin.`

export const EXCEL_DOSYA_SINIRI_MESAJI = `Dosya çok büyük (en fazla ${EXCEL_MAKS_MB} MB).`
