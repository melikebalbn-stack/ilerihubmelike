// IV-FR-27 · Deneme Süresi Değerlendirme — akış (zincir) çözücüsü.
//
// Kural GENEL: kişiye sabitlenmez, bölümün KENDİ müdüründen çözülür. Bölüm
// Personnel.departmentId FK'sinden okunur (metin `bolum` alanından DEĞİL).
//
//   MAVİ  → 1. Personnel.sorumlu1Id (takım lideri)
//           2. bölümün mudurYardimcisiId varsa MUDUR_YRD_BEKLIYOR, yoksa MUDUR_BEKLIYOR
//              (2. puanı müdür yrd. VEYA müdür verir, ikisi birden DEĞİL)
//   GRİ   → tek doldurucu: mudurYardimcisiId varsa o, yoksa mudurId · onay adımı YOK
//   BEYAZ → tek doldurucu: bölümün mudurId · GMY'ye bağlıysa ONAY_BEKLIYOR
//           (GMY puan VERMEZ), doğrudan GM'e bağlıysa onay yok → İK
//
// FAIL-CLOSED: zincir çözülemezse form AÇILMAZ, sebep döner
// (personnel-request-chain'in "yanlış kişiye düşmektense bloke" ilkesi).

import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { DenemeDurum, DenemeDegerlendiriciRol } from "@/generated/prisma";
import { degerlendiriciAtamasiGecerliMi } from "./deneme-degismezler";

type Db = PrismaClient | Prisma.TransactionClient;

/** Zincirdeki bir kişi. userId null olabilir — Personnel'in User hesabı yoksa. */
export type ZincirKisi = {
  personnelId: string;
  sicilNo: string | null;
  adSoyad: string;
  gorev: string;
  userId: string | null;
  rol: DenemeDegerlendiriciRol;
};

export type ZincirSonuc =
  | {
      ok: true;
      yakaRengi: string;
      departmentId: string;
      departmentAdi: string;
      /** 1. puanı veren. Her yakada VAR. */
      degerlendirici1: ZincirKisi;
      /** 2. puanı veren — YALNIZ mavi yakada. Gri/beyazda null. */
      degerlendirici2: ZincirKisi | null;
      /** Puan VERMEZ, yalnız onaylar. Mavi: bölüm müdürü · Beyaz: GMY. Yoksa null. */
      onaylayan: ZincirKisi | null;
      /** Form açıldığında girilecek durum. */
      baslangicDurumu: DenemeDurum;
      /** Atlanan adımlar (değerlendirici == değerlendirilen) — şeffaflık için. */
      atlananlar: string[];
    }
  /** Muaf: rol gereği form AÇILMAZ — hata DEĞİL (bkz. MUAF_POZISYON_KODLARI). */
  | { ok: false; muaf: true; sebep: string }
  | { ok: false; muaf?: false; sebep: string };

const GMY_ADI = "Genel Müdür Yardımcısı";

/**
 * Deneme değerlendirmesinden MUAF pozisyonlar (Melih kararı): Genel Müdür ve
 * Genel Müdür Yardımcısı. Muafiyet ROLE bağlı, kişiye DEĞİL — koltuk el
 * değiştirirse yeni kişi kendiliğinden muaf olur, liste güncellemek gerekmez.
 *
 * KOD ile eşlenir, AD ile değil: kutu adı değişse de (ör. "Genel Müdür (CEO)")
 * kod sabit kalır.
 */
export const MUAF_POZISYON_KODLARI = ["ORG-TF-GM", "ORG-TF-GMY"] as const;

