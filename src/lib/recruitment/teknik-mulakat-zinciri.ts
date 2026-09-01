// Teknik mülakat 2. kademe — ÜST AMİR ÇÖZÜMÜ. TEK KAYNAK.
//
// personnel-request-chain.ts deseni izlenir (yeni desen kurulmaz):
//   · zincir adımları sabit bir listeden gelir
//   · çözülemezse SESSİZ GEÇMEZ — net Türkçe hata döner, çağıran BLOKE eder
//   · kişi adı KOD'A GÖMÜLMEZ, DepartmentDefinition'dan çözülür
//
// ZİNCİR:
//   seçilen mülakatçı (User) → User.personnelId → Personnel.bolum
//   → DepartmentDefinition (name İSİM eşleşmesi, isActive = true)
//   → mudurYardimcisiId varsa O, yoksa mudurId
//   → Personnel.id → User.personnelId → User (aktif olmalı)
//
// KENDİNE ATAMA ENGELİ (zorunlu):
//   1. adım (md.yrd, yoksa müdür) == seçilen kişi  → 2. adıma çık (bölüm müdürü)
//   2. adım (müdür)              == seçilen kişi  → 2. KADEME ATLANIR, karar İV'ye döner
// Keşif (prod, 185 aktif personel): 11 kişi 1. adımda kendini gösteriyor; 7'si 2. adımda
// çözülüyor, 4'ü İV'ye dönüyor (bölümlerinde md.yrd yok ve müdür kendileri).
//
// İSİM EŞLEŞMESİ: Personnel.bolum ↔ DepartmentDefinition.name düz eşleşmedir (FK yok).
// Keşifte 25/25 distinct bölüm değeri eşleşti; normalizasyon GEREKMEDİ. Yine de eşleşme
// bulunamazsa alias denenmez — yanlış amire düşmektense BLOKE (kadro talebiyle aynı ilke).

import type { Prisma, PrismaClient } from "@/generated/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/** Zincir kademeleri — kadro talebindeki PERSONNEL_REQUEST_CHAIN karşılığı. */
export const TEKNIK_MULAKAT_CHAIN = [
  { step: 1, kademe: "TEKNIK_MULAKATCI", label: "Teknik Mülakatçı" },
  { step: 2, kademe: "TEKNIK_UST_AMIR", label: "Üst Amir" },
] as const;

export type UstAmirSonuc =
  /** Üst amir çözüldü — 2. kademe açılacak. */
  | { ok: true; atlandi: false; approverId: string; ad: string; unvan: string; yol: "MUDUR_YRD" | "MUDUR" }
  /** Üst amir seçilen kişinin KENDİSİ — 2. kademe atlanır, karar İV'ye döner. */
  | { ok: true; atlandi: true; sebep: string }
  /** Zincir kurulamadı — geçiş BLOKE, çağıran net hata döndürür. */
  | { ok: false; error: string };

/** Görünen ad — repo genelindeki desen (firstName+lastName → name → email). */
function kullaniciAdi(u: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.name || u.email || "(isimsiz)";
}

/**
 * Seçilen mülakatçının ÜST AMİRİNİ çöz.
 *
 * Dönen `atlandi: true` bir HATA DEĞİLDİR: üst amir seçilen kişinin kendisi çıkmıştır,
 * 2. kademe atlanır ve karar İV'ye döner. Çağıran bunu kullanıcıya açıkça yazmalı.
 */
