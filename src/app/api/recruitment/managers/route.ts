import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

export const dynamic = "force-dynamic";

// Müdür atama dropdown'u için aday User listesi.
//
// YAPISAL NOT: DepartmentDefinition.mudurId / mudurYardimcisiId → PERSONNEL.id'dir
// (User değil). Ama PublicJobApplication.assignedManagerId → USER.id ister. Bu yüzden
// zincir: mudurId (Personnel.id) → User (User.personnelId = Personnel.id) → User.id.
// Personnel↔User bağı olmayan müdür (User hesabı yok) listeye giremez — atanamaz zaten.
//
// İki grup döner:
//   onerilenler: departman müdürü/yardımcısı olan aktif User'lar (öneri)
//   tumAktif:    tüm aktif User'lar (İK gerekirse başka birini de seçebilsin)

type ManagerOption = {
  id: string;
  name: string;
  departmentName: string | null;
  isDeputy: boolean;
  /**
   * FAZ 4 — teknik mülakat 2. kademe ÖNİZLEMESİ. Bu kişi mülakatçı seçilirse üst amiri
   * kim olur? `atlanir: true` ise üst amir kendisi çıkıyor demektir → 2. kademe atlanır,
   * karar İV'ye döner. UI bunu SEÇİM ANINDA uyarı olarak gösterir (geçiş anında değil).
   * Sunucuda TEK sorgu kümesiyle hesaplanır (N+1 yok) — zincir mantığı
   * teknik-mulakat-zinciri.ts ile AYNI kuraldır; burada yalnız önizleme yapılır.
   */
  ustAmir: { atlanir: boolean; ad: string | null; yol: "MUDUR_YRD" | "MUDUR" | null };
};

