// KPI-AYAR: OrgUnit (departman) id'sinden Personnel.bolum (serbest metin) değerine eşleme.
// Personnel.bolum bir foreign key değil, Excel/manuel girilmiş serbest metin olduğu için
// otomatik/regex eşleşme güvenilir değil — bu yüzden az sayıdaki departman burada elle eşleniyor.
export const ORG_UNIT_TO_PERSONNEL_BOLUM: Record<string, string> = {
  cmrzg1kr600037jpe4ge6rxe0: 'İNSAN VARLIKLARI', // İnsan Varlıkları Müdürlüğü
  cmrzg1kup000i7jpeege0uc78: 'FABRİKA MÜDÜRLÜĞÜ', // Fabrika Müdürlüğü
  cmrzg1l0g001i7jpexkgmb3f7: 'SATINALMA MÜDÜRLÜĞÜ', // Satınalma Müdürlüğü
  cmrzg1l1p001q7jpeqj1dd01i: 'FİNANS MUHASEBE MÜDÜRLÜĞÜ', // Finans-Muhasebe Müdürlüğü
  cmrzg1l2r001x7jpebx1fm5jm: 'MÜHENDİSLİK', // Mühendislik Müdürlüğü
  cmrzg1l4d00287jpe3ort8myn: 'KALİTE MÜDÜRLÜĞÜ', // Kalite Müdürlüğü
  cmrzg1l6y002q7jpesqm4devm: 'SATIŞ VE PAZ.MÜDÜRLÜĞÜ', // Satış & Pazarlama Müdürlüğü
  cmrzg1l9000327jpeg1oh7j5o: 'ASANSÖR', // Asansör Müdürlüğü
  cmrzg1lab003a7jpeenylrpv4: 'SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ', // Sistem Geliştirme Müdürlüğü
}
