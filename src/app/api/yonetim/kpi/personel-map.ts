// KPI-AYAR: departmanın OrgUnit **kodundan** (id'sinden DEĞİL — id her veritabanında
// farklı üretilir, kod sabit kalır; bu yüzden bu eşleştirme prod'da da çalışır)
// Personnel.bolum (serbest metin) değerine eşleme.
// Personnel.bolum bir foreign key değil, Excel/manuel girilmiş serbest metin olduğu için
// otomatik/regex eşleşme güvenilir değil — bu yüzden az sayıdaki departman burada elle eşleniyor.
export const ORG_UNIT_CODE_TO_PERSONNEL_BOLUM: Record<string, string> = {
  'ORG-TF-P0001': 'İNSAN VARLIKLARI', // İnsan Varlıkları Müdürlüğü
  'ORG-TF-P0016': 'FABRİKA MÜDÜRLÜĞÜ', // Fabrika Müdürlüğü
  'ORG-TF-P0052': 'SATINALMA MÜDÜRLÜĞÜ', // Satınalma Müdürlüğü
  'ORG-TF-P0060': 'FİNANS MUHASEBE MÜDÜRLÜĞÜ', // Finans-Muhasebe Müdürlüğü
  'ORG-TF-P0067': 'MÜHENDİSLİK', // Mühendislik Müdürlüğü
  'ORG-TF-P0078': 'KALİTE MÜDÜRLÜĞÜ', // Kalite Müdürlüğü
  'ORG-TF-P0096': 'SATIŞ VE PAZ.MÜDÜRLÜĞÜ', // Satış & Pazarlama Müdürlüğü
  'ORG-TF-P0108': 'ASANSÖR', // Asansör Müdürlüğü
  'ORG-TF-P0116': 'SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ', // Sistem Geliştirme Müdürlüğü
}
