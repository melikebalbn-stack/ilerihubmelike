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
}

export const DIREKT_ENDIREKT_LABELS: Record<string, string> = {
  DIREKT: "Direkt",
  ENDIREKT: "Endirekt",
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
