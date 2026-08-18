// Faz 6 — Başvuru → Personel kaydı dönüşümü. TEK KAYNAK.
//
// Tasarım §G: işbaşı, başvuru kaydının personel kartına dönüştürülmesiyle olur. Dönüşüm
// ATOMİKTİR: Personnel + PersonnelSensitive + (varsa) beden profili + EmploymentPeriod +
// başvuru bağı + statü ISE_BASLADI **tek transaction**. Herhangi biri patlarsa hiçbiri kalmaz
// (sicilNo çakışması bunun en sık sebebi).
//
// Yeni altyapı YOK: Personnel oluşturma deseni POST /api/personnel'den (tx + EmploymentPeriod +
// beden profili + personelEklendiginde), denetim kaydı PersonnelAccessLog'un mevcut
// 'CREATE_SENSITIVE' tipinden alındı.

import { Prisma } from "@/generated/prisma";
import type {
  PrismaClient,
  JobApplicationStatus,
  EducationLevel,
  Gender,
  BloodType,
  YakaRengi,
  YakaDetayi,
  DirektEndirekt,
  AsansorMekanik,
} from "@/generated/prisma";
import { canTransition } from "./transitions";
import { personelEklendiginde } from "@/lib/org/personel-koltuk-senkron";

// ─────────────────────────────────────────────────────────────────────────────
// 1) EĞİTİM GEÇMİŞİ — İKİ FARKLI ŞEKİL var, ikisi de canlı veride mevcut
// ─────────────────────────────────────────────────────────────────────────────
// (a) GÜNCEL form (JobApplicationRenderer → types.ts:101): sabit anahtarlı NESNE
//     { primarySchool|highSchool|vocational|university|master|other:
//       { institution, department, startDate, endDate, gpa } }
// (b) ESKİ/seed kayıtları: DİZİ
//     [{ schoolName, department, startYear, endYear, degree }]
// Ayrıca tek örnekte { lise: { institution, department, year } } görüldü — (a)'nın
// serbest anahtarlı hâli gibi davranır, aynı kod yolu okur.
//
// Kural: educationLevel ile EŞLEŞEN kademe; yoksa DOLU olan EN YÜKSEK kademe
// (dizide: son dolu satır). İV formda değeri düzeltebilir.

/** EducationLevel → educationHistory nesne anahtar(lar)ı. Sıra: en olası önce. */
const SEVIYE_ANAHTARI: Record<EducationLevel, string[]> = {
  PRIMARY_SCHOOL: ["primarySchool", "ilkogretim", "ilkokul"],
  HIGH_SCHOOL: ["highSchool", "lise", "vocational"],
  ASSOCIATE: ["vocational", "university", "onlisans", "myo"],
  BACHELOR: ["university", "lisans"],
  MASTER: ["master", "yuksekLisans"],
  DOCTORATE: ["doctorate", "doktora", "other"],
};

/** Kademe sırası — "dolu olan en yüksek" fallback'i için (düşükten yükseğe). */
const KADEME_SIRASI = [
  "primarySchool",
  "ilkogretim",
  "highSchool",
  "lise",
  "vocational",
  "university",
  "lisans",
  "master",
  "doctorate",
  "other",
];

/** Personnel.egitimTipi String? (enum DEĞİL) — canlı veri tutarsız ("M.L.", "MYO", "T.M.L").
 *  Yeni kayıtlarda TEK biçim kullanılır; kaynak şemadaki enum yorumlarıdır. */
export const EGITIM_TIPI_TR: Record<EducationLevel, string> = {
  PRIMARY_SCHOOL: "İlköğretim",
  HIGH_SCHOOL: "Lise",
  ASSOCIATE: "Önlisans (MYO)",
  BACHELOR: "Lisans (Üniversite)",
  MASTER: "Yüksek Lisans",
  DOCTORATE: "Doktora",
};

export type EgitimCozumu = {
  egitimYeri: string | null;
  egitimAlani: string | null;
  mezuniyetYili: number | null;
  /** Hangi kademeden okundu (İV önizlemede görsün). */
  kaynak: string | null;
};

