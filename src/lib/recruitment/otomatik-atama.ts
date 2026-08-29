// Mavi yaka zinciri — OTOMATİK ATAMA. TEK KAYNAK.
//
// Zincirin iki kademesinde atamayı İK yapmaz, sistem yapar:
//   DEGERLENDIRICI  → URETIM_MUDUR_YRD : Fabrika Müdürlüğü'nün müdür YARDIMCISI
//   URETIM_MUDUR_YRD/REVIEWING → FABRIKA_MUDURU : Fabrika Müdürlüğü'nün MÜDÜRÜ
//
// KİŞİ ADI GÖMÜLMEZ: kim olduğu DepartmentDefinition.mudurId / mudurYardimcisiId'den
// çözülür (Samet Taşlı / Bedri Güler değişirse kod değişmez).
//
// DEPARTMAN ADI DA GÖMÜLMEZ: DepartmentDefinition'da `code` kolonu YOKTUR (yalnız `name`
// UNIQUE). Bu yüzden departmanı koda gömmek yerine ORTAM DEĞİŞKENİ ile eşliyoruz —
// RECRUITMENT_URETIM_DEPARTMAN. Değer departmanın id'si VEYA tam adı olabilir (ikisi de
// tekil); ops hangisini verirse verilsin çözülür. Böylece:
//   - kaynak kodda ne kişi ne departman adı sabitlenir,
//   - staging/prod farklı kayıt kullanabilir,
//   - departman yeniden adlandırılırsa yalnız env güncellenir.
//
// SESSİZ BAŞARISIZLIK YOK: env yoksa / departman bulunamazsa / ilgili müdürün aktif User
// hesabı yoksa OtomatikAtamaError fırlatılır → route 400 + anlaşılır mesaj döner.
// (Rol çözümlemesi ise ASLA fırlatmaz — bkz. uretimDepartmaniCozOrNull.)

