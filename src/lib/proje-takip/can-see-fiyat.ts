import { prisma } from "@/lib/prisma";
import { normalizeTr } from "@/lib/normalize-tr";

/**
 * Melih Bey'in orijinal tasarımından sapma var — bkz. docs/proje-takip/SCHEMA-DIFF-MELIH.md
 * ("canSeeProjeFiyat" notu). "Yönetim" departman olarak DB'de karşılığı
 * olmadığı için GENEL MÜDÜRLÜK + unvanında "müdür" geçen herkes olarak
 * yeniden tanımlandı (Nurgül onayladı, Melih Bey'e ayrıca bildirilecek).
 *
 * DİKKAT (çağıran taraf): requireUser() varsayılan olarak Personnel'i
 * include ETMEZ — user.personnel'i sağlamak çağıranın sorumluluğu
 * (örn. prisma.user.findUnique({ include: { personnel: { select: { bolum: true, gorev: true } } } })).
 */

const FIYAT_GORUNUR_BOLUMLER = [
  "Mühendislik Müdürlüğü",
  "Satış & Pazarlama Müdürlüğü", // SADECE bu yazım - "SATIŞ PAZARLAMA MÜDÜRLÜĞÜ" (büyük harfli) bilinçli DAHİL DEĞİL
  "GENEL MÜDÜRLÜK",
] as const;

// Bölüm/unvan kuralına girmeyen ama erişimi onaylanan isimler (2026-09-22, Nurgül + Melih Bey).
const FIYAT_GORUNUR_EK_KISILER = [
  "Azra İleri",
] as const;

type ProjeFiyatKullanici = {
  role: string;
  personnel: { bolum: string | null; gorev: string | null; adSoyad: string | null } | null;
};

export function canSeeProjeFiyat(user: ProjeFiyatKullanici): boolean {
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;

  const bolum = normalizeTr(user.personnel?.bolum ?? "");
  if (FIYAT_GORUNUR_BOLUMLER.some((b) => normalizeTr(b) === bolum)) return true;

  const gorev = normalizeTr(user.personnel?.gorev ?? "");
  if (gorev.includes(normalizeTr("müdür"))) return true;

  const adSoyad = normalizeTr(user.personnel?.adSoyad ?? "");
  if (FIYAT_GORUNUR_EK_KISILER.some((k) => normalizeTr(k) === adSoyad)) return true;

  return false;
}

// Çağıran taraf için ortak yardımcı: requireUser()'ın döndürdüğü user'da
// personnel gelmediği için Personnel'i burada ayrıca çekiyor.
export async function resolveCanSeeProjeFiyat(user: {
  role: string;
  personnelId: string | null;
}): Promise<boolean> {
  const personnel = user.personnelId
    ? await prisma.personnel.findUnique({
        where: { id: user.personnelId },
        select: { bolum: true, gorev: true, adSoyad: true },
      })
    : null;
  return canSeeProjeFiyat({ role: user.role, personnel });
}
