// Aynı adayın TEKRAR başvurusu — tespit mantığı. TEK KAYNAK.
//
// KARAR (Melih): aday tekrar başvurabilir, ENGELLENMEZ. Amaç yalnız GÖRÜNÜRLÜK —
// İV, elindeki başvurunun aynı TC ile daha önce/sonra da gelmiş olduğunu görsün.
// Zaman sınırı YOK: kayıt ne kadar eski olursa olsun sayılır.
//
// ── NEDEN PublicJobApplication.tcKimlikNo (JobApplicationConsent.tcKimlikNo DEĞİL) ──
// Consent tablosunda TC NOT NULL ve @@index'li, başvuruda ise `String?` ve indekssiz —
// ilk bakışta consent üzerinden sorgulamak cazip. Ama prod ölçümü (2026-08-16):
// 15 başvurunun 2'sinde consent.tcKimlikNo ile application.tcKimlikNo FARKLI ve
// consent.adSoyad ile application.fullName de farklı. Sebep bilinen bir akış hatası:
// paylaşımlı tablette KVKK onayını bir aday veriyor, formu SONRAKİ aday dolduruyor
// (taslak çerezinin devralınması — api/job-application/route.ts'teki "İzzet→Yaşar" notu).
// Consent üzerinden eşleştirseydik bu iki başvuru YANLIŞ kişiye bağlanırdı.
// İV'nin değerlendirdiği kimlik formun kendi alanıdır → tek doğru kaynak o.
//
// İNDEKS NOTU: `PublicJobApplication.tcKimlikNo` üzerinde index YOK ve bu faz
// şema değişikliği içermiyor. Bugünkü hacimde (prod 15 satır) sorun değil; başvuru
// sayısı binlere çıkarsa `@@index([tcKimlikNo])` eklenmeli (ayrı, additive migration).

import type { JobApplicationStatus, Prisma, PrismaClient } from "@/generated/prisma";
import { TASLAK_STATULER } from "./taslak-statuler";

type DbLike = PrismaClient | Prisma.TransactionClient;

/** Liste rozeti için satır başına özet. `toplam > 1` değilse rozet HİÇ çizilmez. */
export type MukerrerRozet = {
  /** Aynı TC'ye ait TASLAK OLMAYAN başvuru sayısı (bu kayıt dahil). */
  toplam: number;
  /** Bu kaydın kronolojik sırası (1 = en eski). */
  sira: number;
  /** Gruptaki EN YENİ başvurunun tarihi ve statüsü — "Son başvuru: … — …" bilgisi. */
  sonBasvuruTarihi: Date;
  sonBasvuruStatus: JobApplicationStatus;
};

/** Detay ekranındaki "Önceki başvurular" satırı. */
export type DigerBasvuru = {
  id: string;
  applicationNumber: string;
  status: JobApplicationStatus;
  createdAt: Date;
  /** Reddedildiyse kök-neden sözlüğündeki adı (varsa). */
  rejectionReason: string | null;
  /** Bu kayıt, bakılan başvurudan ÖNCE mi geldi? (false = sonraki başvuru) */
  onceki: boolean;
};

/**
 * Sayfadaki başvurular için mükerrer rozetleri — TEK sorgu (N+1 YOK).
 * Faz 3'teki sınav rozeti deseniyle aynı: sayfadaki anahtarlar toplanır, tek findMany
 * ile ilgili tüm satırlar çekilir, eşleme JS'te yapılır.
 *
 * Taslak statüler (CONSENT_PENDING/HEALTH_PENDING) HARİÇ — yarım kalmış kayıt
 * "başvuru" sayılmaz. Küme TEK KAYNAK: taslak-statuler.ts
 */
export async function mukerrerRozetleri(
  db: DbLike,
  sayfa: { id: string; tcKimlikNo: string | null }[],
): Promise<Map<string, MukerrerRozet>> {
  const sonuc = new Map<string, MukerrerRozet>();
  const tcler = [...new Set(sayfa.map((a) => a.tcKimlikNo).filter((t): t is string => !!t))];
  if (tcler.length === 0) return sonuc;

  const kardesler = await db.publicJobApplication.findMany({
    where: { tcKimlikNo: { in: tcler }, status: { notIn: TASLAK_STATULER } },
    orderBy: { createdAt: "asc" },
    select: { id: true, tcKimlikNo: true, status: true, createdAt: true },
  });

  // TC → kronolojik satır listesi
  const gruplar = new Map<string, typeof kardesler>();
  for (const k of kardesler) {
    if (!k.tcKimlikNo) continue;
    const g = gruplar.get(k.tcKimlikNo);
    if (g) g.push(k);
    else gruplar.set(k.tcKimlikNo, [k]);
  }

  for (const a of sayfa) {
    if (!a.tcKimlikNo) continue;
    const grup = gruplar.get(a.tcKimlikNo);
    if (!grup || grup.length < 2) continue; // tek başvuru → rozet YOK
    const sira = grup.findIndex((k) => k.id === a.id) + 1;
    if (sira === 0) continue; // kaydın kendisi taslak → gruba girmez, rozet çizilmez
    const sonuncu = grup[grup.length - 1];
    sonuc.set(a.id, {
      toplam: grup.length,
      sira,
      sonBasvuruTarihi: sonuncu.createdAt,
      sonBasvuruStatus: sonuncu.status,
    });
  }
  return sonuc;
}

/**
 * "Tekrar başvuranlar" filtresi için: aynı TC'de BİRDEN FAZLA taslak-olmayan
 * başvurusu bulunan TC listesi. Filtre `where` içine `tcKimlikNo in/notIn` olarak
 * girdiği için findMany ve count AYNI `where`'i paylaşır → sayfalama toplamı tutarlı.
 */
export async function mukerrerTcListesi(db: DbLike): Promise<string[]> {
  const gruplar = await db.publicJobApplication.groupBy({
    by: ["tcKimlikNo"],
    where: { tcKimlikNo: { not: null }, status: { notIn: TASLAK_STATULER } },
    _count: { _all: true },
    having: { tcKimlikNo: { _count: { gt: 1 } } },
  });
  return gruplar.map((g) => g.tcKimlikNo).filter((t): t is string => !!t);
}

/**
 * Detay ekranı: bu adayın DİĞER başvuruları (bu kayıt hariç, taslaklar hariç).
 * Kronolojik; `onceki` alanı bakılan kayda göre önce/sonra ayrımını verir.
 * YALNIZ İK yolundan çağrılır — atanan müdür adayın geçmişini görmez.
 */
export async function digerBasvurular(
  db: DbLike,
  basvuru: { id: string; tcKimlikNo: string | null; createdAt: Date },
): Promise<DigerBasvuru[]> {
  if (!basvuru.tcKimlikNo) return [];
  const satirlar = await db.publicJobApplication.findMany({
    where: {
      tcKimlikNo: basvuru.tcKimlikNo,
      id: { not: basvuru.id },
      status: { notIn: TASLAK_STATULER },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      createdAt: true,
      rejectionReason: { select: { name: true } },
    },
  });
  return satirlar.map((s) => ({
    id: s.id,
    applicationNumber: s.applicationNumber,
    status: s.status,
    createdAt: s.createdAt,
    rejectionReason: s.rejectionReason?.name ?? null,
    onceki: s.createdAt < basvuru.createdAt,
  }));
}