export async function ustAmirCoz(db: Db, mulakatciUserId: string): Promise<UstAmirSonuc> {
  // (1) Mülakatçı → Personnel (AKTİF olmalı) → bölüm
  const user = await db.user.findUnique({
    where: { id: mulakatciUserId },
    select: {
      personnelId: true,
      // FAZ 2: bölüm tanımı FK üzerinden aynı sorguda. `isActive` de seçiliyor —
      // aşağıdaki AKTİF bölüm şartı FK yolunda da uygulanmak zorunda.
      personnel: {
        select: {
          id: true,
          bolum: true,
          aktif: true,
          adSoyad: true,
          departmentId: true,
          department: { select: { name: true, mudurId: true, mudurYardimcisiId: true, isActive: true } },
        },
      },
    },
  });
  if (!user?.personnelId || !user.personnel) {
    return {
      ok: false,
      error:
        "Seçilen mülakatçının personel kaydı bulunamadı. Üst amir zinciri kurulamıyor — " +
        "personel kaydı bağlı bir kullanıcı seçin.",
    };
  }
  if (!user.personnel.aktif) {
    return {
      ok: false,
      error: `Seçilen mülakatçının personel kaydı pasif (${user.personnel.adSoyad}). Aktif bir kullanıcı seçin.`,
    };
  }
  const bolum = (user.personnel.bolum ?? "").trim();

  // (2) Bölüm → DepartmentDefinition (AKTİF).
  // FK YOLU önce. `isActive` şartı KORUNUYOR: FK dolu ama bölüm pasifse eşleşme
  // yok sayılır (eski `where: { name, isActive: true }` ile birebir aynı sonuç).
  // FK boşsa (pasif kayıt / FK'dan önceki veri) eski isim eşleşmesine düşülür;
  // alias/normalizasyon YOK, orada da olduğu gibi.
  let dept = user.personnel.department?.isActive ? user.personnel.department : null;
  if (!dept) {
    if (!bolum) {
      return {
        ok: false,
        error: "Seçilen mülakatçının personel kaydında bölüm bilgisi yok. İnsan Varlıkları ile iletişime geçin.",
      };
    }
    dept = await db.departmentDefinition.findFirst({
      where: { name: bolum, isActive: true },
      select: { name: true, mudurId: true, mudurYardimcisiId: true, isActive: true },
    });
  }
  if (!dept) {
    return {
      ok: false,
      error: `Mülakatçının bölümü ("${bolum}") sistemde tanımlı değil. İnsan Varlıkları ile iletişime geçin.`,
    };
  }

  // (3) 1. adım: md.yrd varsa O, yoksa müdür.
  const birinciId = dept.mudurYardimcisiId ?? dept.mudurId;
  const birinciYol: "MUDUR_YRD" | "MUDUR" = dept.mudurYardimcisiId ? "MUDUR_YRD" : "MUDUR";
  if (!birinciId) {
    return {
      ok: false,
      error: `"${dept.name}" bölümüne müdür/müdür yardımcısı atanmamış. İnsan Varlıkları ile iletişime geçin.`,
    };
  }

  // KENDİNE ATAMA ENGELİ — 1. adım kendisiyse müdüre çık.
  let hedefPersonnelId = birinciId;
  let yol = birinciYol;
  if (birinciId === user.personnelId) {
    if (!dept.mudurId || dept.mudurId === user.personnelId) {
      // 2. adım da kendisi (ya da müdür yok) → 2. KADEME ATLANIR.
      return {
        ok: true,
        atlandi: true,
        sebep:
          `Seçilen kişi "${dept.name}" bölümünün üst amiri konumunda; kendisini onaylayamaz. ` +
          "Üst amir bulunamadı, karar İnsan Varlıkları'na dönecek.",
      };
    }
    hedefPersonnelId = dept.mudurId;
    yol = "MUDUR";
  }

  // (4) Hedef Personnel → AKTİF User. Kadro talebiyle aynı ilke: User yoksa BLOKE.
  const amirUser = await db.user.findFirst({
    where: { personnelId: hedefPersonnelId, isActive: true },
    select: { id: true, name: true, firstName: true, lastName: true, email: true, jobTitle: true },
  });
  if (!amirUser) {
    const p = await db.personnel.findUnique({
      where: { id: hedefPersonnelId },
      select: { adSoyad: true },
    });
    return {
      ok: false,
      error:
        `Üst amirin (${p?.adSoyad ?? "?"}) aktif sistem kullanıcısı bulunamadı. ` +
        "İnsan Varlıkları ile iletişime geçin.",
    };
  }

  // Son güvenlik ağı: çözülen amir yine seçilen kişiyse (veri tutarsızlığı) kademe atlanır.
  if (amirUser.id === mulakatciUserId) {
    return {
      ok: true,
      atlandi: true,
      sebep: "Üst amir seçilen kişinin kendisi çıktı; karar İnsan Varlıkları'na dönecek.",
    };
  }

  return {
    ok: true,
    atlandi: false,
    approverId: amirUser.id,
    ad: kullaniciAdi(amirUser),
    unvan: amirUser.jobTitle ?? "Üst Amir",
    yol,
  };
}
