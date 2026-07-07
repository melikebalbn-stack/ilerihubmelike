// F13.37 Sağlık Beyan Formu (26 madde) + F13.56 Astım Anketi içeriği.
// NOT: Astım soru metinleri ECRHS standardı temel alınarak yazıldı; F13.56 xlsx ile
// birebir doğrulanmalı (metinler oradan gelecekse güncellenir).

export interface SaglikMaddesi {
  itemNo: number;
  itemLabel: string;
}

export const F13_37 = {
  documentCode: "F13.37",
  baslik: "Sağlık Beyan Formu",
  // 1-25: VAR/YOK, 26: EVET/HAYIR (ameliyat).
  maddeler: [
    { itemNo: 1, itemLabel: "DOĞUŞTAN GELEN HASTALIK (DOĞUŞTAN BERİ OLAN HASTALIK)" },
    { itemNo: 2, itemLabel: "KALITSAL HASTALIK (AİLEDEN GELEN HASTALIKLAR)" },
    { itemNo: 3, itemLabel: "UZUV KAYBI (EL, AYAK, PARMAK, KULAK, BURUN, CİNSEL ORGAN vb.)" },
    { itemNo: 4, itemLabel: "KALP HASTALIĞI (KALP KAPAK HASTALIĞI, KALP DAMAR HASTALIĞI vb.)" },
    { itemNo: 5, itemLabel: "TANSİYON HASTALIĞI (HİPERTANSİYON, TANSİYON DÜŞÜKLÜĞÜ vb.)" },
    { itemNo: 6, itemLabel: "ŞEKER HASTALIĞI (DİYABET)" },
    { itemNo: 7, itemLabel: "BÖBREK HASTALIĞI (BÖBREK TAŞI, KİST, TEK BÖBREK, YETERSİZLİK vb.)" },
    { itemNo: 8, itemLabel: "EPİLEPSİ HASTALIĞI (SARA HASTALIĞI)" },
    { itemNo: 9, itemLabel: "BAŞ DÖNMESİ İLE İLGİLİ HASTALIKLAR (VERTİGO, MENİERE HAST. vb.)" },
    { itemNo: 10, itemLabel: "SİNİR SİSTEMİ HASTALIĞI (MİGREN, MS, TÜMÖR vb.)" },
    { itemNo: 11, itemLabel: "PSİKOLOJİK HASTALIK (DEPRESYON, PANİK ATAK, ŞİZOFRENİ vb.)" },
    { itemNo: 12, itemLabel: "DERİ HASTALIĞI (DÖKÜNTÜLÜ DERİ, SEDEF, EGZAMA vb.)" },
    { itemNo: 13, itemLabel: "HORMONAL BOZUKLUKLAR VE HASTALIKLAR (GUATR, HİPOTİROİDİ vb.)" },
    { itemNo: 14, itemLabel: "GÖRME BOZUKLUĞU (MİYOP, HİPERMETROP, ASTİGMAT vb.)" },
    { itemNo: 15, itemLabel: "DUYMA BOZUKLUĞU (İŞİTME AZLIĞI, SÜREKLİ ÇINLAMA, UĞULTU vb.)" },
    { itemNo: 16, itemLabel: "ALERJİ ve/veya ALERJİK HASTALIKLAR" },
    { itemNo: 17, itemLabel: "BULAŞICI HASTALIK (PARAZİT HASTALIKLARI, MANTAR ENFEKSİYONU vb.)" },
    { itemNo: 18, itemLabel: "SARILIK (HEPATİT) (Hepatit A, Hepatit B, Hepatit C vb.)" },
    { itemNo: 19, itemLabel: "AIDS HASTALIĞI (HIV)" },
    { itemNo: 20, itemLabel: "TÜBERKÜLOZ HASTALIĞI (VEREM)" },
    { itemNo: 21, itemLabel: "KORKU (YÜKSEKLİK KORKUSU, KAPALI ALAN KORKUSU vb.)" },
    { itemNo: 22, itemLabel: "SİGARA KULLANIMI" },
    { itemNo: 23, itemLabel: "FİZİKSEL ENGEL" },
    { itemNo: 24, itemLabel: "SÜREKLİ KULLANILAN İLAÇ" },
    { itemNo: 25, itemLabel: "MADDE BAĞIMLILIĞI" },
    { itemNo: 26, itemLabel: "HİÇ AMELİYAT OLDUNUZ MU?" },
  ] as SaglikMaddesi[],
  AMELIYAT_ITEM_NO: 26,
  gecmisHastalikNotuLabel:
    "Daha önce bu ya da buna benzer hastalıklar geçirdiyseniz belirtiniz",
  ameliyatNotuLabel: "Hangi ameliyatı oldunuz?",
  beyan:
    "Yukarıdaki bilgileri okudum, anladım ve onay kutularını kendim işaretledim. Var olan hastalıklarımı bilgim dahilinde belirttim. Bu bilgilerin doğruluğunu kabul ve beyan ederim.",
} as const;

export const F13_56 = {
  documentCode: "F13.56",
  baslik: "Astım Değerlendirme Anketi",
  ustNot:
    'SORULARI CEVAPLAMAK İÇİN UYGUN KUTUYA İŞARET KOYUNUZ. EĞER CEVAPTAN EMİN DEĞİLSENİZ "HAYIR" KUTUSUNU İŞARETLEYİNİZ.',
  telefonAciklama:
    "Evde ya da işyeri ortamındayken İş Sağlığı Birimi tarafından size telefon ile ulaşabilmemiz için telefon numaranızı yazınız.",
  sorular: [
    { key: "astimSoru1", no: "1", metin: "Son 12 ayda göğsünüzde hırıltılı ya da hışıltılı bir durum yaşadınız mı?" },
    { key: "astimSoru1_1", no: "1.1", parent: "astimSoru1", metin: "Hırıltılı solunum varken nefes darlığı yaşadığınız oldu mu?" },
    { key: "astimSoru1_2", no: "1.2", parent: "astimSoru1", metin: "Hırıltılı ve hışıltılı solunumu soğuk algınlığı, grip vb. durum dışında mı yaşadınız?" },
    { key: "astimSoru2", no: "2", metin: "Son 12 ay içerisinde herhangi bir zamanda göğsünüzde sıkışma ile uyandığınız oldu mu?" },
    { key: "astimSoru3", no: "3", metin: "Son 12 ay içerisinde herhangi bir zamanda nefes darlığı atağı yaşadınız mı?" },
    { key: "astimSoru4", no: "4", metin: "Son 12 ay içerisinde herhangi bir zamanda öksürük atağı yaşadınız mı?" },
    { key: "astimSoru5", no: "5", metin: "Son 12 ay içerisinde astım atağı yaşadınız mı?" },
    { key: "astimSoru6", no: "6", metin: "Şu anda astım ile ilgili bir ilaç (inhaler, aerosol veya tablet) kullanıyor musunuz?" },
    { key: "astimSoru7", no: "7", metin: "Saman nezlesi de dahil olmak üzere nasal alerjiniz var mı?" },
  ] as const,
  // Ana sorular (koşulsuz cevaplanması beklenen 7 soru).
  anaSoruKeys: [
    "astimSoru1",
    "astimSoru2",
    "astimSoru3",
    "astimSoru4",
    "astimSoru5",
    "astimSoru6",
    "astimSoru7",
  ] as const,
} as const;
