const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

function psql(sql) {
  const tmp = `/tmp/psql-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`;
  fs.writeFileSync(tmp, sql);
  try {
    return execSync(`PGPASSWORD=ileri2024secure psql -U ilerihub_user -d ilerihub -h localhost -At -F '|' -f ${tmp}`, { encoding: "utf8" });
  } finally {
    fs.unlinkSync(tmp);
  }
}

const SOURCE = "/home/rokunet/projects/ilerihub/public/uploads/evidences/2026/01/L11_711_Varl_k_Gruplar__Listesi_1769409130905_ulenya.xls";
const UPLOAD_DIR = "/home/rokunet/projects/ilerihub/public/uploads/iso27001/documents";

// Yazılım sınıflandırması: anahtar -> { sinif, deger }
// VARLIK DEĞERİ SINIFI: ÇOK YÜKSEK / YÜKSEK / ORTA / DÜŞÜK
const SOFTWARE_MAP = {
  "INFOR SYTELINE":   { sinif: "ERP",                          deger: "ÇOK YÜKSEK" },
  "EKİP BARKOD":      { sinif: "ERP",                          deger: "ÇOK YÜKSEK" },
  "MAS":              { sinif: "Üretim Yönetim Sistemi",       deger: "ÇOK YÜKSEK" },
  "LOGO TIGER 3":     { sinif: "ERP",                          deger: "ÇOK YÜKSEK" },
  "LOGO Connect":     { sinif: "ERP",                          deger: "YÜKSEK" },
  "E-FLOW":           { sinif: "Süreç Yönetimi",               deger: "YÜKSEK" },
  "BordroPlus":       { sinif: "İK / Bordro Yazılımı",         deger: "YÜKSEK" },
  "Postacı":          { sinif: "E-Posta / Mesajlaşma",         deger: "ORTA" },
  "Bizmanager":       { sinif: "Yönetim Yazılımı",             deger: "ORTA" },
  "ASmanager":        { sinif: "Yönetim Yazılımı",             deger: "ORTA" },
  "BMAS":             { sinif: "Bakım Yönetim Sistemi",        deger: "YÜKSEK" },
  "MoonWell":         { sinif: "Yönetim Yazılımı",             deger: "ORTA" },
  "Catia":            { sinif: "CAD / Mühendislik Tasarım",    deger: "YÜKSEK" },
  "SolidWorks":       { sinif: "CAD / Mühendislik Tasarım",    deger: "YÜKSEK" },
  "AutoCad":          { sinif: "CAD / Mühendislik Tasarım",    deger: "YÜKSEK" },
  "Adobe":            { sinif: "Tasarım / Grafik",             deger: "ORTA" },
  "3CX":              { sinif: "VoIP / Telefon Santrali",      deger: "YÜKSEK" },
  "SQL":              { sinif: "Veritabanı Yönetim Sistemi",   deger: "ÇOK YÜKSEK" },
  "PowerBI":          { sinif: "Raporlama / İş Zekası",        deger: "ORTA" },
  "Crystal Report":   { sinif: "Raporlama",                    deger: "ORTA" },
  "WorkNC":           { sinif: "CAM / Üretim Tasarım",         deger: "YÜKSEK" },
  "Office 365":       { sinif: "Ofis Uygulaması",              deger: "YÜKSEK" },
  "Eset":             { sinif: "Antivirüs / Güvenlik",         deger: "YÜKSEK" },
  "Kilimsoft":        { sinif: "Mali / Muhasebe Yazılımı",     deger: "ORTA" },
  "İnterKep":         { sinif: "KEP (Kayıtlı E-Posta)",        deger: "YÜKSEK" },
  "Windows":          { sinif: "İşletim Sistemi",              deger: "ÇOK YÜKSEK" },
};

