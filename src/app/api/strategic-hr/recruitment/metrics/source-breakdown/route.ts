import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { TASLAK } from "@/lib/recruitment/taslak-statuler";

// Recruitment modülünün mevcut yetki deseni (recruitAccess) — yeni izin icat edilmez.
function recruitAccess(session: {
  user: { permissions?: string[]; department?: string | null; email?: string | null };
}) {
  const perms = session.user.permissions ?? [];
  return {
    isAdmin: perms.includes("recruitment.admin"),
    canViewByDept: perms.includes("recruitment.view"),
  };
}

// Boş/null referralSource için grup anahtarı (İK veri eksikliğini görsün diye gizlenmez).
const BELIRTILMEMIS = "Belirtilmemiş";

// GET — Kaynak Kırılımı: GERÇEK başvuru akışı = PublicJobApplication.referralSourceId
// → ReferralSourceDef.name (İK'nın Tanımlar'dan yönettiği sözlük). Her kaynak için:
// başvuru sayısı · işe alınan (status=ACCEPTED) · dönüşüm %.
// JobApplication/Candidate OKUNMAZ (ölü tablo, 3 test kaydı). Sandbox tabloları okunmaz.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const { isAdmin } = recruitAccess(session);
  // YALNIZ ADMIN (recruitment.view YETMEZ). Gerekçe: bu uç şirket geneli YÖNETİM
  // metriği döndürür ve kapsam daraltması TEKNİK OLARAK MÜMKÜN DEĞİL — başvuruda
  // departman ekseni yok (PublicJobApplication'da departman alanı ve JobOpening bağı
  // yok, JobOpening tablosu boş, requestedPosition serbest metin). UI'da Analiz/Tanımlar
  // sekmesi zaten `recruitment.admin`'e gizli; bu değişiklik kapı ile API'yi eşitler.
  if (!isAdmin) {
    return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  }

  // KAYNAK SÖZLÜKTEN OKUNUR (referralSourceId → ReferralSourceDef.name).
  // ESKİDEN `referralSource` (enum) okunuyordu; yazma tarafı o kolona ARTIK YAZMIYOR
  // (bkz. api/job-application/route.ts — form kaynak ADINI gönderir, ada göre FK çözülür),
  // dolayısıyla bu uç her başvuruyu "Belirtilmemiş" sayıyordu. metrics/dashboard zaten
  // FK'den okuyordu; iki metrik ucu artık AYNI kaynağı kullanıyor.
  const basvurular = await prisma.publicJobApplication.findMany({
    select: {
      referralSourceDef: { select: { name: true } },
      status: true,
    },
  });

  // TASLAKLAR HARİÇ — metrics/dashboard ile AYNI evren (dashboard/route.ts:54 deseni,
  // küme TEK KAYNAK: lib/recruitment/taslak-statuler.ts). Taslak = aday KVKK/sağlık
  // adımında kalmış, başvuru formunu GÖNDERMEMİŞ kayıt.
  // NEDEN: iki uç aynı panoda yan yana görünüyor; farklı evren sayarlarsa aynı ekranda
  // İKİ FARKLI TOPLAM çıkar (staging ölçümü: source-breakdown 34, dashboard 32).
  const tamam = basvurular.filter((b) => !TASLAK.has(b.status)); // form tamamlanan

  // Kaynak-başına başvuru + işe alınan (ACCEPTED). null → "Belirtilmemiş".
  const acc = new Map<string, { basvuru: number; iseAlinan: number }>();
  for (const b of tamam) {
    const kaynak = b.referralSourceDef?.name ?? BELIRTILMEMIS;
    let a = acc.get(kaynak);
    if (!a) { a = { basvuru: 0, iseAlinan: 0 }; acc.set(kaynak, a); }
    a.basvuru++;
    if (b.status === "ACCEPTED") a.iseAlinan++;
  }

  const kaynaklar = [...acc.entries()]
    .map(([source, a]) => ({
      source,
      basvuru: a.basvuru,
      iseAlinan: a.iseAlinan,
      // dönüşüm oranı (%) — 0'a bölme yok (basvuru>0 garanti).
      donusumOrani: Math.round((a.iseAlinan / a.basvuru) * 1000) / 10,
    }))
    // "Belirtilmemiş" en sona; gerisi başvuru sayısına göre azalan.
    .sort((x, y) => {
      if (x.source === BELIRTILMEMIS) return 1;
      if (y.source === BELIRTILMEMIS) return -1;
      return y.basvuru - x.basvuru;
    });

  return NextResponse.json({ kaynaklar });
}
