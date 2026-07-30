import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { logAuditEvent } from "@/lib/audit-log";

// Org şeması — personel pasifleştiğinde koltuk/vekalet senkronu TEK KAYNAK.
// Personnel.aktif=false yapan HER akış (personel çıkış, soft-delete, danışman, stajyer)
// bu helper'ı çağırır; ikinci bir yere kopyalanmaz.
//
// KURAL: SİLME YOK. OrgEmployee ve OrgUnit kaydı silinmez, pozisyon (OrgUnit) korunur —
//   yalnız koltuk boşalır (OrgEmployee.isActive=false) + kişinin vekaleti kaldırılır.
// db: bir transaction içinden çağrılıyorsa tx geçirin → mutasyonlar aynı atomik işlemde.

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface KoltukSenkronSonuc {
  kapatilanKoltuklar: { orgEmployeeId: string; orgUnitId: string; displayName: string }[];
  kaldirilanVekaletler: { orgUnitId: string; vekilAdi: string | null }[];
}

export async function personelPasiflestiginde(
  db: DbClient,
  personnelId: string,
  opts?: { sebep?: string; actorId?: string }
): Promise<KoltukSenkronSonuc> {
  // 1) Kişinin aktif koltukları — önce iz için oku, sonra kapat (SİLME YOK).
  const koltuklar = await db.orgEmployee.findMany({
    where: { personnelId, isActive: true },
    select: { id: true, orgUnitId: true, displayName: true },
  });
  if (koltuklar.length > 0) {
    await db.orgEmployee.updateMany({
      where: { personnelId, isActive: true },
      data: { isActive: false },
    });
  }

  // 2) Kişi başka birimlerde VEKİL olarak duruyorsa vekaleti kaldır (kayıt silinmez).
  const vekaletler = await db.orgUnit.findMany({
    where: { vekilPersonnelId: personnelId },
    select: { id: true, vekilAdi: true },
  });
  if (vekaletler.length > 0) {
    await db.orgUnit.updateMany({
      where: { vekilPersonnelId: personnelId },
      data: { vekaletDurumu: false, vekilPersonnelId: null, vekilAdi: null },
    });
  }

  // 3) İz kaydı (best-effort — audit hatası pasifleştirmeyi bozmasın; tx'e bağlamıyoruz).
  //    permission_audit_log.actorId User'a FK (nullable değil) → yalnız GEÇERLİ bir kullanıcı
  //    aktörü varsa yazılır. Aktörsüz/sistem çağrılarında (opts.actorId yok) sessizce atlanır;
  //    koltuğun kapanması yine gerçekleşir, çağıran (ör. script) kendi çıktısıyla iz bırakır.
  if ((koltuklar.length > 0 || vekaletler.length > 0) && opts?.actorId) {
    await logAuditEvent({
      action: "ORG_KOLTUK_PASIF_SENKRON",
      actorId: opts.actorId,
      targetType: "PERSONNEL",
      targetId: personnelId,
      details: {
        sebep: opts?.sebep ?? null,
        kapatilanKoltukSayisi: koltuklar.length,
        kaldirilanVekaletSayisi: vekaletler.length,
        orgUnitIds: koltuklar.map((k) => k.orgUnitId),
      },
    });
  }

  return {
    kapatilanKoltuklar: koltuklar.map((k) => ({
      orgEmployeeId: k.id,
      orgUnitId: k.orgUnitId,
      displayName: k.displayName,
    })),
    kaldirilanVekaletler: vekaletler.map((v) => ({ orgUnitId: v.id, vekilAdi: v.vekilAdi })),
  };
}
