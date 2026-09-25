/**
 * Proje Takip — Syteline Excel'inden tek seferlik geçmiş veri import'u.
 *
 * Çalıştırma:
 *   npx tsx src/scripts/proje-takip-import.ts <xlsx-yolu>            (ÖZET, hiçbir şey yazmaz)
 *   npx tsx src/scripts/proje-takip-import.ts <xlsx-yolu> --commit   (gerçek INSERT, tek transaction)
 *
 * Kurallar:
 *   - Durum / Müş. Firma / İleri Tanım / Yıl boş satırlar ATLANIR ve raporlanır.
 *   - Durum veya Proje Durum eşlemede olmayan bir değer içerirse import tamamen DURUR.
 *   - projeNo: her satırın kendi "Yıl" değeriyle PRJ-<yıl>-00001, yıl başına ayrı sayaç
 *     (Excel sırasıyla). generateProjeNo() kullanılmaz — o bulunulan yılı verir.
 *   - "Onay Trh" sütunu tarih değil hafta numarası → onayHafta'ya yazılır, onayTrh boş kalır.
 *   - Sayıya çevrilemeyen / tarih olarak okunmuş sayısal hücreler boş bırakılır ve raporlanır.
 *   - Güvenlik: DB adı ilerihub_dev_nurgul değilse veya proje_takip boş değilse DURUR.
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { hesaplaYilHafta } from "@/lib/proje-takip/tarih-hesapla";
import {
  DURUM_DEGERLERI,
  PROJE_DURUM_TIPI_DEGERLERI,
} from "@/app/api/proje-takip/_lib/sabitler";

const BEKLENEN_DB = "ilerihub_dev_nurgul";

const DURUM_ESLEME: Record<string, (typeof DURUM_DEGERLERI)[number]> = {
  "ONAY ALAN": "ONAY_ALAN",
  "İPTAL": "IPTAL",
  "ONAY BEKLEYEN/GÖNDERİLEN": "ONAY_BEKLEYEN_GONDERILEN",
  "REVİZYON": "REVIZYON",
  "TASARIM-YENİ/DEVAM EDEN": "TASARIM_YENI_DEVAM_EDEN",
  "YENİ/DEVAM EDEN": "YENI_DEVAM_EDEN",
};

const PROJE_DURUM_ESLEME: Record<string, (typeof PROJE_DURUM_TIPI_DEGERLERI)[number]> = {
  NUMUNE: "NUMUNE",
  Numune: "NUMUNE",
  PROTOTYPE: "PROTOTYPE",
  "SERİ": "SERI",
  PPAP: "PPAP",
  TASARIM: "TASARIM",
  "REVİZYON": "REVIZYON",
  "Yeniden PPAP": "YENIDEN_PPAP",
};

type Hucre = string | number | boolean | Date | null;
type Satir = Record<string, Hucre>;

interface Uyari {
  excelSatir: number;
  sutun: string;
  deger: string;
  sebep: string;
}

const uyarilar: Uyari[] = [];

function uyar(excelSatir: number, sutun: string, deger: Hucre, sebep: string) {
  uyarilar.push({
    excelSatir,
    sutun,
    deger: deger instanceof Date ? deger.toISOString() : String(deger),
    sebep,
  });
}

function bosMu(v: Hucre): boolean {
  return v === null || (typeof v === "string" && v.trim() === "");
}

function metin(v: Hucre): string | null {
  if (bosMu(v)) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function tarih(v: Hucre, excelSatir: number, sutun: string): Date | null {
  if (bosMu(v)) return null;
  if (v instanceof Date) return v;
  uyar(excelSatir, sutun, v, "tarih değil → boş bırakıldı");
  return null;
}

function tamSayi(v: Hucre, excelSatir: number, sutun: string): number | null {
  if (bosMu(v)) return null;
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string") {
    const temiz = v.trim().replace(/^\*/, "");
    if (/^-?\d+$/.test(temiz)) return Number(temiz);
  }
  uyar(excelSatir, sutun, v, "tam sayıya çevrilemedi → boş bırakıldı");
  return null;
}

