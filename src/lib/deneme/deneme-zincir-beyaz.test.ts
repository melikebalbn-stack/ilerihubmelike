import { describe, it, expect } from "vitest";
import { denemeZinciriCoz } from "./deneme-zincir";

// IV-FR-27 · beyaz yakada müdür yardımcısı adımı (05.10.2026).
//
// DB YOK: denemeZinciriCoz'un dokunduğu tüm okumalar sahte bir Db ile veriliyor
// (personnel.findUnique, user.findFirst, orgEmployee.findFirst, orgUnit.findFirst/
// findUnique). Böylece kural, seed/şema durumundan BAĞIMSIZ sabitlenir.

type Kisi = {
  id: string;
  adSoyad: string;
  gorev: string;
  aktif: boolean;
  yakaRengi?: string;
  sorumlu1Id?: string | null;
  departmentId?: string | null;
  bolum?: string | null;
};

type Dept = {
  id: string;
  name: string;
  mudurId: string | null;
  mudurYardimcisiId: string | null;
  orgUnitId: string | null;
  orgUnitCode: string | null;
};

/** Sahte Db — yalnız zincirin okuduğu alanları karşılar. */
function db(kisiler: Kisi[], dept: Dept, o?: { gmyPersonnelId?: string; parentAdi?: string }) {
  const bul = (id: string | null | undefined) => kisiler.find((k) => k.id === id) ?? null;
  return {
    personnel: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const k = bul(where.id);
        if (!k) return null;
        return {
          id: k.id,
          sicilNo: k.id.toUpperCase(),
          adSoyad: k.adSoyad,
          gorev: k.gorev,
          aktif: k.aktif,
          yakaRengi: k.yakaRengi ?? null,
          sorumlu1Id: k.sorumlu1Id ?? null,
          departmentId: k.departmentId ?? null,
          bolum: k.bolum ?? null,
          department:
            k.departmentId === dept.id
              ? {
                  id: dept.id,
                  name: dept.name,
                  mudurId: dept.mudurId,
                  mudurYardimcisiId: dept.mudurYardimcisiId,
                  orgUnitId: dept.orgUnitId,
                  orgUnit: dept.orgUnitCode ? { code: dept.orgUnitCode } : null,
                }
              : null,
        };
      },
    },
    user: { findFirst: async () => null },
    // Muafiyet kontrolü: kimse GM/GMY kutusunda oturmuyor.
    orgEmployee: {
      findFirst: async ({ where }: { where: { orgUnitId?: string } }) =>
        where?.orgUnitId && o?.gmyPersonnelId ? { personnelId: o.gmyPersonnelId } : null,
    },
    orgUnit: {
      // gmyPersonelId() → GMY kutusu
      findFirst: async () => (o?.gmyPersonnelId ? { id: "ou-gmy", managerId: null } : null),
      // gmyeBagliMi() → bölümün üstü
      findUnique: async () => ({ parent: o?.parentAdi ? { name: o.parentAdi } : null }),
    },
  } as never;
}

const DEPT: Dept = {
  id: "d1",
  name: "Mühendislik Müdürlüğü",
  mudurId: "mudur",
  mudurYardimcisiId: "myrd",
  orgUnitId: "ou-dept",
  orgUnitCode: "ORG-TF-P0100",
};

const TEMEL: Kisi[] = [
  { id: "mudur", adSoyad: "Müdür", gorev: "MÜDÜR", aktif: true },
  { id: "myrd", adSoyad: "Müdür Yrd", gorev: "MÜDÜR YARDIMCISI", aktif: true },
  { id: "sorumlu", adSoyad: "Sorumlu", gorev: "UZMAN", aktif: true },
];

function beyaz(sorumlu1Id: string | null): Kisi {
  return {
    id: "kisi",
    adSoyad: "Deneme Personeli",
    gorev: "UZMAN",
    aktif: true,
    yakaRengi: "BEYAZ",
    sorumlu1Id,
    departmentId: "d1",
    bolum: "Mühendislik Müdürlüğü",
  };
}

