import type { Prisma, PrismaClient } from "@/generated/prisma";

// Kadro (eleman talebi) onay zinciri — 3 kademe, sıralı. Mesai APPROVAL_CHAIN deseni.
// MUDUR departmana özel; DEPUTY_GM / GM sabit pozisyon (ApprovalPosition.code → userId).
export const PERSONNEL_REQUEST_CHAIN = [
  { step: 1, kademe: "MUDUR", role: "Departman Müdürü" },
  { step: 2, kademe: "DEPUTY_GM", role: "Genel Müdür Yardımcısı" },
  { step: 3, kademe: "GM", role: "Genel Müdür" },
] as const;

type Db = PrismaClient | Prisma.TransactionClient;

export type CozulenAdim = { step: number; kademe: string; role: string; approverId: string };
export type CozumSonuc =
  | { ok: true; adimlar: CozulenAdim[] }
  | { ok: false; error: string };

// Talep sahibinin departmanına göre 3 onaycıyı User olarak çöz.
// KAYNAK: requester → personnelId → Personnel.bolum → DepartmentDefinition → mudurId → User.
// (LDAP User.department KULLANILMAZ — %63 serbest yazım. Personnel.bolum küratörlü,
// DD taksonomisiyle aynı → mesai onayı da bu kaynağı kullanır.)
// Tahmine dayalı eşleme/normalizasyon YOK — yanlış müdüre düşmektense BLOKE.
export async function resolveApprovers(db: Db, requesterId: string): Promise<CozumSonuc> {
  // (0) Talep sahibinin Personnel bağı
  const user = await db.user.findUnique({
    where: { id: requesterId },
    select: { personnelId: true, personnel: { select: { bolum: true } } },
  });
  if (!user?.personnelId || !user.personnel) {
    return { ok: false, error: "Personel kaydınız bulunamadı. Onay zinciri kurulamıyor, İK ile iletişime geçin." };
  }
  const bolum = (user.personnel.bolum ?? "").trim();
  if (!bolum) {
    return { ok: false, error: "Personel kaydınızda bölüm bilgisi yok. İK ile iletişime geçin." };
  }

  // (1) MUDUR: Personnel.bolum → DepartmentDefinition (birebir) → mudurId → User.personnelId
  const deptDef = await db.departmentDefinition.findFirst({
    where: { name: bolum },
    select: { mudurId: true, name: true },
  });
  if (!deptDef) {
    return { ok: false, error: `Departmanınız ("${bolum}") sistemde tanımlı değil. İK ile iletişime geçin.` };
  }
  if (!deptDef.mudurId) {
    return { ok: false, error: `Departmanınıza ("${deptDef.name}") müdür atanmamış. İK ile iletişime geçin.` };
  }
  const mudurUser = await db.user.findFirst({
    where: { personnelId: deptDef.mudurId },
    select: { id: true },
  });
  if (!mudurUser) {
    return { ok: false, error: `Departman müdürünüzün sistem kullanıcısı bulunamadı. İK ile iletişime geçin.` };
  }

  // (2) DEPUTY_GM ve (3) GM: ApprovalPosition.code → atanmış User (değişmiyor)
  const gmy = await db.approvalPosition.findUnique({ where: { code: "DEPUTY_GM" }, select: { userId: true } });
  const gm = await db.approvalPosition.findUnique({ where: { code: "GM" }, select: { userId: true } });
  if (!gmy?.userId) return { ok: false, error: "Genel Müdür Yardımcısı (DEPUTY_GM) onaycısı atanmamış. İK ile iletişime geçin." };
  if (!gm?.userId) return { ok: false, error: "Genel Müdür (GM) onaycısı atanmamış. İK ile iletişime geçin." };

  const approverByKademe: Record<string, string> = {
    MUDUR: mudurUser.id,
    DEPUTY_GM: gmy.userId,
    GM: gm.userId,
  };

  return {
    ok: true,
    adimlar: PERSONNEL_REQUEST_CHAIN.map((k) => ({
      step: k.step,
      kademe: k.kademe,
      role: k.role,
      approverId: approverByKademe[k.kademe],
    })),
  };
}