function metin(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** "2021", "2021-06-30", "30.06.2021" → 2021. Bulunamazsa null. */
function yilCoz(v: unknown): number | null {
  const s = metin(v);
  if (!s) return null;
  const m = s.match(/(19|20)\d{2}/);
  if (!m) return null;
  const y = parseInt(m[0], 10);
  return y >= 1900 && y <= 2100 ? y : null;
}

export function egitimCoz(
  educationHistory: unknown,
  educationLevel: EducationLevel | null,
): EgitimCozumu {
  const bos: EgitimCozumu = { egitimYeri: null, egitimAlani: null, mezuniyetYili: null, kaynak: null };
  if (!educationHistory) return bos;

  let ham: unknown = educationHistory;
  if (typeof ham === "string") {
    try {
      ham = JSON.parse(ham);
    } catch {
      return bos;
    }
  }

  // (b) DİZİ şekli
  if (Array.isArray(ham)) {
    const satirlar = ham.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
    const dolu = satirlar.filter((r) => metin(r.schoolName) || metin(r.institution));
    if (dolu.length === 0) return bos;
    // educationLevel eşleşmesi dizide degree metniyle denenir; yoksa SON dolu satır.
    const hedefEtiket = educationLevel ? EGITIM_TIPI_TR[educationLevel].toLocaleLowerCase("tr") : null;
    const eslesen =
      (hedefEtiket &&
        dolu.find((r) => {
          const d = metin(r.degree)?.toLocaleLowerCase("tr") ?? "";
          return d && (hedefEtiket.includes(d) || d.includes(hedefEtiket.split(" ")[0]));
        })) ||
      dolu[dolu.length - 1];
    return {
      egitimYeri: metin(eslesen.schoolName) ?? metin(eslesen.institution),
      egitimAlani: metin(eslesen.department),
      mezuniyetYili: yilCoz(eslesen.endYear) ?? yilCoz(eslesen.endDate),
      kaynak: metin(eslesen.degree) ?? "dizi (son dolu satır)",
    };
  }

  // (a) NESNE şekli
  if (typeof ham === "object") {
    const obj = ham as Record<string, unknown>;
    const doluMu = (k: string) => {
      const e = obj[k];
      return !!e && typeof e === "object" && !!metin((e as Record<string, unknown>).institution);
    };
    const oku = (k: string): EgitimCozumu => {
      const e = obj[k] as Record<string, unknown>;
      return {
        egitimYeri: metin(e.institution),
        egitimAlani: metin(e.department),
        mezuniyetYili: yilCoz(e.endDate) ?? yilCoz(e.year) ?? yilCoz(e.endYear),
        kaynak: k,
      };
    };
    // 1) educationLevel ile eşleşen ve DOLU olan kademe
    if (educationLevel) {
      for (const k of SEVIYE_ANAHTARI[educationLevel]) if (doluMu(k)) return oku(k);
    }
    // 2) dolu olan EN YÜKSEK kademe (bilinen sıra), sonra kalan anahtarlar
    const bilinen = [...KADEME_SIRASI].reverse().find(doluMu);
    if (bilinen) return oku(bilinen);
    const digerDolu = Object.keys(obj).find(doluMu);
    if (digerDolu) return oku(digerDolu);
  }
  return bos;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) OTOMATİK AKTARILAN ALANLAR (İV'nin girmediği 13 alan)
// ─────────────────────────────────────────────────────────────────────────────

export type BasvuruKaynak = {
  id: string;
  applicationNumber: string;
  status: JobApplicationStatus;
  fullName: string;
  gender: Gender | null;
  bloodType: BloodType | null;
  email: string | null;
  mobilePhone: string | null;
  homeAddress: string | null;
  tcKimlikNo: string | null;
  birthDate: Date | null;
  educationLevel: EducationLevel | null;
  educationHistory: unknown;
  shoeSize: string | null;
  clothingSizeUpper: string | null;
  clothingSizeLower: string | null;
  requestedPosition: string | null;
  availableStartDate: Date | null;
};

export type OtomatikAlanlar = {
  adSoyad: string;
  cinsiyet: Gender | null;
  kanGrubu: BloodType | null;
  mailAdresi: string | null;
  telefon: string | null;
  ikametAdresi: string | null;
  tcKimlikNo: string | null;
  dogumTarihi: Date | null;
  egitimTipi: string | null;
  egitimYeri: string | null;
  egitimAlani: string | null;
  mezuniyetYili: number | null;
  beden: { ustBeden: string | null; altBeden: string | null; ayakkabiNo: string | null } | null;
};

/** Başvurudan otomatik gelen alanlar. Önizleme ve yazma AYNI fonksiyondan beslenir —
 *  İV'nin gördüğü ile kaydedilen sapamaz. */
export function otomatikAlanlar(app: BasvuruKaynak): OtomatikAlanlar {
  const egitim = egitimCoz(app.educationHistory, app.educationLevel);
  const ust = metin(app.clothingSizeUpper);
  const alt = metin(app.clothingSizeLower);
  const ayak = metin(app.shoeSize);
  return {
    adSoyad: app.fullName,
    cinsiyet: app.gender,
    kanGrubu: app.bloodType,
    mailAdresi: metin(app.email),
    telefon: metin(app.mobilePhone),
    ikametAdresi: metin(app.homeAddress),
    tcKimlikNo: metin(app.tcKimlikNo),
    dogumTarihi: app.birthDate,
    egitimTipi: app.educationLevel ? EGITIM_TIPI_TR[app.educationLevel] : null,
    egitimYeri: egitim.egitimYeri,
    egitimAlani: egitim.egitimAlani,
    mezuniyetYili: egitim.mezuniyetYili,
    // ÜÇÜ DE boşsa profil satırı OLUŞTURULMAZ.
    beden: ust || alt || ayak ? { ustBeden: ust, altBeden: alt, ayakkabiNo: ayak } : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) MÜKERRER TC KONTROLÜ
// ─────────────────────────────────────────────────────────────────────────────
// PersonnelSensitive.tcKimlikNo üzerinde @unique YOK (keşif) → findMany + çoklu eşleşme.
// Aynı TC'de hem aktif hem pasif kayıt bulunabilir; AKTİF varsa o kazanır (blok).

export type TcKontrolSonuc =
  | { durum: "TEMIZ" }
  | {
      durum: "AKTIF_VAR";
      personnelId: string;
      adSoyad: string;
      sicilNo: string | null;
      mesaj: string;
      /** Faz 6+ — "mevcut kayda bağla ve kapat" bu kayıt için mümkün mü?
       *  Kural SUNUCUDA (baglamaUygunMu); ekran yalnız bu bayrağa bakar. */
      baglanabilir?: boolean;
      /** Uygun değilse sebebi — İV neden butonun çıkmadığını görebilsin. */
      baglanamamaSebebi?: string;
    }
  | {
      durum: "PASIF_VAR";
      adaylar: { personnelId: string; adSoyad: string; sicilNo: string | null; sonCikis: Date | null }[];
      mesaj: string;
    };

type DbLike = PrismaClient | Prisma.TransactionClient;

export async function tcKontrol(db: DbLike, tcKimlikNo: string | null): Promise<TcKontrolSonuc> {
  const tc = metin(tcKimlikNo);
  if (!tc) return { durum: "TEMIZ" };

  const eslesmeler = await db.personnelSensitive.findMany({
    where: { tcKimlikNo: tc },
    select: {
      personnelId: true,
      personnel: {
        select: {
          id: true,
          adSoyad: true,
          sicilNo: true,
          aktif: true,
          employmentPeriods: {
            where: { cikisTarihi: { not: null } },
            orderBy: { cikisTarihi: "desc" },
            take: 1,
            select: { cikisTarihi: true },
          },
        },
      },
    },
  });
  if (eslesmeler.length === 0) return { durum: "TEMIZ" };

  const aktif = eslesmeler.find((e) => e.personnel?.aktif);
  if (aktif?.personnel) {
    return {
      durum: "AKTIF_VAR",
      personnelId: aktif.personnel.id,
      adSoyad: aktif.personnel.adSoyad,
      sicilNo: aktif.personnel.sicilNo,
      mesaj: `Bu TC ile aktif personel kaydı var: ${aktif.personnel.adSoyad} (${aktif.personnel.sicilNo ?? "sicil yok"})`,
    };
  }

  const adaylar = eslesmeler
    .filter((e) => e.personnel)
    .map((e) => ({
      personnelId: e.personnel!.id,
      adSoyad: e.personnel!.adSoyad,
      sicilNo: e.personnel!.sicilNo,
      sonCikis: e.personnel!.employmentPeriods[0]?.cikisTarihi ?? null,
    }));
  return {
    durum: "PASIF_VAR",
    adaylar,
    mesaj:
      adaylar.length === 1
        ? `Bu TC ile PASİF personel kaydı var: ${adaylar[0].adSoyad} (${adaylar[0].sicilNo ?? "sicil yok"}). Yeniden işe alım mı?`
        : `Bu TC ile ${adaylar.length} pasif personel kaydı bulundu. Hangisine bağlanacağını seçin.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) DÖNÜŞÜM — TEK TRANSACTION
// ─────────────────────────────────────────────────────────────────────────────

export type ElleGirilen = {
  sicilNo: string;
  yakaRengi: YakaRengi;
  bolum: string; // DepartmentDefinition.name — serbest metin DEĞİL
  gorev: string;
  iseGirisTarihi: string; // ISO
  direktEndirekt: DirektEndirekt;
  /** Personnel.cinsiyet ZORUNLU (nullable değil) ama başvuruda opsiyonel. Başvuruda yoksa
   *  İV seçer; ikisi de yoksa dönüşüm reddedilir (sessiz varsayılan ATANMAZ). */
  cinsiyet?: Gender | null;
  // Opsiyoneller
  yakaDetayi?: YakaDetayi | null;
  sinif?: string | null;
  masrafMerkezi?: string | null;
  asansorMekanik?: AsansorMekanik | null;
  bolumDetay?: string | null;
  // İV önizlemede düzeltebilir (eğitim satırı yanlış kademeden gelmiş olabilir).
  egitimYeri?: string | null;
  egitimAlani?: string | null;
  mezuniyetYili?: number | null;
  /** Pasif TC eşleşmesi gösterildi ve İV yine de YENİ kart açmayı seçti. Doğrudan API
   *  çağrısıyla sessiz mükerrer kart açılmasın diye açık onay istenir. */
  mukerrerOnaylandi?: boolean;
};

export type DonusumKarari =
  /** Yeni personel kartı aç. */
  | { tip: "YENI" }
  /** Mevcut PASİF karta bağla (yeniden işe alım) — aktif=true + yeni EmploymentPeriod. */
  | { tip: "MEVCUDA_BAGLA"; personnelId: string };

export class DonusumError extends Error {
  constructor(
    message: string,
    public httpStatus: number = 400,
    public kod?: string,
  ) {
    super(message);
    this.name = "DonusumError";
  }
}

export type DonusumSonuc = {
  personnelId: string;
  sicilNo: string;
  yenidenIseAlim: boolean;
  bedenProfiliOlustu: boolean;
  applicationId: string;
};

/**
 * Dönüşümü uygular. HER ŞEY tek transaction:
 *   Personnel (create|reaktive) → PersonnelSensitive → EmploymentPeriod → beden profili
 *   → org koltuk senkronu → başvuru bağı + statü ISE_BASLADI → PersonnelAccessLog
 *
 * Statü geçişi matristen doğrulanır (canTransition) — yetkinin TEK KAYNAĞI transitions.ts.
 */
export async function personeleDonustur(opts: {
  prisma: PrismaClient;
  app: BasvuruKaynak;
  girdi: ElleGirilen;
  karar: DonusumKarari;
  actorId: string;
  ipAddress: string | null;
  /** Bölüm hiyerarşisi (bolumMuduru/birimSorumlusu/sorumlu2/sorumlu3) — FK'dan çözülmüş. */
  hiyerarsi: {
    bolumMuduru: string | null;
    birimSorumlusu: string | null;
    sorumlu2: string | null;
    sorumlu3: string | null;
  };
}): Promise<DonusumSonuc> {
  const { prisma, app, girdi, karar, actorId, ipAddress, hiyerarsi } = opts;

  // Statü kapısı — matris otoritesi. EVRAK_HAZIRLIK → ISE_BASLADI (IK).
  if (!canTransition(app.status, "ISE_BASLADI", "IK")) {
    throw new DonusumError(
      `Bu başvuru işbaşı için uygun değil (statü: ${app.status}). Önce Evrak Hazırlık aşamasına alın.`,
      400,
      "STATU_UYGUN_DEGIL",
    );
  }
  if (app.status === "ISE_BASLADI") {
    throw new DonusumError("Bu başvuru zaten personele dönüştürülmüş.", 409, "ZATEN_DONUSTU");
  }

  const oto = otomatikAlanlar(app);
  // Cinsiyet: başvuru → İV girdisi sırasıyla. İkisi de yoksa DUR (varsayılan uydurulmaz).
  const cinsiyet = oto.cinsiyet ?? girdi.cinsiyet ?? null;
  if (!cinsiyet) {
    throw new DonusumError(
      "Cinsiyet bilgisi başvuruda yok — personel kaydı için seçilmesi zorunlu.",
      400,
      "CINSIYET_GEREKLI",
    );
  }
  const giris = new Date(girdi.iseGirisTarihi);
  if (Number.isNaN(giris.getTime())) {
    throw new DonusumError("İşe giriş tarihi geçersiz.", 400, "TARIH_GECERSIZ");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 4a) TC kontrolü tx İÇİNDE tekrar edilir — form açıldıktan sonra başka biri aynı
      //     TC ile kayıt açmış olabilir (TOCTOU). Aktif eşleşme varsa dönüşüm İPTAL.
      const tc = await tcKontrol(tx, oto.tcKimlikNo);
      if (tc.durum === "AKTIF_VAR") {
        throw new DonusumError(tc.mesaj, 409, "AKTIF_TC_CAKISMASI");
      }
      if (karar.tip === "YENI" && tc.durum === "PASIF_VAR") {
        // İV pasif kaydı görüp yine de "yeni kart" dediyse geçilir; ama kararı görmeden
        // gelen istek (doğrudan API) burada durur.
        // (UI zaten iki yolu sunar; bu guard sessiz mükerrer kart açılmasını engeller.)
        if (girdi.mukerrerOnaylandi !== true) {
          throw new DonusumError(tc.mesaj, 409, "PASIF_TC_KARARI_GEREKLI");
        }
      }

      // 4a2) Benzersizlik ÖN-KONTROLÜ — tx İÇİNDE. Prisma v7 + pg adapter'da P2002'nin
      //      meta.target'ı boş gelebiliyor; hangi alanın çakıştığını net söyleyebilmek için
      //      önce burada bakılır. Yarış durumunda aşağıdaki P2002 yakalayıcısı yedektir.
      const sicilSahibi = await tx.personnel.findUnique({
        where: { sicilNo: girdi.sicilNo },
        select: { id: true, adSoyad: true },
      });
      if (sicilSahibi && !(karar.tip === "MEVCUDA_BAGLA" && sicilSahibi.id === karar.personnelId)) {
        throw new DonusumError(
          `Sicil no "${girdi.sicilNo}" zaten kullanılıyor: ${sicilSahibi.adSoyad}. Hiçbir kayıt oluşturulmadı.`,
          409,
          "SICIL_CAKISMASI",
        );
      }
      const bagliOlan = await tx.personnel.findUnique({
        where: { jobApplicationId: app.id },
        select: { id: true, adSoyad: true, sicilNo: true },
      });
      if (bagliOlan) {
        throw new DonusumError(
          `Bu başvuru zaten bir personel kaydına bağlı: ${bagliOlan.adSoyad} (${bagliOlan.sicilNo ?? "sicil yok"}). Hiçbir kayıt oluşturulmadı.`,
          409,
          "BASVURU_ZATEN_BAGLI",
        );
      }

      const ortakVeri = {
        adSoyad: oto.adSoyad,
        cinsiyet,
        kanGrubu: oto.kanGrubu,
        mailAdresi: oto.mailAdresi,
        telefon: oto.telefon,
        ikametAdresi: oto.ikametAdresi,
        egitimTipi: oto.egitimTipi,
        // İV düzeltmişse onun değeri kazanır (undefined = dokunma değil; açıkça null olabilir).
        egitimYeri: girdi.egitimYeri !== undefined ? girdi.egitimYeri : oto.egitimYeri,
        egitimAlani: girdi.egitimAlani !== undefined ? girdi.egitimAlani : oto.egitimAlani,
        mezuniyetYili: girdi.mezuniyetYili !== undefined ? girdi.mezuniyetYili : oto.mezuniyetYili,
        sicilNo: girdi.sicilNo,
        yakaRengi: girdi.yakaRengi,
        yakaDetayi: girdi.yakaDetayi ?? null,
        direktEndirekt: girdi.direktEndirekt,
        asansorMekanik: girdi.asansorMekanik ?? null,
        sinif: girdi.sinif ?? null,
        masrafMerkezi: girdi.masrafMerkezi ?? null,
        bolum: girdi.bolum,
        bolumDetay: girdi.bolumDetay ?? null,
        gorev: girdi.gorev,
        iseGirisTarihi: giris,
        bolumMuduru: hiyerarsi.bolumMuduru,
        birimSorumlusu: hiyerarsi.birimSorumlusu,
        sorumlu2: hiyerarsi.sorumlu2,
        sorumlu3: hiyerarsi.sorumlu3,
        jobApplicationId: app.id,
      };

      let personnelId: string;
      let yenidenIseAlim = false;

      if (karar.tip === "MEVCUDA_BAGLA") {
        // Yeniden işe alım: KART KORUNUR (geçmiş dönemler, zimmet, beden profili duruyor).
        const mevcut = await tx.personnel.findUnique({
          where: { id: karar.personnelId },
          select: { id: true, aktif: true },
        });
        if (!mevcut) throw new DonusumError("Bağlanacak personel kaydı bulunamadı.", 404, "PERSONEL_YOK");
        if (mevcut.aktif) {
          throw new DonusumError("Bu personel zaten aktif — yeniden işe alım yapılamaz.", 409, "ZATEN_AKTIF");
        }
        await tx.personnel.update({
          where: { id: mevcut.id },
          data: { ...ortakVeri, aktif: true },
        });
        personnelId = mevcut.id;
        yenidenIseAlim = true;
      } else {
        const olusan = await tx.personnel.create({
          data: { ...ortakVeri, aktif: true, createdBy: actorId },
        });
        personnelId = olusan.id;
      }

      // 4b) Hassas veri — upsert (yeniden işe alımda kayıt zaten olabilir).
      await tx.personnelSensitive.upsert({
        where: { personnelId },
        create: {
          personnelId,
          tcKimlikNo: oto.tcKimlikNo,
          dogumTarihi: oto.dogumTarihi,
          updatedBy: actorId,
        },
        update: {
          tcKimlikNo: oto.tcKimlikNo,
          dogumTarihi: oto.dogumTarihi,
          updatedBy: actorId,
        },
      });

      // 4c) Açık istihdam dönemi (POST /api/personnel ile aynı desen).
      await tx.employmentPeriod.create({
        data: {
          personnelId,
          girisTarihi: giris,
          cikisTarihi: null,
          entryRecordedById: actorId,
          entryRecordedAt: new Date(),
        },
      });

      // 4d) Beden profili — üçü de boşsa satır AÇILMAZ.
      let bedenProfiliOlustu = false;
      if (oto.beden) {
        await tx.envanterPersonelBedenProfili.upsert({
          where: { personnelId },
          create: { personnelId, ...oto.beden, updatedById: actorId },
          update: { ...oto.beden, updatedById: actorId },
        });
        bedenProfiliOlustu = true;
      }

      // 4e) Org koltuğu — İKİNCİL (eşleşme yoksa koltuk açılmaz, dönüşüm yine de geçerli).
      await personelEklendiginde(tx, personnelId, { actorId });

      // 4f) Başvuru: statü + aşama kaydı AYNI tx'te. (stage-log helper'ı kendi tx'ini açtığı
      //     için burada doğrudan yazılır — atomiklik şartı bölünemez.)
      await tx.publicJobApplication.update({
        where: { id: app.id },
        data: { status: "ISE_BASLADI" },
      });
      await tx.publicJobApplicationStageLog.create({
        data: {
          applicationId: app.id,
          fromStatus: app.status,
          toStatus: "ISE_BASLADI",
          changedBy: actorId,
          note: yenidenIseAlim
            ? `Personel kaydına bağlandı (yeniden işe alım) · sicil ${girdi.sicilNo}`
            : `Personel kaydı oluşturuldu · sicil ${girdi.sicilNo}`,
        },
      });

      // 4g) KVKK erişim izi — hassas veri YAZIMI (mevcut 'CREATE_SENSITIVE' tipi).
      await tx.personnelAccessLog.create({
        data: { personnelId, accessedBy: actorId, accessType: "CREATE_SENSITIVE", ipAddress },
      });

      return {
        personnelId,
        sicilNo: girdi.sicilNo,
        yenidenIseAlim,
        bedenProfiliOlustu,
        applicationId: app.id,
      };
    });
  } catch (err) {
    if (err instanceof DonusumError) throw err;
    // Benzersizlik çakışmaları — tx zaten geri alındı, HİÇBİR kayıt oluşmadı.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const hedef = (err.meta?.target as string[] | string | undefined) ?? "";
      const alan = Array.isArray(hedef) ? hedef.join(",") : String(hedef);
      if (alan.includes("sicilNo")) {
        throw new DonusumError(
          `Sicil no "${girdi.sicilNo}" başka bir personelde kullanılıyor. Hiçbir kayıt oluşturulmadı.`,
          409,
          "SICIL_CAKISMASI",
        );
      }
      if (alan.includes("jobApplicationId")) {
        throw new DonusumError(
          "Bu başvuru zaten bir personel kaydına bağlı. Hiçbir kayıt oluşturulmadı.",
          409,
          "BASVURU_ZATEN_BAGLI",
        );
      }
      throw new DonusumError(`Benzersizlik çakışması (${alan}). Hiçbir kayıt oluşturulmadı.`, 409, "CAKISMA");
    }
    throw err;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 5) MEVCUT KAYDA BAĞLA VE KAPAT  (mükerrer TC'de ÜÇÜNCÜ yol)
// ─────────────────────────────────────────────────────────────────────────────
// Gerçek senaryo: İV adayı ZATEN elle personel listesine eklemiş (Excel'den), başvuru
// akışta açıkta kalmış. Form eskiden yalnız BLOKLUYORDU; bağlama işi iki kez elle SQL ile
// yapıldı (Uğur Gökdaş 17.08, Cihan Temel 18.08). Bu fonksiyon o işi formun içine alır.
//
// YAPILAN: Personnel.jobApplicationId = başvuru · başvuru statüsü ISE_BASLADI · StageLog +1.
// YAPILMAYAN: yeni Personnel/PersonnelSensitive/EmploymentPeriod YOK; personelin başka
// HİÇBİR alanı güncellenmez (bölüm/görev/tarih hepsi İV'nin girdiği hâliyle kalır).

/** İsim karşılaştırma normalizasyonu — TR büyük harf + fazla boşluk sadeleştirme.
 *  Düz toUpperCase() KULLANILMAZ ("i" bozulur). */
function adNormalize(v: string | null | undefined): string {
  return (v ?? "").toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim();
}

export type BaglamaUygunluk =
  | { uygun: true }
  | { uygun: false; sebep: string };

/**
 * "Bağla ve kapat" bu (başvuru, personel) çifti için mümkün mü?
 * TEK KAYNAK — hem GET önizlemesi (buton çizilsin mi) hem POST guard'ı bunu kullanır,
 * böylece ekranın gördüğü ile sunucunun uyguladığı sapamaz.
 */
export function baglamaUygunMu(args: {
  basvuruStatus: JobApplicationStatus;
  personelAktif: boolean;
  personelJobApplicationId: string | null;
  personelAdSoyad: string;
  basvuruAdSoyad: string;
}): BaglamaUygunluk {
  // PASİF personel bu yoldan GEÇMEZ: onun için "yeniden işe alım" yolu zaten var
  // (aktif=true + yeni EmploymentPeriod) ve o davranış DEĞİŞMEDİ.
  if (!args.personelAktif) {
    return { uygun: false, sebep: "Personel pasif — yeniden işe alım yolu kullanılmalı" };
  }
  if (args.personelJobApplicationId) {
    return { uygun: false, sebep: "Bu personel zaten başka bir başvuruya bağlı" };
  }
  // Matristeki MEŞRU kenar: EVRAK_HAZIRLIK → ISE_BASLADI (İK). Başka statüde İV önce
  // akışı ilerletmeli — veri katmanından matris delinmez.
  if (!canTransition(args.basvuruStatus, "ISE_BASLADI", "IK")) {
    return {
      uygun: false,
      sebep: `Başvuru "${args.basvuruStatus}" statüsünde; önce Evrak Hazırlık aşamasına alınmalı`,
    };
  }
  // TC doğru ama FARKLI kişi olabilir — ad eşleşmeden bağlanmaz.
  if (adNormalize(args.personelAdSoyad) !== adNormalize(args.basvuruAdSoyad)) {
    return { uygun: false, sebep: "TC aynı ama ad farklı, kontrol edin" };
  }
  return { uygun: true };
}

export type BaglamaSonuc = {
  personnelId: string;
  sicilNo: string | null;
  applicationId: string;
  baglandi: true;
};

export async function mevcutKaydaBagla(opts: {
  prisma: PrismaClient;
  applicationId: string;
  personnelId: string;
  actorId: string;
}): Promise<BaglamaSonuc> {
  const { prisma, applicationId, personnelId, actorId } = opts;
  return prisma.$transaction(async (tx) => {
    const p = await tx.personnel.findUnique({
      where: { id: personnelId },
      select: { id: true, sicilNo: true, adSoyad: true, aktif: true, jobApplicationId: true },
    });
    if (!p) throw new DonusumError("Personel kaydı bulunamadı.", 404, "PERSONEL_YOK");

    const a = await tx.publicJobApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true, fullName: true, tcKimlikNo: true },
    });
    if (!a) throw new DonusumError("Başvuru bulunamadı.", 404, "BASVURU_YOK");

    // TC gerçekten aynı mı — istemciden gelen personnelId'ye körü körüne güvenilmez.
    const s = await tx.personnelSensitive.findUnique({
      where: { personnelId },
      select: { tcKimlikNo: true },
    });
    const tcP = (s?.tcKimlikNo ?? "").replace(/\s/g, "");
    const tcA = (a.tcKimlikNo ?? "").replace(/\s/g, "");
    if (!tcP || !tcA || tcP !== tcA) {
      throw new DonusumError("TC kimlik numaraları eşleşmiyor.", 409, "TC_ESLESMIYOR");
    }

    // Uygunluk TEK KAYNAKTAN, tx İÇİNDE tekrar (form açıldıktan sonra durum değişebilir).
    const u = baglamaUygunMu({
      basvuruStatus: a.status,
      personelAktif: p.aktif,
      personelJobApplicationId: p.jobApplicationId,
      personelAdSoyad: p.adSoyad,
      basvuruAdSoyad: a.fullName,
    });
    if (!u.uygun) throw new DonusumError(u.sebep, 409, "BAGLAMA_UYGUN_DEGIL");

    await tx.personnel.update({ where: { id: p.id }, data: { jobApplicationId: a.id } });
    await tx.publicJobApplication.update({ where: { id: a.id }, data: { status: "ISE_BASLADI" } });
    await tx.publicJobApplicationStageLog.create({
      data: {
        applicationId: a.id,
        fromStatus: a.status,
        toStatus: "ISE_BASLADI",
        changedBy: actorId,
        note: "Personel kaydi daha once olusturulmustu; basvuru mevcut kayda baglandi",
      },
    });
    return { personnelId: p.id, sicilNo: p.sicilNo, applicationId: a.id, baglandi: true as const };
  });
}
