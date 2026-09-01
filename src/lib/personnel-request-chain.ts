import type { Prisma, PrismaClient } from "@/generated/prisma";

// Kadro (eleman talebi) onay zinciri — 4 kademe, SIRALI (Elif geri bildirimi 2. tur):
// BÖLÜM MÜDÜRÜ → GMY → GM → İK MÜDÜRÜ (son onaycı). Talep tipine göre ayrım YOK.
// - BÖLÜM MÜDÜRÜ: requester → personnelId → Personnel.bolum → DepartmentDefinition.mudurId → User.
// - GMY / GM / İK MÜDÜRÜ: ApprovalPosition kodları (DEPUTY_GM / GM / HR_MANAGER).
export const PERSONNEL_REQUEST_CHAIN = [
  { step: 1, kademe: "BOLUM_MUDURU", role: "Bölüm Müdürü", label: "Bölüm Müdürü" },
  { step: 2, kademe: "DEPUTY_GM", role: "Genel Müdür Yardımcısı", code: "DEPUTY_GM", label: "Genel Müdür Yardımcısı" },
  { step: 3, kademe: "GM", role: "Genel Müdür", code: "GM", label: "Genel Müdür" },
  { step: 4, kademe: "HR_MANAGER", role: "İK Müdürü", code: "HR_MANAGER", label: "İK Müdürü" },
] as const;

type Db = PrismaClient | Prisma.TransactionClient;

export type CozulenAdim = { step: number; kademe: string; role: string; approverId: string };
export type CozumSonuc =
  | { ok: true; adimlar: CozulenAdim[] }
  | { ok: false; error: string };

// 4 onaycıyı çöz. Bölüm Müdürü departmandan (personnelId gerekli); GMY/GM/İK Müdürü
// sabit ApprovalPosition kodundan. Biri çözülemezse submit BLOKE + net hata.
// LDAP User.department KULLANILMAZ, normalizasyon/alias YOK — yanlış müdüre düşmektense bloke.
export async function resolveApprovers(db: Db, requesterId: string): Promise<CozumSonuc> {
  // (1) BÖLÜM MÜDÜRÜ: requester → personnelId → Personnel.bolum → DepartmentDefinition → mudurId → User
  const user = await db.user.findUnique({
    where: { id: requesterId },
    select: {
      personnelId: true,
      // FAZ 2: bölüm tanımı FK üzerinden aynı sorguda geliyor; `bolum` metni
      // yalnız geri düşüş ve hata mesajı için okunuyor.
      personnel: {
        select: {
          bolum: true,
          departmentId: true,
          department: { select: { mudurId: true, name: true } },
        },
      },
    },
  });
  if (!user?.personnelId || !user.personnel) {
    return { ok: false, error: "Personel kaydınız bulunamadı. Onay zinciri kurulamıyor, İK ile iletişime geçin." };
  }
  const bolum = (user.personnel.bolum ?? "").trim();
  // FK YOLU önce; FK boşsa (pasif kayıt / FK'dan önceki veri) eski ad eşleşmesine düş.
  let deptDef = user.personnel.department ?? null;
  if (!deptDef) {
    if (!bolum) {
      return { ok: false, error: "Personel kaydınızda bölüm bilgisi yok. İK ile iletişime geçin." };
    }
    deptDef = await db.departmentDefinition.findFirst({ where: { name: bolum }, select: { mudurId: true, name: true } });
  }
  if (!deptDef) {
    return { ok: false, error: `Departmanınız ("${bolum}") sistemde tanımlı değil. İK ile iletişime geçin.` };
  }
  if (!deptDef.mudurId) {
    return { ok: false, error: `Departmanınıza ("${deptDef.name}") müdür atanmamış. İK ile iletişime geçin.` };
  }
  const mudurUser = await db.user.findFirst({ where: { personnelId: deptDef.mudurId }, select: { id: true } });
  if (!mudurUser) {
    return { ok: false, error: `Departman müdürünüzün sistem kullanıcısı bulunamadı. İK ile iletişime geçin.` };
  }

  // (2-4) GMY / GM / İK MÜDÜRÜ: ApprovalPosition kodları
  const positions = await db.approvalPosition.findMany({
    where: { code: { in: ["DEPUTY_GM", "GM", "HR_MANAGER"] } },
    select: { code: true, userId: true },
  });
  const userIdByCode = new Map(positions.map((p) => [p.code, p.userId]));
  const approverByKademe: Record<string, string | null> = {
    BOLUM_MUDURU: mudurUser.id,
    DEPUTY_GM: userIdByCode.get("DEPUTY_GM") ?? null,
    GM: userIdByCode.get("GM") ?? null,
    HR_MANAGER: userIdByCode.get("HR_MANAGER") ?? null,
  };

  const adimlarHam: CozulenAdim[] = [];
  for (const k of PERSONNEL_REQUEST_CHAIN) {
    const approverId = approverByKademe[k.kademe];
    if (!approverId) {
      return { ok: false, error: `${k.label} pozisyonu sistemde atanmamış. İK ile iletişime geçin.` };
    }
    adimlarHam.push({ step: k.step, kademe: k.kademe, role: k.role, approverId });
  }

  // KENDİ KENDİNİ ONAYLAMA ENGELİ (A seçeneği): talep eden bir adımın onaycısıysa
  // O ADIM HİÇ OLUŞTURULMAZ (otomatik onaylı damgalama YOK — sahte onay kaydı kalmaz).
  // Genel kural — müdür/müdür yrd/GMY/GM fark etmez: approverId === requesterId → atla.
  let adimlarSuzulu = adimlarHam.filter((a) => a.approverId !== requesterId);

  // Zincir boş kalırsa (ör. tüm adımların onaycısı talep edenin kendisi) en az
  // İK Müdürü adımı kalsın — onaysız talep OLMASIN.
  if (adimlarSuzulu.length === 0) {
    const hr = adimlarHam.find((a) => a.kademe === "HR_MANAGER");
    if (hr) adimlarSuzulu = [hr];
  }

  // Step numaralarını yeniden sırala (1..n, boşluksuz) — UNIQUE(request, step) için.
  const adimlar: CozulenAdim[] = adimlarSuzulu.map((a, i) => ({ ...a, step: i + 1 }));
  return { ok: true, adimlar };
}
