import "server-only";
import { prisma } from "@/lib/prisma";
import { canSeeProjeFiyat } from "./can-see-fiyat";

// Çağıran taraf için ortak yardımcı: requireUser() Personnel'i include ETMEDİĞİ
// için Personnel'i burada ayrıca çekiyor. Sadece sunucu tarafı (page/route) —
// client component'ler canSeeFiyat'ı boolean prop olarak alır.
export async function resolveCanSeeProjeFiyat(user: {
  role: string;
  personnelId: string | null;
}): Promise<boolean> {
  const personnel = user.personnelId
    ? await prisma.personnel.findUnique({
        where: { id: user.personnelId },
        select: { bolum: true },
      })
    : null;
  return canSeeProjeFiyat({ role: user.role, personnel });
}