// Float ve Decimal alanlar için. "17,800.00" gibi binlik ayraçlı metinler desteklenir.
function sayi(v: Hucre, excelSatir: number, sutun: string): number | null {
  if (bosMu(v)) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (/^-?\d+,\d+$/.test(s)) return Number(s.replace(",", "."));
  }
  const sebep =
    v instanceof Date
      ? "Excel'de tarih olarak kayıtlı (bozuk sayı) → boş bırakıldı"
      : "sayıya çevrilemedi → boş bırakıldı";
  uyar(excelSatir, sutun, v, sebep);
  return null;
}

function decimalStr(v: Hucre, excelSatir: number, sutun: string): string | null {
  const n = sayi(v, excelSatir, sutun);
  return n === null ? null : String(n);
}

function excelOku(yol: string): Satir[] {
  const wb = XLSX.readFile(yol, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const ham = XLSX.utils.sheet_to_json<Record<string, Hucre>>(ws, { defval: null });
  // Başlıklarda çift boşluk var ("Sıra  No") → tek boşluğa indir.
  return ham.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k.replace(/\s+/g, " ").trim(), v])
    )
  );
}

async function main() {
  const yol = process.argv[2];
  const commit = process.argv.includes("--commit");
  if (!yol || yol.startsWith("--")) {
    console.error("Kullanım: npx tsx src/scripts/proje-takip-import.ts <xlsx-yolu> [--commit]");
    process.exit(1);
  }

  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (db !== BEKLENEN_DB) {
    throw new Error(`Yanlış veritabanı: ${db} (beklenen: ${BEKLENEN_DB}). Durduruldu.`);
  }
  const mevcut = await prisma.projeTakip.count();
  if (mevcut > 0) {
    throw new Error(`proje_takip boş değil (${mevcut} kayıt). projeNo çakışır — durduruldu.`);
  }

  const satirlar = excelOku(yol);
  const atlanan: { excelSatir: number; sebep: string }[] = [];
  const eslesmeyenDurum = new Map<string, number[]>();
  const eslesmeyenProjeDurum = new Map<string, number[]>();
  const yilSayac = new Map<number, number>();
  const satirProjeNo = new Map<number, string>();
  const eklenecek: Prisma.ProjeTakipCreateManyInput[] = [];

  satirlar.forEach((r, i) => {
    const excelSatir = i + 2; // 1. satır başlık

    const durumHam = metin(r["Durum"]);
    const projeDurumHam = metin(r["Proje Durum"]);
    if (durumHam && !DURUM_ESLEME[durumHam]) {
      eslesmeyenDurum.set(durumHam, [...(eslesmeyenDurum.get(durumHam) ?? []), excelSatir]);
    }
    if (projeDurumHam && !PROJE_DURUM_ESLEME[projeDurumHam]) {
      eslesmeyenProjeDurum.set(projeDurumHam, [
        ...(eslesmeyenProjeDurum.get(projeDurumHam) ?? []),
        excelSatir,
      ]);
    }

    const musteriFirma = metin(r["Müş. Firma"]);
    const ileriTanim = metin(r["İleri Tanım"]);
    const yil = tamSayi(r["Yıl"], excelSatir, "Yıl");

    const eksik: string[] = [];
    if (!durumHam) eksik.push("Durum");
    if (!musteriFirma) eksik.push("Müş. Firma");
    if (!ileriTanim) eksik.push("İleri Tanım");
    if (yil === null) eksik.push("Yıl");
    if (eksik.length > 0) {
      atlanan.push({ excelSatir, sebep: `boş: ${eksik.join(", ")}` });
      return;
    }
    if (!DURUM_ESLEME[durumHam!] || (projeDurumHam && !PROJE_DURUM_ESLEME[projeDurumHam])) {
      return; // eşleşmeyen değer — aşağıda import tamamen durdurulur
    }

    const sayac = (yilSayac.get(yil!) ?? 0) + 1;
    yilSayac.set(yil!, sayac);
    const projeNo = `PRJ-${yil}-${String(sayac).padStart(5, "0")}`;
    satirProjeNo.set(excelSatir, projeNo);

    const rfpTarih = tarih(r["RFP Tarih"], excelSatir, "RFP Tarih");
    const sevkiyatTrh = tarih(r["Sevkiyat Trh"], excelSatir, "Sevkiyat Trh");
    const sevkiyatYH = hesaplaYilHafta(sevkiyatTrh);

    eklenecek.push({
      projeNo,
      siraNo: tamSayi(r["Sıra No"], excelSatir, "Sıra No"),
      durum: DURUM_ESLEME[durumHam!],
      rfpAcilisHafta:
        tamSayi(r["RFP A. Hafta"], excelSatir, "RFP A. Hafta") ??
        hesaplaYilHafta(rfpTarih)?.hafta ??
        null,
      yil,
      grupKod: metin(r["GrupKod"]),
      rfpNo: metin(r["RFP No"]),
      yillikAdet: sayi(r["Yıllık Adet"], excelSatir, "Yıllık Adet"),
      numuneAdedi: metin(r["Numune Ad"]),
      kalipFikstur: metin(r["Kalıp/ Fikstur"]),
      kalipKodu: metin(r["Kalıp Kodu"]),
      musteriFirma: musteriFirma!,
      ileriKod: metin(r["İleri Kod"]),
      ileriTanim: ileriTanim!,
      musteriKod: metin(r["Müşteri Kod"]),
      musteriYetkilisi: metin(r["Müs. Yetkilisi"]),
      projeKalipFikstur: metin(r["Proje Kalıp- Fikstür"]),
      projeBilgisi: metin(r["Proje Bilgisi"]),
      rfpTarih,
      revizeTerminTrh: tarih(r["Revize Termin Trh"], excelSatir, "Revize Termin Trh"),
      terminProjeTrh: tarih(r["Termin/ Proje Trh"], excelSatir, "Termin/ Proje Trh"),
      poNumarasi: metin(r["PO Num."]),
      projeDurumTipi: projeDurumHam ? PROJE_DURUM_ESLEME[projeDurumHam] : null,
      sevkiyatTrh,
      // Tarih varsa tarihten hesaplanır; yoksa Excel'deki yıl/hafta sütunu (legacy) kullanılır.
      sevkiyatYil: sevkiyatYH?.yil ?? tamSayi(r["Sevkiyat Yıl"], excelSatir, "Sevkiyat Yıl"),
      sevkiyatHafta:
        sevkiyatYH?.hafta ?? tamSayi(r["Sevkiyat Hafta"], excelSatir, "Sevkiyat Hafta"),
      // "Onay Trh" Excel'de tarih değil hafta numarası içeriyor.
      onayTrh: null,
      onayYil: tamSayi(r["Onay Yıl"], excelSatir, "Onay Yıl"),
      onayHafta:
        tamSayi(r["Onay Trh"], excelSatir, "Onay Trh") ??
        tamSayi(r["Onay Hafta"], excelSatir, "Onay Hafta"),
      aciklama: metin(r["Açıklama"]),
      minimumSipMiktari: sayi(r["Minimum Sip Miktarı"], excelSatir, "Minimum Sip Miktarı"),
      prototipFiyati: decimalStr(r["Prototif Fiyat"], excelSatir, "Prototif Fiyat"),
      prototipParaBirimi: metin(r["Para Brm"]),
      kategori: metin(r["Kategori"]),
      lokasyon: metin(r["Lokasyon"]),
      birimFiyat: decimalStr(r["Brm Fiyat"], excelSatir, "Brm Fiyat"),
      birimFiyatParaBirimi: metin(r["B. Fiyat PBrm"]),
      hedefYillik: decimalStr(r["Hedef/Yıllık"], excelSatir, "Hedef/Yıllık"),
      kalipTutar: decimalStr(r["Kalıp Tutar"], excelSatir, "Kalıp Tutar"),
      kickOffStatu: metin(r["Kick Off/ Statü"]),
      poKalip: metin(r["PO Kalıp"]),
      kickoffCW: tamSayi(r["Kickoff CW"], excelSatir, "Kickoff CW"),
      kickoffYil: tamSayi(r["Kickoff Yıl"], excelSatir, "Kickoff Yıl"),
      istemeTrhCW: tamSayi(r["İsteme Trh CW"], excelSatir, "İsteme Trh CW"),
      istemeTrhYil: tamSayi(r["İsteme Trh Yıl"], excelSatir, "İsteme Trh Yıl"),
      sevkTrhCW: tamSayi(r["Sevk Trh CW"], excelSatir, "Sevk Trh CW"),
      sevkYil: tamSayi(r["Sevk Yıl"], excelSatir, "Sevk Yıl"),
      poTrhCW: tamSayi(r["PO Trh CW"], excelSatir, "PO Trh CW"),
      poYil: tamSayi(r["PO Yıl"], excelSatir, "PO Yıl"),
      poOngCW: tamSayi(r["PO Öng. CW"], excelSatir, "PO Öng. CW"),
      poOngYil: tamSayi(r["PO Öng. Yıl"], excelSatir, "PO Öng. Yıl"),
      nre: decimalStr(r["NRE"], excelSatir, "NRE"),
      nreParaBirimi: metin(r["NRE P. Brm"]),
      legacyComboBox10: metin(r["comboBox10_SITE"]),
      legacyComboBox23: metin(r["comboBox23_SITE"]),
      legacyDateCombo5: tarih(r["dateCombo5_SITE"], excelSatir, "dateCombo5_SITE"),
      legacyKullaniciStatic: metin(r["C(KullaniciStatic)"]),
      muhendislikDoldurmaDurumu: "TAMAMLANDI",
      olusturanId: "SYSTEM_IMPORT",
    });
  });

  if (eslesmeyenDurum.size > 0 || eslesmeyenProjeDurum.size > 0) {
    console.error("DURDURULDU — eşlemede olmayan değerler:");
    for (const [v, s] of eslesmeyenDurum) console.error(`  Durum "${v}" → satırlar: ${s.join(", ")}`);
    for (const [v, s] of eslesmeyenProjeDurum)
      console.error(`  Proje Durum "${v}" → satırlar: ${s.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`DB: ${db}`);
  console.log(`Excel toplam satır: ${satirlar.length}`);
  console.log(`Eklenecek: ${eklenecek.length}`);
  console.log(`Atlanacak: ${atlanan.length}`);
  const sebepSay = new Map<string, number>();
  for (const a of atlanan) sebepSay.set(a.sebep, (sebepSay.get(a.sebep) ?? 0) + 1);
  for (const [s, n] of [...sebepSay].sort((a, b) => b[1] - a[1])) console.log(`  ${n} × ${s}`);
  console.log(`  Atlanan Excel satırları: ${atlanan.map((a) => a.excelSatir).join(", ")}`);

  console.log("Yıl bazında projeNo aralıkları:");
  for (const [y, n] of [...yilSayac].sort((a, b) => a[0] - b[0]))
    console.log(`  ${y}: PRJ-${y}-00001 … PRJ-${y}-${String(n).padStart(5, "0")} (${n})`);

  const atlananSet = new Set(atlanan.map((a) => a.excelSatir));
  const ilgiliUyarilar = uyarilar.filter((u) => !atlananSet.has(u.excelSatir));
  console.log(`Boş bırakılan hücreler (eklenecek satırlarda): ${ilgiliUyarilar.length}`);
  for (const u of ilgiliUyarilar)
    console.log(`  satır ${u.excelSatir} · ${satirProjeNo.get(u.excelSatir)} · ${u.sutun} = "${u.deger}" · ${u.sebep}`);

  if (!commit) {
    console.log("\nÖZET MODU — hiçbir şey yazılmadı. Gerçek import için --commit ekleyin.");
    return;
  }

  const sonuc = await prisma.$transaction(async (tx) => {
    const r = await tx.projeTakip.createMany({ data: eklenecek });
    if (r.count !== eklenecek.length) {
      throw new Error(`Beklenen ${eklenecek.length}, eklenen ${r.count} — geri alındı.`);
    }
    return r.count;
  });
  console.log(`\nINSERT tamamlandı: ${sonuc} kayıt eklendi, ${atlanan.length} satır atlandı.`);
}

main()
  .catch((e) => {
    console.error("HATA:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