function userName(u: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string {
  const composed = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return composed || u.name || u.email || "(isimsiz)";
}

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  // İK yetkisi şart.
  const perms = session.user.permissions ?? [];
  if (!perms.includes("recruitment.admin") && !perms.includes("hr.admin")) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  }

  // 1) Aktif departmanların müdür/yardımcı Personnel.id'leri + departman adı.
  const depts = await prisma.departmentDefinition.findMany({
    where: { isActive: true },
    select: { name: true, mudurId: true, mudurYardimcisiId: true },
  });

  // Personnel.id → { departman adı, isDeputy } (öneri meta'sı)
  const personnelMeta = new Map<string, { departmentName: string; isDeputy: boolean }>();
  for (const d of depts) {
    if (d.mudurId && !personnelMeta.has(d.mudurId)) {
      personnelMeta.set(d.mudurId, { departmentName: d.name, isDeputy: false });
    }
    if (d.mudurYardimcisiId && !personnelMeta.has(d.mudurYardimcisiId)) {
      personnelMeta.set(d.mudurYardimcisiId, { departmentName: d.name, isDeputy: true });
    }
  }

  // 2) Bu Personnel'lere bağlı aktif User'lar (öneri grubu).
  const onerilenler: ManagerOption[] = [];
  const oneriUserIds = new Set<string>();
  // userId → { personnelId, bolum } — üst amir önizlemesi için (iki grup da doldurur).
  const bolumByUserId = new Map<string, { personnelId: string | null; bolum: string | null }>();
  const matchedPersonnelIds = new Set<string>();
  if (personnelMeta.size > 0) {
    const users = await prisma.user.findMany({
      // Faz 4: aynı süzme öneri grubunda da geçerli — pasif personel kaydına bağlı bir
      // müdür seçilirse üst amir zinciri kurulamaz (bkz. aşağıdaki tumAktif yorumu).
      where: {
        isActive: true,
        personnelId: { in: [...personnelMeta.keys()] },
        personnel: { is: { aktif: true } },
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        personnelId: true,
        personnel: { select: { bolum: true } },
      },
    });
    for (const u of users) {
      const meta = u.personnelId ? personnelMeta.get(u.personnelId) : undefined;
      onerilenler.push({
        id: u.id,
        name: userName(u),
        departmentName: meta?.departmentName ?? null,
        isDeputy: meta?.isDeputy ?? false,
        // ustAmir aşağıda TEK yerde doldurulur (önizleme verisi henüz yüklenmedi).
        ustAmir: { atlanir: true, ad: null, yol: null },
      });
      bolumByUserId.set(u.id, { personnelId: u.personnelId, bolum: u.personnel?.bolum ?? null });
      oneriUserIds.add(u.id);
      if (u.personnelId) matchedPersonnelIds.add(u.personnelId);
    }
    onerilenler.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  // 2b) User karşılığı OLMAYAN müdürler — sessizce düşmesin, İK eksik nedeni görsün.
  // (Şu an DB'de 0; veri değişirse — müdür Personnel'inin User hesabı yoksa — burada görünür.)
  const unmatchedPersonnelIds = [...personnelMeta.keys()].filter((pid) => !matchedPersonnelIds.has(pid));
  // TESHIS: omurgada mudur/yrd. olup aktif User'a cozulemeyenler sessizce listeden
  // dusuyordu; IK "mudur listede yok" dediginde logda hicbir iz olmuyordu.
  // KVKK: ad YAZILMAZ — personnelId + bolum adi yeterli.
  if (unmatchedPersonnelIds.length > 0) {
    console.warn("[managers] User'a cozulemeyen mudur koltugu:", {
      adet: unmatchedPersonnelIds.length,
      kayitlar: unmatchedPersonnelIds.map((pid) => ({
        personnelId: pid,
        bolum: personnelMeta.get(pid)?.departmentName ?? null,
        isDeputy: personnelMeta.get(pid)?.isDeputy ?? false,
      })),
    });
  }
  let unmatchedManagers: { personnelId: string; adSoyad: string | null; departmentName: string | null; isDeputy: boolean }[] = [];
  if (unmatchedPersonnelIds.length > 0) {
    const personeller = await prisma.personnel.findMany({
      where: { id: { in: unmatchedPersonnelIds } },
      select: { id: true, adSoyad: true },
    });
    const adByPid = new Map(personeller.map((p) => [p.id, p.adSoyad]));
    unmatchedManagers = unmatchedPersonnelIds.map((pid) => {
      const meta = personnelMeta.get(pid);
      return {
        personnelId: pid,
        adSoyad: adByPid.get(pid) ?? null,
        departmentName: meta?.departmentName ?? null,
        isDeputy: meta?.isDeputy ?? false,
      };
    });
  }

  // 3) Tüm aktif User'lar (ikinci grup — öneride olanlar hariç, dropdown'da tekrar olmasın).
  //
  // FAZ 4 SÜZMESİ (zorunlu): yalnız personel kaydı OLAN ve o kaydı AKTİF olan kullanıcılar.
  // Gerekçe: teknik mülakat 2. kademesinde üst amir zinciri
  //   User → personnelId → Personnel.bolum → DepartmentDefinition → md.yrd/müdür
  // yolundan çözülüyor. personnelId'si olmayan (keşif: 8 aktif User — 1 kiosk, 2 istasyon,
  // 5 çalışan hesabı) veya pasif Personnel'e bağlı (17 User) biri seçilirse zincir
  // KURULAMAZ ve hata ancak GEÇİŞ ANINDA çıkar — geç ve kafa karıştırıcı.
  // Süzmeyi burada yaparak seçilemez hâle getiriyoruz.
  const allUsers = await prisma.user.findMany({
    where: { isActive: true, personnel: { is: { aktif: true } } },
    select: {
      id: true, name: true, firstName: true, lastName: true, email: true,
      // Faz 4 önizlemesi için: kişinin bölümü + personnelId (üst amir karşılaştırması).
      personnelId: true,
      personnel: { select: { bolum: true } },
    },
    orderBy: { name: "asc" },
  });

  // ── FAZ 4 — üst amir ÖNİZLEMESİ (N+1 YOK) ──────────────────────────────────
  // Aktif departmanlar + koltuk sahiplerinin adları TEK sorguda; sonra JS'te eşleme.
  // Kural teknik-mulakat-zinciri.ts ile AYNI: md.yrd varsa o, yoksa müdür; kendisiyse
  // müdüre çık; o da kendisiyse ATLANIR.
  const aktifDeptler = await prisma.departmentDefinition.findMany({
    where: { isActive: true },
    select: { name: true, mudurId: true, mudurYardimcisiId: true },
  });
  const deptByName = new Map(aktifDeptler.map((d) => [d.name, d]));
  const koltukPidler = [
    ...new Set(aktifDeptler.flatMap((d) => [d.mudurId, d.mudurYardimcisiId]).filter((x): x is string => !!x)),
  ];
  const koltukPersonel = koltukPidler.length
    ? await prisma.personnel.findMany({
        where: { id: { in: koltukPidler } },
        select: { id: true, adSoyad: true },
      })
    : [];
  const adByPersonnelId = new Map(koltukPersonel.map((p) => [p.id, p.adSoyad]));

  // TESHIS: asagidaki her "atlanir" dalinin AYRI sebebi var ama disariya ayni sonuc
  // ciktigi icin hangisinin tetiklendigi bilinemiyordu. KVKK: ad YAZILMAZ.
  let atlananSayaci = 0;
  const atlaLog = (sebep: string, personnelId: string | null, bolum: string | null | undefined) => {
    atlananSayaci++;
    console.warn("[managers] ust amir onizlemesi atlandi:", {
      personnelId: personnelId ?? "(yok)",
      bolum: bolum ?? "(yok)",
      reason: sebep,
    });
  };

  function ustAmirOnizle(personnelId: string | null, bolum: string | null | undefined): ManagerOption["ustAmir"] {
    if (!personnelId || !bolum) {
      atlaLog(!personnelId ? "personnelId yok (User personele bagli degil)" : "Personnel.bolum bos", personnelId, bolum);
      return { atlanir: true, ad: null, yol: null };
    }
    const d = deptByName.get(bolum.trim());
    if (!d) {
      atlaLog("bolum adi aktif DepartmentDefinition'da bulunamadi", personnelId, bolum);
      return { atlanir: true, ad: null, yol: null };
    }
    const birinci = d.mudurYardimcisiId ?? d.mudurId;
    if (!birinci) {
      atlaLog("bolumun mudur ve mudur yardimcisi koltugu BOS", personnelId, bolum);
      return { atlanir: true, ad: null, yol: null };
    }
    if (birinci !== personnelId) {
      const ad = adByPersonnelId.get(birinci) ?? null;
      if (!ad) {
        // Koltuk dolu ama Personnel adi cozulemedi → UI'da adsiz secenek cikar.
        console.warn("[managers] ust amir adi cozulemedi (adsiz donuluyor):", {
          personnelId,
          bolum,
          ustAmirPersonnelId: birinci,
          reason: "koltuk sahibi Personnel kaydi okunamadi",
        });
      }
      return {
        atlanir: false,
        ad,
        yol: d.mudurYardimcisiId ? "MUDUR_YRD" : "MUDUR",
      };
    }
    // 1. adım kendisi → müdüre çık
    if (!d.mudurId || d.mudurId === personnelId) {
      atlaLog(
        !d.mudurId ? "1. adim kendisi ve bolumde mudur koltugu bos" : "1. adim da mudur de kendisi — zincir kapali",
        personnelId,
        bolum,
      );
      return { atlanir: true, ad: null, yol: null };
    }
    const ad = adByPersonnelId.get(d.mudurId) ?? null;
    if (!ad) {
      console.warn("[managers] ust amir adi cozulemedi (adsiz donuluyor):", {
        personnelId,
        bolum,
        ustAmirPersonnelId: d.mudurId,
        reason: "mudur koltugu Personnel kaydi okunamadi",
      });
    }
    return { atlanir: false, ad, yol: "MUDUR" };
  }
  const tumAktif: ManagerOption[] = allUsers
    .filter((u) => !oneriUserIds.has(u.id))
    .map((u) => ({
      id: u.id,
      name: userName(u),
      departmentName: null,
      isDeputy: false,
      ustAmir: ustAmirOnizle(u.personnelId, u.personnel?.bolum),
    }));

  // Öneri grubunun ustAmir alanı burada doldurulur (önizleme verisi artık hazır).
  for (const o of onerilenler) {
    const b = bolumByUserId.get(o.id);
    o.ustAmir = ustAmirOnizle(b?.personnelId ?? null, b?.bolum);
  }

  // Ozet: bir bakista "kac koltuk vardi, kaci listeye girdi, kaci elendi".
  console.warn(
    `[managers] omurgada ${personnelMeta.size} mudur, ${matchedPersonnelIds.size} cozuldu, ` +
      `${unmatchedPersonnelIds.length} elendi (ust amir onizlemesi atlanan: ${atlananSayaci})`,
  );

  return NextResponse.json({ onerilenler, tumAktif, unmatchedManagers });
}
