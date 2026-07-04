export const BOLUMLER = [
  "ASANSÖR",
  "ASANSÖR SATIŞ PAZARLAMA",
  "BAKIMHANE",
  "BÜRO MEMURU",
  "DEPO",
  "FABRİKA MÜDÜRLÜĞÜ",
  "FİNANS MUHASEBE MÜDÜRLÜĞÜ",
  "GENEL MÜDÜRLÜK",
  "İDARİ İŞLER",
  "İNSAN VARLIKLARI",
  "KALIPHANE",
  "KALİTE MÜDÜRLÜĞÜ",
  "KAYNAKHANE",
  "LAZER & DAİRE TESTERE",
  "MEKANİK BAKIM",
  "MEKANİK MONTAJ",
  "MEKATRONİK",
  "MÜHENDİSLİK",
  "PAKETLEME & DİREKSİYON",
  "PLASTİK ENJEKSİYON",
  "PRESHANE",
  "PROTOTİP ATÖLYE",
  "SATINALMA MÜDÜRLÜĞÜ",
  "SATIŞ VE PAZ.MÜDÜRLÜĞÜ",
  "SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ",
  "TALAŞLI İMALAT",
  "YATIRIM VE TEŞVİK",
  "YENİ İŞ GELİŞTİRME",
]

export const GOREVLER_ORNEK = [
  // Beyaz yaka
  "BT Müdürü", "Sistem Geliştirme Mühendisi", "Kalite Müdürü",
  "Üretim Müdürü", "Fabrika Müdürü", "Genel Müdür Yardımcısı",
  // Mavi yaka
  "Kaynak Operatörü", "CNC Operatörü", "Lazer Operatörü",
  "Montaj Operatörü", "Boyacı", "Depo Sorumlusu",
]

export const KAN_GRUBU_LABELS: Record<string, string> = {
  A_POSITIVE: "A Rh+",
  A_NEGATIVE: "A Rh-",
  B_POSITIVE: "B Rh+",
  B_NEGATIVE: "B Rh-",
  AB_POSITIVE: "AB Rh+",
  AB_NEGATIVE: "AB Rh-",
  O_POSITIVE: "0 Rh+",
  O_NEGATIVE: "0 Rh-",
}

export const CINSIYET_LABELS: Record<string, string> = {
  MALE: "Erkek",
  FEMALE: "Kadın",
}

export const YAKA_LABELS: Record<string, string> = {
  MAVI: "Mavi Yaka",
  BEYAZ: "Beyaz Yaka",
  GRI: "Gri Yaka",
}

// Yaka Aşama 1: yakaDetayi (yönetici kademesi) tam Türkçe gösterim.
export const YAKA_DETAYI_LABELS: Record<string, string> = {
  BEYAZ: "Beyaz",
  BEYAZ_GMUDUR_YRD: "Beyaz-G.Müdür Yrd.",
  BEYAZ_GENEL_MDR: "Beyaz-Genel Müdür",
  BEYAZ_MUDUR: "Beyaz-Müdür",
  BEYAZ_MUDUR_YRD: "Beyaz-Müdür Yrd.",
  BEYAZ_MUHENDIS: "Beyaz-Mühendis",
  BEYAZ_MUHENDIS_MDRYRD: "Beyaz-Mühendis (Mdr.Yrd.)",
  BEYAZ_MUHENDIS_MUDUR: "Beyaz-Mühendis-Müdür",
  BEYAZ_SORUMLU_TEKNIKER: "Beyaz-Sorumlu Tekniker",
  BEYAZ_TEKNIKER: "Beyaz-Tekniker",
  GRI: "Gri",
  GRI_VEKALET: "Gri-Vekalet",
  MAVI: "Mavi",
}

// Yaka Aşama 1: yakaRengi → izin verilen yakaDetayi değerleri (dropdown filtresi + backend
// tutarlılık kontrolü aynı kaynağı kullanır). yakaDetayi bu haritada yaka'nın altında olmalı.
export const YAKA_DETAY_MAP: Record<string, string[]> = {
  MAVI: ["MAVI"],
  BEYAZ: [
    "BEYAZ",
    "BEYAZ_GMUDUR_YRD",
    "BEYAZ_GENEL_MDR",
    "BEYAZ_MUDUR",
    "BEYAZ_MUDUR_YRD",
    "BEYAZ_MUHENDIS",
    "BEYAZ_MUHENDIS_MDRYRD",
    "BEYAZ_MUHENDIS_MUDUR",
    "BEYAZ_SORUMLU_TEKNIKER",
    "BEYAZ_TEKNIKER",
  ],
  GRI: ["GRI", "GRI_VEKALET"],
}

export const DIREKT_ENDIREKT_LABELS: Record<string, string> = {
  DIREKT: "Direkt",
  ENDIREKT: "Endirekt",
  A_DIREKT: "A-Direkt",
  B_ENDIREKT: "B-Endirekt",
}

export const ASANSOR_MEKANIK_LABELS: Record<string, string> = {
  ASANSOR: "Asansör",
  MEKANIK: "Mekanik",
  YOK: "Yok",
}

