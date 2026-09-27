import { normalizeTr } from "@/lib/normalize-tr";
import type { PrismaClient } from "@/generated/prisma";

/**
 * Duyuru hedef-kitle (departman) eşleşmesi — TEK KAYNAK.
 *
 * Sorun: form departman seçicisi "Sistem Geliştirme" (DepartmentDefinition/OrgUnit
 * taksonomisi) yazıyor; User.department Azure AD metni ("Sistem Geliştirme
 * Departmanı", "SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ" varyantları). Tam-metin karşılaştırma
 * tutmuyordu → audience 0 → ne popup ne push. Çözüm: normalizeTr + sondaki
 * kurumsal ek ("departmanı/müdürlüğü/bölümü") soyularak karşılaştır.
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
 * Bir kullanıcının departmanıyla eşleşen TÜM hedef-departman string'leri
 * (DB'deki DEPARTMENTS duyurularının targetDepartments değerlerinden). Route'lar
 * bunu `targetDepartments hasSome <liste>` ile kullanır → pagination korunur,
 * tam-metin karşılaştırma kalmaz.
 */
export async function eslesenHedefBolumler(
  prisma: Pick<PrismaClient, "announcement">,
  userDepartment: string | null | undefined
): Promise<string[]> {
  if (!userDepartment) return [];
  const rows = await prisma.announcement.findMany({
    where: { targetType: "DEPARTMENTS" },
    select: { targetDepartments: true },
  });
  const all = new Set<string>();
  for (const r of rows) for (const d of r.targetDepartments) all.add(d);
  return [...all].filter((d) => bolumEsit(d, userDepartment));
}

/**
 * Hedef departmanlarla eşleşen aktif kullanıcı id'leri (notify audience için).
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
      department: { not: null },
      ...(opts?.excludeUserId ? { id: { not: opts.excludeUserId } } : {}),
    },
    select: { id: true, department: true },
  });
  return users
    .filter((u) => targetDepartments.some((td) => bolumEsit(td, u.department)))
    .map((u) => u.id);
}