async function main() {
  const wb = XLSX.readFile(SOURCE, { cellStyles: true });
  const sheetName = "2-Yazılım Varlıkları";
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("Sheet bulunamadı: " + sheetName);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

  // Header satırı index 2, veri 4'ten itibaren
  const COL = {
    VARLIK_TANIMI: 0,
    NO: 1,
    YAZILIM_SINIFI: 2,
    UYGULAMA: 3,
    LISANS_BILGISI: 4,
    IP: 5,
    LISANS_ADEDI: 6,
    VARLIK_DEGERI_SINIFI: 7,
    VARLIK_SORUMLUSU: 8,
    BULUNDUGU_YER: 9,
  };

  let filled = 0;
  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    const tanim = String(row[COL.VARLIK_TANIMI] || "").trim();
    if (!tanim) continue;

    const cfg = SOFTWARE_MAP[tanim];
    if (!cfg) {
      console.log("Eşleşme yok:", tanim);
      continue;
    }

    const currentSinif = String(row[COL.YAZILIM_SINIFI] || "").trim();
    const currentDeger = String(row[COL.VARLIK_DEGERI_SINIFI] || "").trim();

    if (!currentSinif) {
      const cellAddr = XLSX.utils.encode_cell({ r: i, c: COL.YAZILIM_SINIFI });
      ws[cellAddr] = { t: "s", v: cfg.sinif };
      filled++;
    }
    if (!currentDeger) {
      const cellAddr = XLSX.utils.encode_cell({ r: i, c: COL.VARLIK_DEGERI_SINIFI });
      ws[cellAddr] = { t: "s", v: cfg.deger };
      filled++;
    }
  }

  console.log("Doldurulan hücre sayısı:", filled);

  // Yeni dosya yaz (xlsx)
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.xlsx`;
  const newFilePath = path.join(UPLOAD_DIR, uniqueName);
  XLSX.writeFile(wb, newFilePath, { bookType: "xlsx" });

  const stat = fs.statSync(newFilePath);
  const buffer = fs.readFileSync(newFilePath);
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Mevcut dokümanı al
  const cur = psql(`SELECT id, "documentNumber", title, "fileName", "fileUrl", "fileSize", "contentHash", version, "ownerId", "ownerName" FROM "Iso27001Document" WHERE id = 'doc-012';`).trim().split("|");
  const [docId, docNo, title, fileName, fileUrl, fileSize, oldHash, version, ownerId, ownerName] = cur;
  if (!docId) throw new Error("doc-012 bulunamadı");

  const versionParts = version.split(".");
  const major = parseInt(versionParts[0]) || 1;
  const minor = parseInt(versionParts[1]) || 0;
  const newVersion = `${major}.${minor + 1}`;

  // Versiyon geçmişine eskiyi yaz
  const verId = "ver-" + crypto.randomBytes(8).toString("hex");
  const esc = (s) => (s == null || s === "") ? "NULL" : `'${String(s).replace(/'/g, "''")}'`;
  psql(`INSERT INTO "Iso27001DocumentVersion" (id, "documentId", version, "fileName", "fileUrl", "fileSize", "contentHash", "changeDescription", "changedById", "changedByName", "createdAt") VALUES ('${verId}', '${docId}', ${esc(version)}, ${esc(fileName)}, ${esc(fileUrl)}, ${fileSize || "NULL"}, ${esc(oldHash)}, 'Yazılım Sınıfı ve Varlık Değeri Sınıfı otomatik dolduruldu', ${esc(ownerId)}, ${esc(ownerName)}, NOW());`);

  // Mevcut dokümanı güncelle
  psql(`UPDATE "Iso27001Document" SET "fileName" = 'L11.711 Varlık Grupları Listesi.xlsx', "fileUrl" = '/uploads/iso27001/documents/${uniqueName}', "fileType" = 'xlsx', "fileSize" = ${stat.size}, version = '${newVersion}', "contentHash" = '${contentHash}', "updatedAt" = NOW() WHERE id = '${docId}';`);

  console.log("\nGüncellendi:");
  console.log("  Yeni versiyon:", newVersion);
  console.log("  Yeni dosya  :", `/uploads/iso27001/documents/${uniqueName}`);
  console.log("  Boyut       :", stat.size, "byte");
}

main().catch((e) => { console.error(e); process.exit(1); });
