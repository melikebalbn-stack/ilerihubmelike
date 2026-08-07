import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

// Org şeması — personel pasifleştiğinde koltuk/vekalet senkronu TEK KAYNAK.
// Personnel.aktif=false yapan HER akış (personel çıkış, soft-delete) bu helper'ı çağırır;
// ikinci bir yere kopyalanmaz.
//
// KURAL: SİLME YOK. OrgEmployee ve OrgUnit kaydı silinmez, pozisyon (OrgUnit) korunur —
//   yalnız koltuk boşalır (OrgEmployee.isActive=false) + kişinin vekaleti kaldırılır.
// İZ: OrgRevizyon (kök departman revizyon geçmişi — RevizyonPanel'de görünür). pozisyon-cikar
//   ile AYNI desen (kokeCik + max revNo + OrgBolumMeta.revNo). `yapan` düz metin olduğu için
//   sistem/otomatik çağrılar da iz bırakır (permission_audit_log.actorId User FK'sinin aksine).
// db: bir transaction içinden çağrılıyorsa tx geçirin → tüm işlem aynı atomik adımda.

type DbClient = Prisma.TransactionClient | typeof prisma;

const MAX_DERINLIK = 15;

export interface KoltukSenkronSonuc {
  kapatilanKoltuklar: { orgEmployeeId: string; orgUnitId: string; displayName: string }[];
  kaldirilanVekaletler: { orgUnitId: string; vekilAdi: string | null }[];
}

export interface KoltukAcmaSonuc {
  acilanKoltuklar: { orgEmployeeId: string; orgUnitId: string; displayName: string }[];
}

// Birimden parentId zinciriyle en üst köke çık (pozisyon-cikar'daki kokeCik ile aynı).
async function kokeCik(db: DbClient, unitId: string): Promise<{ id: string; name: string } | null> {
  let cur = await db.orgUnit.findUnique({
    where: { id: unitId },
    select: { id: true, name: true, parentId: true },
  });
  if (!cur) return null;
  for (let i = 0; i < MAX_DERINLIK && cur.parentId; i++) {
    const parentId: string = cur.parentId;
    const parent = await db.orgUnit.findUnique({
      where: { id: parentId },
      select: { id: true, name: true, parentId: true },
    });
    if (!parent) break;
    cur = parent;
  }
  return { id: cur.id, name: cur.name };
}

// Bir kök departmana revizyon satırı yaz (revNo = mevcut max + 1; OrgBolumMeta.revNo güncelle).
async function revizyonYaz(
  db: DbClient,
  rootId: string,
  rootName: string,
  aciklama: string,
  yapan: string,
  yapanUserId: string | null
): Promise<void> {
  const kokTam = await db.orgUnit.findUnique({ where: { id: rootId }, include: { bolumMeta: true } });
  if (!kokTam) return;
  const maxAgg = await db.orgRevizyon.aggregate({ where: { orgUnitId: rootId }, _max: { revNo: true } });
  let yeniRevNo: number;
  if (maxAgg._max.revNo != null) {
    yeniRevNo = maxAgg._max.revNo + 1;
  } else {
    const mevcut = kokTam.bolumMeta?.revNo ? parseInt(kokTam.bolumMeta.revNo, 10) : 0;
    yeniRevNo = (Number.isNaN(mevcut) ? 0 : mevcut) + 1;
  }
  await db.orgRevizyon.create({
    data: {
      orgUnitId: rootId,
      revNo: yeniRevNo,
      tarih: new Date(),
      aciklama,
      degisiklikYeri: rootName,
      yapan,
      yapanUserId,
    },
  });
  if (kokTam.bolumMeta) {
    await db.orgBolumMeta.update({ where: { orgUnitId: rootId }, data: { revNo: String(yeniRevNo) } });
  }
}

