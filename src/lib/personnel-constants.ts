export const BOLUMLER = [
  "BİLGİ TEKNOLOJİLERİ",
  "BOYA",
  "CNC",
  "DEPO",
  "DİREKSİYON & PAKETLEME",
  "KALİTE KONTROL",
  "KAYNAKHANE",
  "LAZER",
  "LAZER & DAİRE TESTERE",
  "MONTAJ",
  "MÜHENDİSLİK",
  "BAKIM",
  "PAKET",
  "SATIN ALMA",
  "TALAŞLI İMALAT",
  "ÜRETİM PLANLAMA",
  "YÖNETİM",
  "İNSAN KAYNAKLARI",
  "FİNANS & MUHASEBE",
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
  "ASANSÖR/MEKANİK": "asansorMekanik",
  "İŞE GİRİŞ TARİHİ": "iseGirisTarihi",
  "GÖREV": "gorev",
  "BÖLÜM/DETAY": "bolumDetay",
  "BÖLÜM": "bolum",
  "BİRİM SORUMLUSU": "birimSorumlusu",
  "BÖLÜM MÜDÜRÜ": "bolumMuduru",
  "TELEFON": "telefon",
  "KAN GRUBU": "kanGrubu",
  "MASRAF MERKEZİ": "masrafMerkezi",
  "İNTERKEP MAİL ADRESLERİ": "interKepMail",
  "MYK USTALIK-KALFALIK": "mykUstalikKalfalik",
  "İLK YARDIMCI": "ilkYardimci",
  "EMEKLİ": "emekli",
  "ENGELLİ": "engelli",
  "EĞİTİM YERİ": "egitimYeri",
  "EĞİTİM TİPİ": "egitimTipi",
  "EĞİTİM ALANI": "egitimAlani",
  "MEZUNİYET YILI": "mezuniyetYili",
  "DENEME (2 AY) DEĞERLENDİRME": "denemeDegerlendirme",
  "İLK 6 AY DEĞERLENDİRME": "altiAyDegerlendirme",
  // Hassas alanlar
  "SGK NO": "sgkNo",
  "TC KİMLİK NUMARASI": "tcKimlikNo",
  "BANKA ŞUBE": "bankaSube",
  "BANKA HESAP NO": "bankaHesapNo",
  "DOĞUM TARİHLERİ": "dogumTarihi",
}

// Excel template sütun başlıkları
export const EXCEL_TEMPLATE_COLUMNS = [
  "SİCİL NO", "ADI VE SOYADI", "SINIF", "CİNSİYET", "YAKA",
  "DİREK ENDİREK", "ASANSÖR/MEKANİK", "İŞE GİRİŞ TARİHİ", "GÖREV",
  "BÖLÜM/DETAY", "BÖLÜM", "BİRİM SORUMLUSU", "BÖLÜM MÜDÜRÜ",
  "TELEFON", "KAN GRUBU", "MASRAF MERKEZİ", "İNTERKEP MAİL ADRESLERİ",
  "MYK USTALIK-KALFALIK", "İLK YARDIMCI", "EMEKLİ", "ENGELLİ",
  "EĞİTİM YERİ", "EĞİTİM TİPİ", "EĞİTİM ALANI", "MEZUNİYET YILI",
  "DENEME (2 AY) DEĞERLENDİRME", "İLK 6 AY DEĞERLENDİRME",
  "SGK NO", "TC KİMLİK NUMARASI", "BANKA ŞUBE", "BANKA HESAP NO",
  "DOĞUM TARİHLERİ",
]
