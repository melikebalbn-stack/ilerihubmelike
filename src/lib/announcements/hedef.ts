import { normalizeTr } from "@/lib/normalize-tr";
import type { PrismaClient } from "@/generated/prisma";

/**
 * Duyuru hedef-kitle (departman) eşleşmesi — TEK KAYNAK.
 *
 * Sorun 1: form "Sistem Geliştirme" yazıyor; departman metni "…Departmanı/
 * Müdürlüğü" varyantlı. Çözüm: normalizeTr + kurumsal ek ("departmanı/müdürlüğü/
 * bölümü") soyularak karşılaştır (bolumEsit).
 * Sorun 2 (28.09): eşleşme User.department (Azure) üzerinden yapılıyordu; bazı
 * personelde Azure department BOŞ (ör. Nursel Micik) → hedefte olsa da bildirim/
 * popup ALMIYORDU. Çözüm: KAYNAK = Personnel.bolum (HR master, dolu; atama
 * modülüyle aynı kaynak). User.department yalnız fallback.
 */

// normalizeTr sonrası (küçük + Türkçe harf sadeleştirme) kurumsal ekler.
// "Departmanı"→departmani, "Müdürlüğü/Müdürlügü"→mudurlugu, "Bölümü"→bolumu,
// "Müdürlük"→mudurluk, "Birimi"→birimi.
const EKLER_NORM = ["departmani", "mudurlugu", "mudurluk", "bolumu", "birimi"];

/** normalizeTr + sondaki kurumsal eki soy + trim. */
export function normalizeBolum(s: string | null | undefined): string {
  let x = normalizeTr(s ?? "").trim();
  for (const ek of EKLER_NORM) {
    if (x === ek) break; // yalnız ekten ibaretse dokunma
    if (x.endsWith(" " + ek)) {
      x = x.slice(0, x.length - ek.length - 1).trim();
      break;
    }
  }
  return x;
}

/** İki bölüm adı (form değeri ↔ User.department) aynı bölümü mü gösteriyor? */
export function bolumEsit(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeBolum(a);
  const nb = normalizeBolum(b);
  return na.length > 0 && na === nb;
}

/**
 * Bir kullanıcının bölümüyle eşleşen TÜM hedef-departman string'leri
 * (DB'deki DEPARTMENTS duyurularının targetDepartments değerlerinden). Route'lar
 * bunu `targetDepartments hasSome <liste>` ile kullanır → pagination korunur,
 * tam-metin karşılaştırma kalmaz. `userBolum` = Personnel.bolum (fallback User.department).
 */
export async function eslesenHedefBolumler(
  prisma: Pick<PrismaClient, "announcement">,
  userBolum: string | null | undefined
): Promise<string[]> {
  if (!userBolum) return [];
  const rows = await prisma.announcement.findMany({
    where: { targetType: "DEPARTMENTS" },
    select: { targetDepartments: true },
  });
  const all = new Set<string>();
  for (const r of rows) for (const d of r.targetDepartments) all.add(d);
  return [...all].filter((d) => bolumEsit(d, userBolum));
}

/** Kullanıcının bölümü: Personnel.bolum (HR master) öncelikli, User.department fallback. */
export async function kullaniciBolumu(
  prisma: Pick<PrismaClient, "user">,
  userId: string
): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { department: true, personnel: { select: { bolum: true } } },
  });
  return u?.personnel?.bolum ?? u?.department ?? null;
}

/**
 * Hedef departmanlarla eşleşen aktif kullanıcı id'leri (notify audience için).
 * KAYNAK = Personnel.bolum (Azure User.department boş olabilir → hedef kaçardı).
 * Aday kullanıcılar çekilip JS'te bolumEsit ile süzülür (kullanıcı sayısı küçük).
 */
export async function eslesenKullaniciIdleri(
  prisma: Pick<PrismaClient, "user">,
  targetDepartments: string[],
  opts?: { excludeUserId?: string }
): Promise<string[]> {
  if (!targetDepartments.length) return [];
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      email: { not: "" },
      personnel: { is: { aktif: true } },
      ...(opts?.excludeUserId ? { id: { not: opts.excludeUserId } } : {}),
    },
    select: { id: true, department: true, personnel: { select: { bolum: true } } },
  });
  return users
    .filter((u) => {
      const bolum = u.personnel?.bolum ?? u.department;
      return targetDepartments.some((td) => bolumEsit(td, bolum));
    })
    .map((u) => u.id);
}