export async function personelPasiflestiginde(
  db: DbClient,
  personnelId: string,
  opts?: { sebep?: string; actorId?: string }
): Promise<KoltukSenkronSonuc> {
  // 1) Kişinin aktif koltukları — önce iz için oku (birim adı + kök için), sonra kapat (SİLME YOK).
  const koltuklar = await db.orgEmployee.findMany({
    where: { personnelId, isActive: true },
    select: { id: true, orgUnitId: true, displayName: true, orgUnit: { select: { name: true } } },
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
    select: { id: true, name: true, vekilAdi: true },
  });
  if (vekaletler.length > 0) {
    await db.orgUnit.updateMany({
      where: { vekilPersonnelId: personnelId },
      data: { vekaletDurumu: false, vekilPersonnelId: null, vekilAdi: null },
    });
  }

  // 3) İz — OrgRevizyon, etkilenen KÖK departman başına bir satır (RevizyonPanel'de görünür).
  if (koltuklar.length > 0 || vekaletler.length > 0) {
    const koke = new Map<string, { name: string; parcalar: string[] }>();
    for (const k of koltuklar) {
      const root = await kokeCik(db, k.orgUnitId);
      if (!root) continue;
      const g = koke.get(root.id) ?? { name: root.name, parcalar: [] };
      g.parcalar.push(`koltuk boşaldı: ${k.orgUnit?.name ?? "?"} (${k.displayName})`);
      koke.set(root.id, g);
    }
    for (const v of vekaletler) {
      const root = await kokeCik(db, v.id);
      if (!root) continue;
      const g = koke.get(root.id) ?? { name: root.name, parcalar: [] };
      g.parcalar.push(`vekalet kaldırıldı: ${v.name} (${v.vekilAdi ?? "?"})`);
      koke.set(root.id, g);
    }
    const yapan = `Sistem — ${opts?.sebep ?? "pasif senkron"}`;
    for (const [rootId, g] of koke) {
      await revizyonYaz(
        db,
        rootId,
        g.name,
        `Pasif personel senkronu — ${g.parcalar.join("; ")}`,
        yapan,
        opts?.actorId ?? null
      );
    }
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

// personelPasiflestiginde'nin SİMETRİĞİ — personel aktife geri alındığında kapanan
// koltuğu yeniden açar. Simetri olmadan çıkış → geri alma döngüsünde koltuk kapalı
// kalıyordu: kişi org şemasında görünüyor (G1 filtresi Personnel.aktif'e bakar) ama
// OrgEmployee.isActive=false olduğu için isActive üzerinden çalışan sorgular onu kaçırıyordu.
//
// KAPSAM: yalnız koltuk. Vekalet GERİ ALINMAZ — vekalet ayrı bir yönetim kararıdır,
//   pasifleşmeyle otomatik kalkar ama dönüşte otomatik geri verilmez.
export async function personelAktiflestiginde(
  db: DbClient,
  personnelId: string,
  opts?: { sebep?: string; actorId?: string }
): Promise<KoltukAcmaSonuc> {
  const koltuklar = await db.orgEmployee.findMany({
    where: { personnelId, isActive: false },
    select: { id: true, orgUnitId: true, displayName: true, orgUnit: { select: { name: true } } },
  });
  if (koltuklar.length === 0) return { acilanKoltuklar: [] };

  await db.orgEmployee.updateMany({
    where: { personnelId, isActive: false },
    data: { isActive: true },
  });

  // İz — pasifleşme ile AYNI desen: etkilenen KÖK departman başına bir OrgRevizyon satırı.
  const koke = new Map<string, { name: string; parcalar: string[] }>();
  for (const k of koltuklar) {
    const root = await kokeCik(db, k.orgUnitId);
    if (!root) continue;
    const g = koke.get(root.id) ?? { name: root.name, parcalar: [] };
    g.parcalar.push(`koltuk yeniden açıldı: ${k.orgUnit?.name ?? "?"} (${k.displayName})`);
    koke.set(root.id, g);
  }
  const yapan = `Sistem — ${opts?.sebep ?? "aktif senkron"}`;
  for (const [rootId, g] of koke) {
    await revizyonYaz(
      db,
      rootId,
      g.name,
      `Aktife alma senkronu — ${g.parcalar.join("; ")}`,
      yapan,
      opts?.actorId ?? null
    );
  }

  return {
    acilanKoltuklar: koltuklar.map((k) => ({
      orgEmployeeId: k.id,
      orgUnitId: k.orgUnitId,
      displayName: k.displayName,
    })),
  };
}
