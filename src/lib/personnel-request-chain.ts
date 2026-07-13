import type { Prisma, PrismaClient } from "@/generated/prisma";

// Kadro (eleman talebi) onay zinciri — 3 kademe, sıralı. Mesai APPROVAL_CHAIN deseni.
// ÜÇÜ DE ApprovalPosition sabit kodundan çözülür (departmana özel çözümleme YOK).
// Elif geri bildirimi: bölüm müdürü değil, İK MÜDÜRÜ → GMY → GM.
export const PERSONNEL_REQUEST_CHAIN = [
  { step: 1, kademe: "HR_MANAGER", role: "İK Müdürü", code: "HR_MANAGER", label: "İK Müdürü" },
  { step: 2, kademe: "DEPUTY_GM", role: "Genel Müdür Yardımcısı", code: "DEPUTY_GM", label: "Genel Müdür Yardımcısı" },
  { step: 3, kademe: "GM", role: "Genel Müdür", code: "GM", label: "Genel Müdür" },
] as const;

type Db = PrismaClient | Prisma.TransactionClient;

export type CozulenAdim = { step: number; kademe: string; role: string; approverId: string };
export type CozumSonuc =
  | { ok: true; adimlar: CozulenAdim[] }
  | { ok: false; error: string };

// 3 onaycıyı ApprovalPosition kodundan çöz. Talep sahibinin personnelId'si GEREKMEZ —
// departmandan bağımsız (İK Müdürü herkesin talebini onaylar) → personnelId'si olmayan
// kullanıcılar da talep açabilir. Bir kod atanmamışsa submit bloke + net hata.
export async function resolveApprovers(db: Db): Promise<CozumSonuc> {
  const positions = await db.approvalPosition.findMany({
    where: { code: { in: ["HR_MANAGER", "DEPUTY_GM", "GM"] } },
    select: { code: true, userId: true },
  });
  const userIdByCode = new Map(positions.map((p) => [p.code, p.userId]));

  const adimlar: CozulenAdim[] = [];
  for (const k of PERSONNEL_REQUEST_CHAIN) {
    const userId = userIdByCode.get(k.code) ?? null;
    if (!userId) {
      return { ok: false, error: `${k.label} pozisyonu sistemde atanmamış. İK ile iletişime geçin.` };
    }
    adimlar.push({ step: k.step, kademe: k.kademe, role: k.role, approverId: userId });
  }
  return { ok: true, adimlar };
}
