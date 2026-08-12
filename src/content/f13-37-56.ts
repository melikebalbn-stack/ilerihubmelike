// F13.37 Sağlık Beyan Formu (26 madde) + F13.56 Astım Anketi içeriği.
// NOT: Astım soru metinleri ECRHS standardı temel alınarak yazıldı; F13.56 xlsx ile
// birebir doğrulanmalı (metinler oradan gelecekse güncellenir).
//
// 2026-08 — YAZIM DÜZENİ: madde/soru metinleri TAMAMI-BÜYÜK yazımdan cümle düzenine
// alındı (okunabilirlik; tamamı büyük metin uzun listede yorucu). Düzeltme ELLE yapıldı,
// programatik dönüşüm KULLANILMADI — özel adlar ("Hepatit A/B/C", "AIDS", "HIV", "MS")
// ve kısaltmalar korunacaktı. Madde numaraları, key'ler, parent ilişkileri ve
// itemNo/no değerleri DEĞİŞMEDİ; astım sorularının KELİMELERİ de değişmedi.

export interface SaglikMaddesi {
  itemNo: number;
  itemLabel: string;
}

export const F13_37 = {
  documentCode: "F13.37",
  baslik: "Sağlık Beyan Formu",
  // 1-25: VAR/YOK, 26: EVET/HAYIR (ameliyat).
  maddeler: [
    { itemNo: 1, itemLabel: "Doğuştan gelen hastalık (doğuştan beri olan hastalık)" },
    { itemNo: 2, itemLabel: "Kalıtsal hastalık (aileden gelen hastalıklar)" },
    { itemNo: 3, itemLabel: "Uzuv kaybı (el, ayak, parmak, kulak, burun, cinsel organ vb.)" },
    { itemNo: 4, itemLabel: "Kalp hastalığı (kalp kapak hastalığı, kalp damar hastalığı vb.)" },
    { itemNo: 5, itemLabel: "Tansiyon hastalığı (hipertansiyon, tansiyon düşüklüğü vb.)" },
    { itemNo: 6, itemLabel: "Şeker hastalığı (diyabet)" },
    { itemNo: 7, itemLabel: "Böbrek hastalığı (böbrek taşı, kist, tek böbrek, yetersizlik vb.)" },
    { itemNo: 8, itemLabel: "Epilepsi hastalığı (sara hastalığı)" },
    { itemNo: 9, itemLabel: "Baş dönmesi ile ilgili hastalıklar (vertigo, Meniere hast. vb.)" },
    { itemNo: 10, itemLabel: "Sinir sistemi hastalığı (migren, MS, tümör vb.)" },
    { itemNo: 11, itemLabel: "Psikolojik hastalık (depresyon, panik atak, şizofreni vb.)" },
    { itemNo: 12, itemLabel: "Deri hastalığı (döküntülü deri, sedef, egzama vb.)" },
    { itemNo: 13, itemLabel: "Hormonal bozukluklar ve hastalıklar (guatr, hipotiroidi vb.)" },
    { itemNo: 14, itemLabel: "Görme bozukluğu (miyop, hipermetrop, astigmat vb.)" },
    { itemNo: 15, itemLabel: "Duyma bozukluğu (işitme azlığı, sürekli çınlama, uğultu vb.)" },
    { itemNo: 16, itemLabel: "Alerji ve/veya alerjik hastalıklar" },
    { itemNo: 17, itemLabel: "Bulaşıcı hastalık (parazit hastalıkları, mantar enfeksiyonu vb.)" },
    { itemNo: 18, itemLabel: "Sarılık (hepatit) (Hepatit A, Hepatit B, Hepatit C vb.)" },
    { itemNo: 19, itemLabel: "AIDS hastalığı (HIV)" },
    { itemNo: 20, itemLabel: "Tüberküloz hastalığı (verem)" },
    { itemNo: 21, itemLabel: "Korku (yükseklik korkusu, kapalı alan korkusu vb.)" },
    { itemNo: 22, itemLabel: "Sigara kullanımı" },
    { itemNo: 23, itemLabel: "Fiziksel engel" },
    { itemNo: 24, itemLabel: "Sürekli kullanılan ilaç" },
    { itemNo: 25, itemLabel: "Madde bağımlılığı" },
    { itemNo: 26, itemLabel: "Hiç ameliyat oldunuz mu?" },
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
    'Soruları cevaplamak için uygun kutuya işaret koyunuz. Eğer cevaptan emin değilseniz "Hayır" kutusunu işaretleyiniz.',
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