import type { JobApplicationStatus, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { kullaniciAdi } from "@/lib/recruitment/bekleyen";

/** Departmanı işaret eden ortam değişkeni (değer: DepartmentDefinition id VEYA tam name). */
export const URETIM_DEPARTMAN_ENV = "RECRUITMENT_URETIM_DEPARTMAN";

export class OtomatikAtamaError extends Error {
  readonly httpStatus: number;
  constructor(message: string, httpStatus = 400) {
    super(message);
    this.name = "OtomatikAtamaError";
    this.httpStatus = httpStatus;
  }
}

/** Otomatik atamada hangi koltuğun kullanılacağı. */
type Koltuk = "MUDUR" | "MUDUR_YRD";

// Hedef statü → hangi koltuğa atanacak. Bu tablo zincirin TEK atama otoritesidir.
const OTOMATIK_ATAMA: Partial<Record<JobApplicationStatus, Koltuk>> = {
  URETIM_MUDUR_YRD: "MUDUR_YRD",
  FABRIKA_MUDURU: "MUDUR",
};

// FAZ 4 — atamayı sistem yapar AMA koltuk bu departman tablosundan ÇÖZÜLMEZ:
// teknik mülakat 2. kademesinde üst amir, seçilen MÜLAKATÇININ bölümünden bulunur
// (teknik-mulakat-zinciri.ts). Bu yüzden OTOMATIK_ATAMA'ya EKLENMEZ — eklenirse
// otomatikAtananKullanici yanlış yerden (üretim departmanı env'i) çözmeye çalışırdı.
const ZINCIRDEN_ATANAN: JobApplicationStatus[] = ["TEKNIK_MULAKAT_UST_ONAY"];

/**
 * Bu hedefe geçişte atamayı sistem mi yapıyor (İK kişi SEÇMEYECEK)?
 * İki kaynak: departman koltuğu tablosu + zincirden çözülen kademeler.
 * requiresAssignedManager ile ASLA kesişmez — biri "İK seçer", diğeri "sistem atar".
 */
export function otomatikAtamaliMi(to: JobApplicationStatus): boolean {
  return to in OTOMATIK_ATAMA || ZINCIRDEN_ATANAN.includes(to);
}

export type UretimKoltugu = {
  /** Atanacak aktif User id'si (yoksa null — sebebi `eksik` alanında). */
  userId: string | null;
  /** Görünen ad (UI'da "kime gidecek" bilgisi + StageLog notu için). */
  ad: string | null;
};

export type UretimDepartmani = {
  departmanId: string;
  departmanAdi: string;
  MUDUR: UretimKoltugu;
  MUDUR_YRD: UretimKoltugu;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Üretim (Fabrika) departmanını + iki koltuğun aktif User karşılığını çözer.
 * Yapılandırma eksikse/kayıt yoksa NULL döner — FIRLATMAZ.
 * Rol çözümlemesi bunu kullanır: env unutulsa bile mevcut akışlar (MUDUR vb.) etkilenmez.
 */
export async function uretimDepartmaniCozOrNull(db: DbClient = prisma): Promise<UretimDepartmani | null> {
  const anahtar = process.env[URETIM_DEPARTMAN_ENV]?.trim();
  if (!anahtar) return null;

  // Değer id ya da ad olabilir; ikisi de tekil olduğu için OR güvenli.
  // AD eşleşmesi büyük/küçük harf DUYARSIZ: departman şema üslubuna göre yeniden
  // adlandırıldığında ("FABRİKA MÜDÜRLÜĞÜ" → "Fabrika Müdürlüğü") env değeri
  // kırılmasın. Tam ad şart — kapsama/parçalı eşleşme YOK.
  const dept = await db.departmentDefinition.findFirst({
    where: { OR: [{ id: anahtar }, { name: { equals: anahtar, mode: "insensitive" } }] },
    select: { id: true, name: true, mudurId: true, mudurYardimcisiId: true },
  });
  if (!dept) return null;

  // İki koltuğun Personnel id'leri → aktif User'ları TEK sorguda.
  const personelIds = [dept.mudurId, dept.mudurYardimcisiId].filter((x): x is string => !!x);
  const users = personelIds.length
    ? await db.user.findMany({
        where: { isActive: true, personnelId: { in: personelIds } },
        select: { id: true, personnelId: true, name: true, firstName: true, lastName: true, email: true },
      })
    : [];

  const koltuk = (personelId: string | null): UretimKoltugu => {
    if (!personelId) return { userId: null, ad: null };
    const u = users.find((x) => x.personnelId === personelId);
    return { userId: u?.id ?? null, ad: kullaniciAdi(u) };
  };

  return {
    departmanId: dept.id,
    departmanAdi: dept.name,
    MUDUR: koltuk(dept.mudurId),
    MUDUR_YRD: koltuk(dept.mudurYardimcisiId),
  };
}

/** Koltuğun insan-okur adı — hata mesajlarında kullanılır (departman adı env'den gelir, gömülü değil). */
function koltukEtiketi(koltuk: Koltuk): string {
  return koltuk === "MUDUR" ? "müdürü" : "müdür yardımcısı";
}

/**
 * Hedef statü için otomatik atanacak User id'si.
 * - Hedef otomatik atamalı DEĞİLSE null döner (çağıran normal akışa devam eder).
 * - Otomatik atamalı AMA çözülemiyorsa OtomatikAtamaError fırlatır (400) — sessiz geçiş YOK.
 */
export async function otomatikAtananKullanici(
  to: JobApplicationStatus,
  db: DbClient = prisma,
): Promise<{ userId: string; ad: string | null } | null> {
  const koltuk = OTOMATIK_ATAMA[to];
  if (!koltuk) return null;

  const dep = await uretimDepartmaniCozOrNull(db);
  if (!dep) {
    throw new OtomatikAtamaError(
      `Bu aşamaya otomatik atama yapılamadı: üretim departmanı tanımlı değil. ` +
        `Sunucu ayarlarında ${URETIM_DEPARTMAN_ENV} değeri (departman adı veya id) tanımlanmalı.`,
    );
  }

  const hedef = dep[koltuk];
  if (!hedef.userId) {
    throw new OtomatikAtamaError(
      `Bu aşamaya otomatik atama yapılamadı: "${dep.departmanAdi}" departmanının ` +
        `${koltukEtiketi(koltuk)} tanımlı değil veya aktif kullanıcı hesabı yok. ` +
        `Departman tanımından ilgili kişiyi atayın.`,
    );
  }
  return { userId: hedef.userId, ad: hedef.ad };
}

/**
 * UI önizlemesi: hedefe geçildiğinde başvuru KİME gidecek.
 * Hata FIRLATMAZ — okuma yolunda (stage-log ucu) kullanılır; çözülemezse null döner
 * ve UI "otomatik atanacak" bilgisini gösteremez, ama sayfa çalışmaya devam eder.
 * Gerçek engelleme geçiş anında otomatikAtananKullanici ile yapılır (400).
 */
export async function otomatikAtamaOnizleme(
  hedefler: JobApplicationStatus[],
  db: DbClient = prisma,
): Promise<Record<string, { ad: string | null; hazir: boolean }>> {
  // Yalnız DEPARTMAN koltuğundan çözülenler önizlenebilir. Zincirden atananlarda
  // (TEKNIK_MULAKAT_UST_ONAY) kime gideceği mülakatçı seçilmeden BİLİNMEZ — önizleme
  // üretilmez, aksi halde UI yanlışlıkla "atanacak kişi yok" uyarısı gösterirdi.
  const otomatikler = hedefler.filter((t) => t in OTOMATIK_ATAMA);
  if (otomatikler.length === 0) return {};

  const dep = await uretimDepartmaniCozOrNull(db);
  const sonuc: Record<string, { ad: string | null; hazir: boolean }> = {};
  for (const to of otomatikler) {
    const koltuk = OTOMATIK_ATAMA[to]!;
    const hedef = dep?.[koltuk];
    sonuc[to] = { ad: hedef?.ad ?? null, hazir: !!hedef?.userId };
  }
  return sonuc;
}