/**
 * BÖLÜME ÖZEL ZİNCİR (Melih kararı 24.09.2026) — onay yapısı genel kuraldan
 * farklı olan bölümler. Bu bölümlerde YAKA FARK ETMEZ:
 *   1. değerlendirici = bölümün MÜDÜR YARDIMCISI
 *   2. değerlendirici = bölümün MÜDÜRÜ
 *   ayrı onay adımı YOK → müdür puanını verince İK kapanışına gider
 *
 * Genel kural (sorumlu1 → müdür yrd. → müdür) DİĞER bölümlerde AYNEN sürer.
 *
 * KOD ile eşlenir, AD ile DEĞİL: DepartmentDefinition.name değişebiliyor
 * (ör. "Yatırım ve Teşvik" → "Stratejik Sektörler", 23.09.2026), OrgUnit.code
 * sabit kalır. MUAF_POZISYON_KODLARI ile aynı gerekçe.
 * Kişi adı GÖMÜLMEZ — müdür/müdür yrd. koltuk değiştirince zincir kendiliğinden
 * yeni kişiye kurulur.
 *
 * ORG-TF-P0078 = Kalite Müdürlüğü (bugün: müdür yrd. Batuhan Çapar, müdür Sami Tekoğlu)
 */
export const OZEL_ZINCIR_ORG_KODLARI = ["ORG-TF-P0078"] as const;

/**
 * Kişi muaf bir pozisyon kutusunda mı oturuyor?
 * YALNIZ ANA KOLTUKLARA bakar — kişi birden fazla koltukta olabilir; kurul ve
 * komite koltukları (ORG-KR-*) muafiyet üretmez.
 */