describe("denemeZinciriCoz · beyaz yaka + müdür yardımcısı adımı", () => {
  it("beyaz + müdür yrd. VAR → sorumlu1 → müdür yrd. → (onay) müdür", async () => {
    const kisi = beyaz("sorumlu");
    const z = await denemeZinciriCoz(db([...TEMEL, kisi], DEPT), "kisi");
    expect(z.ok).toBe(true);
    if (!z.ok) return;
    expect(z.degerlendirici1.personnelId).toBe("sorumlu");
    expect(z.degerlendirici1.rol).toBe("TAKIM_LIDERI");
    expect(z.degerlendirici2?.personnelId).toBe("myrd");
    expect(z.degerlendirici2?.rol).toBe("MUDUR_YARDIMCISI");
    // Müdür yrd. puan verdiği için onay bölüm müdürüne gider (mavi yakayla aynı).
    expect(z.onaylayan?.personnelId).toBe("mudur");
    expect(z.baslangicDurumu).toBe("DEGERLENDIRICI1_BEKLIYOR");
  });

  it("beyaz + müdür yrd. YOK → adım ATLANIR, hata verilmez (sorumlu1 → müdür)", async () => {
    const kisi = beyaz("sorumlu");
    const deptYrdYok: Dept = { ...DEPT, mudurYardimcisiId: null };
    const z = await denemeZinciriCoz(db([...TEMEL, kisi], deptYrdYok), "kisi");
    expect(z.ok).toBe(true);
    if (!z.ok) return;
    expect(z.degerlendirici1.personnelId).toBe("sorumlu");
    expect(z.degerlendirici2?.personnelId).toBe("mudur");
    expect(z.degerlendirici2?.rol).toBe("MUDUR");
    // 2. puan müdürde bitiyor → ayrıca onay adımı yok.
    expect(z.onaylayan).toBeNull();
    expect(z.atlananlar.join(" ")).toContain("müdür yardımcısı tanımlı değil");
  });

  it("beyaz + sorumlu1 = müdür yrd. → aynı kişiye iki puan yazılmaz, 2. adım müdür", async () => {
    // Prod'da 19 beyaz yaka tam bu durumda (05.10 ölçümü).
    const kisi = beyaz("myrd");
    const z = await denemeZinciriCoz(db([...TEMEL, kisi], DEPT), "kisi");
    expect(z.ok).toBe(true);
    if (!z.ok) return;
    expect(z.degerlendirici1.personnelId).toBe("myrd");
    expect(z.degerlendirici2?.personnelId).toBe("mudur");
    expect(z.onaylayan).toBeNull();
  });

  it("beyaz + sorumlu1 = müdür → 2. adım YOK, GMY'ye bağlıysa onay (bugünkü davranış)", async () => {
    // Prod'da 24 beyaz yaka bu durumda; zincir yukarı yürür, müdürden müdür
    // yardımcısına GERİ DÖNMEZ.
    const kisi = beyaz("mudur");
    const z = await denemeZinciriCoz(
      db([...TEMEL, kisi, { id: "gmy", adSoyad: "GMY", gorev: "GENEL MÜDÜR YARDIMCISI", aktif: true }], DEPT, {
        gmyPersonnelId: "gmy",
        parentAdi: "Genel Müdür Yardımcısı",
      }),
      "kisi",
    );
    expect(z.ok).toBe(true);
    if (!z.ok) return;
    expect(z.degerlendirici1.personnelId).toBe("mudur");
    expect(z.degerlendirici2).toBeNull();
    expect(z.onaylayan?.personnelId).toBe("gmy");
    expect(z.atlananlar.join(" ")).toContain("zincir yukarı yürür");
  });

  it("beyaz + sorumlu1 YOK → bloke etmez, 1. değerlendirici müdür olur", async () => {
    const kisi = beyaz(null);
    const z = await denemeZinciriCoz(
      db([...TEMEL, kisi, { id: "gmy", adSoyad: "GMY", gorev: "GMY", aktif: true }], DEPT, {
        gmyPersonnelId: "gmy",
        parentAdi: "Genel Müdür Yardımcısı",
      }),
      "kisi",
    );
    expect(z.ok).toBe(true);
    if (!z.ok) return;
    expect(z.degerlendirici1.personnelId).toBe("mudur");
    expect(z.atlananlar.join(" ")).toContain("1. sorumlu atanmamış");
  });

  it("KALİTE MÜDÜRLÜĞÜ beyaz yaka → özel zincir AYNEN (müdür yrd. 1., müdür 2.)", async () => {
    const kisi = beyaz("sorumlu");
    const kalite: Dept = { ...DEPT, name: "Kalite Müdürlüğü", orgUnitCode: "ORG-TF-P0078" };
    const z = await denemeZinciriCoz(db([...TEMEL, kisi], kalite), "kisi");
    expect(z.ok).toBe(true);
    if (!z.ok) return;
    expect(z.degerlendirici1.personnelId).toBe("myrd");
    expect(z.degerlendirici1.rol).toBe("MUDUR_YARDIMCISI");
    expect(z.degerlendirici2?.personnelId).toBe("mudur");
    expect(z.onaylayan).toBeNull();
    expect(z.atlananlar.join(" ")).toContain("bölümüne özel zincir");
  });

  it("MAVİ yaka zinciri DEĞİŞMEDİ (sorumlu1 → müdür yrd. → onay müdür)", async () => {
    const kisi: Kisi = { ...beyaz("sorumlu"), yakaRengi: "MAVI" };
    const z = await denemeZinciriCoz(db([...TEMEL, kisi], DEPT), "kisi");
    expect(z.ok).toBe(true);
    if (!z.ok) return;
    expect(z.degerlendirici1.personnelId).toBe("sorumlu");
    expect(z.degerlendirici2?.personnelId).toBe("myrd");
    expect(z.onaylayan?.personnelId).toBe("mudur");
  });
});
