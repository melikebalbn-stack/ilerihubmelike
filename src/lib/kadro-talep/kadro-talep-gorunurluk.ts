/**
 * Personel (kadro) talebi GÖRÜNÜRLÜĞÜ — TEK KAYNAK.
 *
 * Liste ucu (GET /api/strategic-hr/recruitment/personnel-requests), Excel export ucu
 * (.../export) ve detay ucu (.../[id]) AYNI kapsam kuralını kullansın diye buraya
 * çıkarıldı; iki uç ıraksamasın. (rma-query.ts'teki `buildRmaWhere` ile aynı gerekçe —
 * orada liste ve export filtresi elle kopyalanmıştı ve sapma riski taşıyordu.)
 *
 * KURAL (19.09.2026 erişim daraltma — ÖN KAPI kadro-talep-yetki.ts kadroTalepErisimi):
 *   · admin (recruitment.admin)      → hepsi
 *   · view (recruitment.view)        → OR [ kendi departmanı, kendi açtığı ]
 *   · koltuk / kadro.talep.ac        → yalnız kendi açtığı
 *   · hiç yetkisi yok                → ERİŞİM YOK (uçlar ön kapıda 403; buraya gelmez.
 *                                      Gelirse de `erisebilir=false` → hiçbir kayıt)
 *   · ?myRequests=true               → yalnız kendi açtığı (admin dahil, en öncelikli)
 *   · ?department=                   → YALNIZ admin'de dikkate alınır
 * Departman eşleşmesi TAM (contains değil) ve iki taraf da `session.user.department`
 * LDAP string'ini kullanır (POST kaydı da onunla yazıyor) → kendi içinde tutarlı.
 *
 * YAZMA yetkisi burada DEĞİL: talep açma `kadroTalepYetkisi()` (kadro-talep-yetki.ts),
 * onay/red per-step guard'ı [id]/route.ts içinde. Bu modül yalnız OKUMA kapsamıdır.
 */
import type { Prisma, PersonnelRequestStatus } from "@/generated/prisma";

export type KadroTalepKapsam = {
  /** recruitment.admin — tüm talepleri görür, ?department= filtresini kullanabilir. */
  hasFullAccess: boolean;
  /** recruitment.view — kendi departmanı + kendi açtıkları. */
  canViewByDept: boolean;
  userEmail: string;
  userDepartment: string;
  /** Liste/export sorgusu için hazır `where` (status + department filtreleri dahil). */
  where: Prisma.PersonnelRequestWhereInput;
  /** Ön kapı kararı (admin ∨ view ∨ koltuk ∨ kadro.talep.ac). false → hiçbir kayıt. */
  erisebilir: boolean;
};

type OturumParcasi = {
  user: { email?: string | null; department?: string | null; permissions?: string[] };
};

/**
 * Oturum + query string'ten okuma kapsamını çözer.
 * `searchParams` verilmezse (detay ucu) yalnız yetki bayrakları anlamlıdır; `where` boş kalır.
 */
export function kadroTalepGorunurluk(
  session: OturumParcasi,
  searchParams?: URLSearchParams,
  /** Ön kapı kararı (kadroTalepErisimi). Verilmezse eski davranış (yalnız izin bayrakları). */
  erisim?: { erisebilir: boolean },
): KadroTalepKapsam {
  const userEmail = (session.user.email || "").toLowerCase();
  const userDepartment = session.user.department || "";
  const perms = session.user.permissions ?? [];
  const hasFullAccess = perms.includes("recruitment.admin");
  const canViewByDept = perms.includes("recruitment.view");
  const erisebilir = erisim ? erisim.erisebilir : true;

  const where: Prisma.PersonnelRequestWhereInput = {};

  // Savunma: ön kapıyı geçmemiş çağrı → hiçbir kayıt (id eşleşmez). Uçlar zaten 403 döner.
  if (!erisebilir) {
    return { hasFullAccess: false, canViewByDept: false, userEmail, userDepartment, where: { id: "__erisim_yok__" }, erisebilir };
  }

  if (searchParams) {
    const status = searchParams.get("status") as PersonnelRequestStatus | null;
    const department = searchParams.get("department");
    const myRequests = searchParams.get("myRequests") === "true";

    // Kapsam zinciri — SIRA ÖNEMLİ (myRequests admin'i de kapsar; mevcut davranış).
    if (myRequests) {
      where.requesterEmail = userEmail;
    } else if (!hasFullAccess && canViewByDept) {
      where.OR = [{ department: userDepartment }, { requesterEmail: userEmail }];
    } else if (!hasFullAccess) {
      // Koltuk (müdür/müdür yrd.) veya kadro.talep.ac: yalnız kendi açtığı talepler.
      // (Yetkisiz kişi buraya GELMEZ — ön kapı 403.)
      where.requesterEmail = userEmail;
    }

    if (status) where.status = status;
    // Serbest departman filtresi YALNIZ admin'de — non-admin geçerse yok sayılır
    // (yoksa yukarıdaki kapsam kısıtı gevşerdi).
    if (department && hasFullAccess) where.department = department;
  }

  return { hasFullAccess, canViewByDept, userEmail, userDepartment, where, erisebilir };
}

/**
 * Tek kaydın detayını görebilir mi? (Liste `where`'inin kayıt bazlı karşılığı.)
 * erişim yok → hayır; admin → evet; sahibi → evet; view + aynı departman → evet; diğerleri → hayır (403).
 */
export function kadroTalepGorebilirMi(
  kapsam: Pick<KadroTalepKapsam, "hasFullAccess" | "canViewByDept" | "userEmail" | "userDepartment"> & { erisebilir?: boolean },
  talep: { requesterEmail: string; department: string },
): boolean {
  if (kapsam.erisebilir === false) return false;
  if (kapsam.hasFullAccess) return true;
  if (talep.requesterEmail.toLowerCase() === kapsam.userEmail) return true;
  return kapsam.canViewByDept && talep.department === kapsam.userDepartment;
}

/**
 * BÜTÇE ALANLARI YALNIZ ADMIN'E: `salaryMin` / `salaryMax` / `hasBudget` ücret bandıdır
 * ve modelin kendi yorumu da "İK sonradan girer" diyor (POST bunları gövdeden ALMAZ) —
 * yani talebi açan müdürün de görmesi gerekmiyor.
 *
 * Anahtar SİLİNİR, null'lanmaz: admin olmayanın yanıtında alan HİÇ BULUNMAZ
 * (assessments/[id] ucundaki `isCorrect` deseniyle aynı).
 */
export function maasAlanlariniAyikla<
  T extends { salaryMin?: unknown; salaryMax?: unknown; hasBudget?: unknown },
>(kayit: T): Omit<T, "salaryMin" | "salaryMax" | "hasBudget"> {
  const { salaryMin: _a, salaryMax: _b, hasBudget: _c, ...kalan } = kayit;
  return kalan;
}

/** Liste/detay çıktısına bütçe kapısını uygular. Admin'de kayıt AYNEN döner. */
export function maasKapisi<
  T extends { salaryMin?: unknown; salaryMax?: unknown; hasBudget?: unknown },
>(kayitlar: T[], hasFullAccess: boolean) {
  return hasFullAccess ? kayitlar : kayitlar.map(maasAlanlariniAyikla);
}