async function muafPozisyondaMi(db: Db, personnelId: string): Promise<{ muaf: boolean; kutu?: string }> {
  const koltuk = await db.orgEmployee.findFirst({
    where: {
      personnelId,
      orgUnit: { code: { in: [...MUAF_POZISYON_KODLARI] }, isActive: true },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { orgUnit: { select: { code: true, name: true } } },
  });
  if (!koltuk?.orgUnit) return { muaf: false };
  return { muaf: true, kutu: koltuk.orgUnit.name };
}

type PersonelOzet = {
  id: string;
  sicilNo: string | null;
  adSoyad: string;
  gorev: string;
  aktif: boolean;
};

async function kisiCoz(
  db: Db,
  personnelId: string | null | undefined,
  rol: DenemeDegerlendiriciRol,
): Promise<ZincirKisi | null> {
  if (!personnelId) return null;
  const p = await db.personnel.findUnique({
    where: { id: personnelId },
    select: { id: true, sicilNo: true, adSoyad: true, gorev: true, aktif: true },
  });
  if (!p || !p.aktif) return null;
  // User hesabı olmayabilir (mavi yaka takım liderlerinin bir kısmı). Zincir yine
  // kurulur; bildirim/eylem tarafı userId null'ı ayrıca ele alır.
  const u = await db.user.findFirst({ where: { personnelId: p.id }, select: { id: true } });
  return {
    personnelId: p.id,
    sicilNo: p.sicilNo,
    adSoyad: p.adSoyad,
    gorev: p.gorev,
    userId: u?.id ?? null,
    rol,
  };
}

/**
 * Bölümün organizasyon şemasındaki üstü Genel Müdür Yardımcısı mı?
 * DepartmentDefinition.orgUnitId → OrgUnit.parentId → adı "Genel Müdür Yardımcısı".
 * orgUnitId NULL ise (bilinen açık: GENEL MÜDÜRLÜK) çözülemez → null döner.
 */
async function gmyeBagliMi(db: Db, orgUnitId: string | null): Promise<boolean | null> {
  if (!orgUnitId) return null;
  const birim = await db.orgUnit.findUnique({
    where: { id: orgUnitId },
    select: { parent: { select: { name: true } } },
  });
  if (!birim?.parent) return null;
  return birim.parent.name.trim() === GMY_ADI;
}

/**
 * Genel Müdür Yardımcısı'nın Personnel id'si.
 * DİKKAT: OrgUnit.managerId bu POSITION kutularında BOŞ — kişi OrgEmployee
 * koltuğunda duruyor. Önce koltuk, olmazsa managerId'ye düşülür.
 * Determinist sıra: en eski koltuk, eşitlikte id.
 */
async function gmyPersonelId(db: Db): Promise<string | null> {
  const birim = await db.orgUnit.findFirst({
    where: { name: GMY_ADI, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true, managerId: true },
  });
  if (!birim) return null;
  const koltuk = await db.orgEmployee.findFirst({
    where: { orgUnitId: birim.id, personnelId: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { personnelId: true },
  });
  return koltuk?.personnelId ?? birim.managerId ?? null;
}

export async function denemeZinciriCoz(db: Db, personnelId: string): Promise<ZincirSonuc> {
  const kisi = await db.personnel.findUnique({
    where: { id: personnelId },
    select: {
      id: true,
      adSoyad: true,
      aktif: true,
      yakaRengi: true,
      sorumlu1Id: true,
      departmentId: true,
      bolum: true,
      department: {
        select: {
          id: true,
          name: true,
          mudurId: true,
          mudurYardimcisiId: true,
          orgUnitId: true,
          // Bölüme özel zincir kontrolü için — ad DEĞİL kod üzerinden eşlenir.
          orgUnit: { select: { code: true } },
        },
      },
    },
  });

  if (!kisi) return { ok: false, sebep: "Personel kaydı bulunamadı." };
  if (!kisi.aktif) return { ok: false, sebep: "Personel pasif — deneme değerlendirmesi açılmaz." };

  // MUAFİYET en başta: bölüm/şema bağı aranmadan önce. GENEL MÜDÜRLÜK bölümünün
  // orgUnitId'si NULL olduğu için buradaki kişiler eskiden "şema bağı yok"
  // hatasına düşüyordu; artık muafiyet cevabı önce geliyor.
  const muafiyet = await muafPozisyondaMi(db, kisi.id);
  if (muafiyet.muaf) {
    return {
      ok: false,
      muaf: true,
      sebep: `${muafiyet.kutu} pozisyonu deneme süresi değerlendirmesine tabi değildir.`,
    };
  }

  // Bölüm METİNDEN değil FK'dan. FK boşsa bloke — yanlış bölüme düşmesin.
  if (!kisi.departmentId || !kisi.department) {
    return {
      ok: false,
      sebep: `Personelin bölüm bağı (departmentId) yok${kisi.bolum ? ` — metin alanı "${kisi.bolum}"` : ""}. İnsan Varlıkları ile iletişime geçin.`,
    };
  }
  const dept = kisi.department;

  const mudur = await kisiCoz(db, dept.mudurId, "MUDUR");
  const mudurYrd = await kisiCoz(db, dept.mudurYardimcisiId, "MUDUR_YARDIMCISI");

  if (!dept.mudurId) {
    return { ok: false, sebep: `"${dept.name}" bölümüne müdür atanmamış. İnsan Varlıkları ile iletişime geçin.` };
  }
  if (!mudur) {
    return { ok: false, sebep: `"${dept.name}" bölümünün müdürü pasif ya da kaydı bulunamıyor. İnsan Varlıkları ile iletişime geçin.` };
  }

  const yaka = (kisi.yakaRengi ?? "").toUpperCase();
  const atlananlar: string[] = [];
  const kendisi = (k: ZincirKisi | null) => !!k && k.personnelId === kisi.id;

  // ── BÖLÜME ÖZEL ZİNCİR (bkz. OZEL_ZINCIR_ORG_KODLARI) ──
  // Yalnız listedeki bölümlerde ve YALNIZ değerlendirilen kişi o bölümün müdürü
  // ya da müdür yardımcısı DEĞİLSE uygulanır. Kişi o koltuklardan birindeyse
  // genel kurala düşülür: orada zaten "değerlendirici kendisi → üst kademeye çık"
  // (beyaz yakada GMY'ye kadar) mantığı var, onu kısa devre etmeyiz.
  // Müdür yardımcısı koltuğu BOŞSA da genel kurala düşer — tek kişiye iki puan
  // yazdırmak yerine mevcut akış işler (fail-closed kontrolleri orada).
  const ozelBolum = !!dept.orgUnit?.code && (OZEL_ZINCIR_ORG_KODLARI as readonly string[]).includes(dept.orgUnit.code);
  if (ozelBolum && mudurYrd && !kendisi(mudurYrd) && !kendisi(mudur)) {
    // Aynı kişi hem müdür hem müdür yrd. koltuğunda oturuyorsa iki puanı tek
    // kişi verirdi — genel kurala düşülür (orada atlama/üst kademe mantığı var).
    const ozelDegismez = degerlendiriciAtamasiGecerliMi({
      personnelId: kisi.id,
      degerlendirici1Id: mudurYrd.personnelId,
      degerlendirici2Id: mudur.personnelId,
    });
    if (!ozelDegismez.ok) return { ok: false, sebep: ozelDegismez.sebep };
    return {
      ok: true,
      yakaRengi: yaka,
      departmentId: dept.id,
      departmentAdi: dept.name,
      degerlendirici1: mudurYrd, // rol: MUDUR_YARDIMCISI
      degerlendirici2: mudur, // rol: MUDUR → puanını verince onay YOK, İK'ya gider
      onaylayan: null,
      baslangicDurumu: "DEGERLENDIRICI1_BEKLIYOR",
      atlananlar: [
        `"${dept.name}" bölümüne özel zincir: 1. puan müdür yardımcısı, 2. puan müdür (sorumlu1/takım lideri adımı yok)`,
      ],
    };
  }

  // ── MAVİ YAKA: iki puan ──
  if (yaka === "MAVI") {
    let deg1 = await kisiCoz(db, kisi.sorumlu1Id, "TAKIM_LIDERI");
    if (!kisi.sorumlu1Id) {
      return { ok: false, sebep: "Personelin 1. sorumlusu (takım lideri) atanmamış. İnsan Varlıkları ile iletişime geçin." };
    }
    if (!deg1) {
      return { ok: false, sebep: "Personelin 1. sorumlusu pasif ya da kaydı bulunamıyor. İnsan Varlıkları ile iletişime geçin." };
    }

    // Değerlendirici == değerlendirilen → adım ATLANIR, bir üst kademeye çıkılır.
    if (kendisi(deg1)) {
      atlananlar.push("1. değerlendirici kendisi olduğu için atlandı (takım lideri → müdür yardımcısı/müdür)");
      const ustKademe = mudurYrd && !kendisi(mudurYrd) ? mudurYrd : !kendisi(mudur) ? mudur : null;
      if (!ustKademe) {
        return { ok: false, sebep: "Personel kendi sorumlusu ve bölümün üst kademesi de kendisi — çıkılacak kademe yok." };
      }
      deg1 = ustKademe;
    }

    // 2. puan: müdür yardımcısı varsa o, yoksa müdür. İkisi birden DEĞİL.
    let deg2 = mudurYrd ?? mudur;
    let durum: DenemeDurum = mudurYrd ? "MUDUR_YRD_BEKLIYOR" : "MUDUR_BEKLIYOR";

    if (kendisi(deg2)) {
      atlananlar.push("2. değerlendirici kendisi olduğu için atlandı (müdür yardımcısı → müdür)");
      if (kendisi(mudur)) {
        return { ok: false, sebep: "Bölümün müdürü ve müdür yardımcısı kişinin kendisi — 2. değerlendirici bulunamıyor." };
      }
      deg2 = mudur;
      durum = "MUDUR_BEKLIYOR";
    }
    // Değişmezler TEK KAYNAKTAN (deneme-degismezler.ts) — aynı kapı İV
    // yönlendirme ucunda da işler, atama sonradan değişse de kural atlanmaz.
    const degismez = degerlendiriciAtamasiGecerliMi({
      personnelId: kisi.id,
      degerlendirici1Id: deg1.personnelId,
      degerlendirici2Id: deg2.personnelId,
    });
    if (!degismez.ok) return { ok: false, sebep: degismez.sebep };

    // Onay: müdür yrd. doldurursa bölüm müdürü onaylar; müdür doldurursa onay YOK.
    const onaylayan = deg2.rol === "MUDUR_YARDIMCISI" ? mudur : null;

    return {
      ok: true,
      yakaRengi: yaka,
      departmentId: dept.id,
      departmentAdi: dept.name,
      degerlendirici1: deg1,
      degerlendirici2: deg2,
      onaylayan: onaylayan && onaylayan.personnelId !== kisi.id ? onaylayan : null,
      baslangicDurumu: "DEGERLENDIRICI1_BEKLIYOR",
      atlananlar,
    };
  }

  // ── GRİ YAKA: tek puan, onay YOK ──
  if (yaka === "GRI") {
    let deg1 = mudurYrd ?? mudur;
    if (kendisi(deg1)) {
      atlananlar.push("Değerlendirici kendisi olduğu için atlandı (müdür yardımcısı → müdür)");
      if (kendisi(mudur)) {
        return { ok: false, sebep: "Bölümün müdürü ve müdür yardımcısı kişinin kendisi — değerlendirici bulunamıyor." };
      }
      deg1 = mudur;
    }
    return {
      ok: true,
      yakaRengi: yaka,
      departmentId: dept.id,
      departmentAdi: dept.name,
      degerlendirici1: deg1,
      degerlendirici2: null,
      onaylayan: null,
      baslangicDurumu: "DEGERLENDIRICI1_BEKLIYOR",
      atlananlar,
    };
  }

  // ── BEYAZ YAKA: tek puan, GMY'ye bağlıysa onay ──
  if (yaka === "BEYAZ") {
    let deg1: ZincirKisi = mudur;
    if (kendisi(deg1)) {
      // Kişinin kendisi bölüm müdürü → bir üst kademe: GMY.
      atlananlar.push("Değerlendirici kendisi (bölüm müdürü) olduğu için atlandı — üst kademeye çıkıldı");
      const gmy = await kisiCoz(db, await gmyPersonelId(db), "MUDUR");
      if (!gmy || kendisi(gmy)) {
        return { ok: false, sebep: "Kişi bölümün müdürü ve üst kademe (Genel Müdür Yardımcısı) çözülemiyor — değerlendirici bulunamıyor." };
      }
      return {
        ok: true,
        yakaRengi: yaka,
        departmentId: dept.id,
        departmentAdi: dept.name,
        degerlendirici1: gmy,
        degerlendirici2: null,
        onaylayan: null, // üst kademe zaten doldurdu, ayrıca onay aranmaz
        baslangicDurumu: "DEGERLENDIRICI1_BEKLIYOR",
        atlananlar,
      };
    }

    const gmyBagli = await gmyeBagliMi(db, dept.orgUnitId);
    if (gmyBagli === null) {
      return {
        ok: false,
        sebep: `"${dept.name}" bölümünün organizasyon şemasındaki yeri çözülemiyor (şema bağı yok) — onay kademesi belirlenemedi. İnsan Varlıkları ile iletişime geçin.`,
      };
    }

    let onaylayan: ZincirKisi | null = null;
    if (gmyBagli) {
      onaylayan = await kisiCoz(db, await gmyPersonelId(db), "MUDUR");
      if (!onaylayan) {
        return { ok: false, sebep: "Genel Müdür Yardımcısı kaydı çözülemiyor — onay kademesi kurulamadı. İnsan Varlıkları ile iletişime geçin." };
      }
      if (onaylayan.personnelId === kisi.id) onaylayan = null; // kendisi GMY ise onay aranmaz
    }

    return {
      ok: true,
      yakaRengi: yaka,
      departmentId: dept.id,
      departmentAdi: dept.name,
      degerlendirici1: deg1,
      degerlendirici2: null,
      onaylayan,
      baslangicDurumu: "DEGERLENDIRICI1_BEKLIYOR",
      atlananlar,
    };
  }

  return { ok: false, sebep: `Tanımsız yaka rengi ("${kisi.yakaRengi ?? "boş"}") — zincir kurulamıyor.` };
}

/**
 * 1. değerlendirici formu gönderdikten sonraki durum. Zincirden türetilir;
 * geçiş matrisi bu hedefin izinli olduğunu ayrıca doğrular.
 */
export function birinciAdimSonrasiDurum(z: Extract<ZincirSonuc, { ok: true }>): DenemeDurum {
  // Yaka rengine DEĞİL, zincirin kendisine bakılır: bölüme özel zincirlerde
  // beyaz/gri yakada da 2. değerlendirici atanır (puanla ucuyla aynı kural).
  if (z.degerlendirici2) {
    return z.degerlendirici2.rol === "MUDUR_YARDIMCISI" ? "MUDUR_YRD_BEKLIYOR" : "MUDUR_BEKLIYOR";
  }
  // Tek puan: onaylayan varsa onaya, yoksa doğrudan İK'ya.
  return z.onaylayan ? "ONAY_BEKLIYOR" : "IK_BEKLIYOR";
}