// Excel import için sütun mapping
export const EXCEL_COLUMN_MAP: Record<string, string> = {
  "SİCİL NO": "sicilNo",
  "ADI VE SOYADI": "adSoyad",
  "SINIF": "sinif",
  "CİNSİYET": "cinsiyet",
  "YAKA": "yakaRengi",
  "YAKA DETAYI": "yakaDetayi",
  "YAKA DETAY": "yakaDetayi",
  "DİREK ENDİREK": "direktEndirekt",
  "DİREK ENDRİEK": "direktEndirekt",
  "ASANSÖR/MEKANİK": "asansorMekanik",
  "İŞE GİRİŞ TARİHİ": "iseGirisTarihi",
  "GÖREV": "gorev",
  "BÖLÜM/DETAY": "bolumDetay",
  "BÖLÜM": "bolum",
  "1. SORUMLU": "birimSorumlusu",
  "BİRİM SORUMLUSU": "birimSorumlusu",
  "2. SORUMLU": "sorumlu2",
  "3. SORUMLU": "sorumlu3",
  "BÖLÜM MÜDÜRÜ": "bolumMuduru",
  "TELEFON": "telefon",
  "TELEFON NO": "telefon",
  "KAN GRUBU": "kanGrubu",
  "MASRAF MERKEZİ": "masrafMerkezi",
  "KEP ADRESLERİ": "interKepMail",
  "İNTERKEP MAİL ADRESLERİ": "interKepMail",
  "MAİL ADRESİ": "mailAdresi",
  "İKAMET ADRESİ": "ikametAdresi",
  "SERVİS": "serviceRoute",
  "DURAK ADI": "serviceStop",
  "İLKYARDIMCI BELGESİ": "ilkYardimciBelgesi",
  "İLK YARDIMCI": "ilkYardimciBelgesi",
  "EMEKLİ": "emekli",
  "ENGELLİ": "engelli",
  "EĞİTİM YERİ": "egitimYeri",
  "EĞİTİM TİPİ": "egitimTipi",
  "EĞİTİM ALANI": "egitimAlani",
  "MEZUNİYET YILI": "mezuniyetYili",
  "DENEME (2 AY) DEĞERLENDİRME": "denemeDegerlendirme",
  "İLK 6 AY DEĞERLENDİRME": "altiAyDegerlendirme",
  "KALFALIK\nBELGESİ": "kalfalikBelgesi",
  "KALFALIK BELGESİ": "kalfalikBelgesi",
  "USTALIK\nBELGESİ": "ustalikBelgesi",
  "USTALIK BELGESİ": "ustalikBelgesi",
  "FORKLİFT\nEHLİYETİ": "forkliftEhliyeti",
  "FORKLİFT EHLİYETİ": "forkliftEhliyeti",
  "E.TRANSPALET EHLİYETİ": "eTrans",
  "YANGIN SERTİFİKASI": "yanginSertifikasi",
  "USTA ÖĞRETİCİ BELGESİ": "ustaOgreticiBelgesi",
  // Hassas alanlar
  "SGK NO": "sgkNo",
  "TC KİMLİK NUMARASI": "tcKimlikNo",
  "TC KİMLİK NO": "tcKimlikNo",
  "BANKA ŞUBE": "bankaSube",
  "BANKA HESAP NO": "bankaHesapNo",
  "IBAN NO": "ibanNo",
  "DOĞUM TARİHLERİ": "dogumTarihi",
  "DOĞUM TARİHİ": "dogumTarihi",
}

// Excel template sütun başlıkları - PERSONEL_Listesi.xlsx ile birebir aynı sıra
export const EXCEL_TEMPLATE_COLUMNS = [
  "NO", "SİCİL NO", "SINIF", "CİNSİYET", "ADI VE SOYADI", "YAKA",
  "DİREK ENDİREK", "ASANSÖR/MEKANİK",
  "SGK NO", "TC KİMLİK NO",
  "İŞE GİRİŞ TARİHİ", "DENEME (2 AY) DEĞERLENDİRME", "İLK 6 AY DEĞERLENDİRME",
  "GÖREV", "BÖLÜM/DETAY", "BÖLÜM",
  "1. SORUMLU", "2. SORUMLU", "3. SORUMLU", "BÖLÜM MÜDÜRÜ",
  "BANKA ŞUBE", "BANKA HESAP NO",
  "TELEFON NO", "DOĞUM TARİHİ",
  "EMEKLİ", "ENGELLİ",
  "EĞİTİM YERİ", "EĞİTİM TİPİ", "EĞİTİM ALANI", "MEZUNİYET YILI",
  "KEP ADRESLERİ", "MASRAF MERKEZİ", "KAN GRUBU",
  "İKAMET ADRESİ", "MAİL ADRESİ",
  "SERVİS", "DURAK ADI", "IBAN NO",
  "İLKYARDIMCI BELGESİ", "KALFALIK BELGESİ", "USTALIK BELGESİ",
  "FORKLİFT EHLİYETİ", "E.TRANSPALET EHLİYETİ",
  "YANGIN SERTİFİKASI", "USTA ÖĞRETİCİ BELGESİ",
]
