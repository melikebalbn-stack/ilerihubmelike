/**
 * Personel (kadro) talebi GÖRÜNÜRLÜĞÜ — TEK KAYNAK.
 *
 * Liste ucu (GET /api/strategic-hr/recruitment/personnel-requests), Excel export ucu
 * (.../export) ve detay ucu (.../[id]) AYNI kapsam kuralını kullansın diye buraya
 * çıkarıldı; iki uç ıraksamasın.
 *
 * KURAL (21.09.2026 — koltuk kapsamı; LDAP User.department metin eşleşmesi KALDIRILDI):
 *   · admin (recruitment.admin)              → hepsi
 *   · koltuk kapsamı (kadroTalepKapsamCoz)  → talep sahibi kapsamdaki bölümün personeli olan
 *                                              talepler (Personnel FK → DepartmentDefinition)
 *   · kendi açtığı (requesterEmail)          → her zaman
 *   · ATANMIŞ ONAYCI (PersonnelRequestApproval.approverId = ben, herhangi adım) → her zaman
 *   · erişim yok (ön kapı)                   → hiçbir kayıt
 *   · ?myRequests=true                       → yalnız kendi açtığı (admin dahil, en öncelikli)
 *   · ?department=                           → YALNIZ admin'de (PersonnelRequest.department
 *                                              serbest filtre; kapsam değil)
 *
 * YAZMA yetkisi burada DEĞİL: talep açma `kadroTalepYetkisi()`, onay/red per-step guard
 * [id]/route.ts içinde. Bu modül yalnız OKUMA kapsamıdır.
 */
import type { Prisma, PersonnelRequestStatus } from "@/generated/prisma";

export type KadroTalepKapsam = {
  /** recruitment.admin — tüm talepleri görür, ?department= filtresini kullanabilir. */
  hasFullAccess: boolean;
  /** (geri uyum) eskiden recruitment.view; artık kapsam koltuktan gelir — bilgi amaçlı */
  canViewByDept: boolean;
  userId: string;
  userEmail: string;
  /** Koltuk kapsamındaki talep sahipleri (User id); null = tümü */
  requesterIdler: string[] | null;
  /** Liste/export sorgusu için hazır `where` (status + department filtreleri dahil). */
  where: Prisma.PersonnelRequestWhereInput;
  /** Ön kapı kararı. false → hiçbir kayıt. */
  erisebilir: boolean;
};

type OturumParcasi = {
  user: { id?: string; email?: string | null; permissions?: string[] };
};

/** Ön kapı + koltuk kapsamı (kadroTalepKapsamCoz çıktısı). */
export type KapsamGirdisi = { erisebilir: boolean; requesterIdler: string[] | null };

/**
 * Oturum + kapsam + query string'ten okuma `where`'ini kurar (saf; DB'ye gitmez —
 * kapsam çözümü kadroTalepKapsamCoz ile önceden yapılır).
 * `searchParams` verilmezse (detay ucu) yalnız bayraklar anlamlıdır; `where` boş kalır.
 */
export function kadroTalepGorunurluk(
  session: OturumParcasi,
  searchParams: URLSearchParams | undefined,
  kapsam: KapsamGirdisi,
): KadroTalepKapsam {
  const userId = session.user.id ?? "";
  const userEmail = (session.user.email || "").toLowerCase();
  const perms = session.user.permissions ?? [];
  const hasFullAccess = perms.includes("recruitment.admin");
  const canViewByDept = perms.includes("recruitment.view");
  const requesterIdler = hasFullAccess ? null : kapsam.requesterIdler;

  // Soft-delete süzgeci (22.09.2026): silinmiş talep hiçbir kapsamda listelenmez.
  const where: Prisma.PersonnelRequestWhereInput = { silindiMi: false };
  const out = { hasFullAccess, canViewByDept, userId, userEmail, requesterIdler, where, erisebilir: kapsam.erisebilir };

  // Savunma: ön kapıyı geçmemiş çağrı → hiçbir kayıt (id eşleşmez). Uçlar zaten 403 döner.
  if (!kapsam.erisebilir) {
    return { ...out, hasFullAccess: false, canViewByDept: false, requesterIdler: [], where: { id: "__erisim_yok__" } };
  }

  if (searchParams) {
    const status = searchParams.get("status") as PersonnelRequestStatus | null;
    const department = searchParams.get("department");
    const myRequests = searchParams.get("myRequests") === "true";

    if (myRequests) {
      where.requesterEmail = userEmail;
    } else if (!hasFullAccess) {
      // Koltuk kapsamı ∪ kendi açtıkları ∪ atanmış onaycı olduğu (herhangi adım)
      where.OR = [
        ...(requesterIdler && requesterIdler.length > 0 ? [{ requesterId: { in: requesterIdler } }] : []),
        { requesterEmail: userEmail },
        { approvals: { some: { approverId: userId } } },
      ];
    }

    if (status) where.status = status;
    // Serbest departman filtresi YALNIZ admin'de (kapsam değil, kullanıcı süzgeci).
    if (department && hasFullAccess) where.department = department;
  }

  return out;
}

/**
 * Tek kaydın detayını görebilir mi? (Liste `where`'inin kayıt bazlı karşılığı.)
 * erişim yok → hayır; admin → evet; sahibi → evet; atanmış onaycı → evet;
 * talep sahibi koltuk kapsamında → evet; diğerleri → hayır (403).
 */
export function kadroTalepGorebilirMi(
  kapsam: Pick<KadroTalepKapsam, "hasFullAccess" | "userId" | "userEmail" | "requesterIdler"> & { erisebilir?: boolean },
  talep: { requesterEmail: string; requesterId: string; approvals?: { approverId: string | null }[] },
): boolean {
  if (kapsam.erisebilir === false) return false;
  if (kapsam.hasFullAccess) return true;
  if (talep.requesterEmail.toLowerCase() === kapsam.userEmail) return true;
  if (talep.approvals?.some((a) => a.approverId === kapsam.userId)) return true;
  if (kapsam.requesterIdler === null) return true;
  return kapsam.requesterIdler.includes(talep.requesterId);
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
