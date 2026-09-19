import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";

// Kadro (personel) talep açma yetkisi — TEK KAYNAK.
// Kim talep açabilir:
//   - Bir departmanın MÜDÜRÜ (DepartmentDefinition.mudurId = kullanıcının personnelId'si)
//   - Bir departmanın MÜDÜR YARDIMCISI (DepartmentDefinition.mudurYardimcisiId = personnelId)
//   - İK (recruitment.admin VEYA hr.admin) — İK adına talep girebilir
//   - kadro.talep.ac izni (19.09.2026, forma ÖZEL rol "Kadro Talep Açıcı") — koltuğu/İK
//     yetkisi olmayan kişi (ör. Muharrem Aygül) yalnız bu formu açar, kendi taleplerini görür
// Bunların dışındaki herkes: talepAcabilir = false.
//
// ERİŞİM (19.09.2026 — kadro-talep erişim daraltma): forma girebilenler =
//   recruitment.admin ∨ recruitment.view ∨ koltuk ∨ kadro.talep.ac. Bunların dışındaki
//   herkes için TÜM uçlar 403 — "kendi açtığını görme" istisnası KALKTI (yetkisiz kişinin
//   kaydı olamaz; olsa da görmez). Onaycı istisnası yalnız PDF/onay adımında (uç içinde).
//
// Personnel → User eşlemesi: user.personnelId ile DepartmentDefinition'da mudur/mudurYrd araması
// (resolveApprovers ve ia-yetki ile aynı desen). LDAP department/rol string'i KULLANILMAZ.

export type KadroTalepRol = "MUDUR" | "MUDUR_YRD" | null;

export interface KadroTalepYetki {
  userId: string;
  personnelId: string | null;
  talepAcabilir: boolean;
  rol: KadroTalepRol; // departman rolü (İK-only ise null olabilir ama talepAcabilir true)
  ik: boolean;
  acici: boolean; // kadro.talep.ac — forma özel izin
}

/** Forma erişim kararı — tüm kadro-talep uçlarının ÖN KAPISI (tek kaynak). */
export interface KadroTalepErisim extends KadroTalepYetki {
  hasFullAccess: boolean; // recruitment.admin → tüm talepler
  canViewByDept: boolean; // recruitment.view → kendi departmanı + kendi açtıkları
  erisebilir: boolean; // admin ∨ view ∨ koltuk ∨ acici
}

type Sonuc =
  | { yetki: KadroTalepYetki; error: null }
  | { yetki: null; error: NextResponse };

// Yetki çekirdeği — session'dan BAĞIMSIZ (userId + perms verilir). Hem API hem
// server-component (page) buradan besleniyor; DepartmentDefinition mudur/mudurYrd
// lookup + İK kontrolü TEK yerde. NextResponse döndürmez → page'de güvenle çağrılır.
export async function kadroTalepYetkisiCore(
  userId: string,
  perms: string[]
): Promise<KadroTalepYetki> {
  const ik = perms.includes("recruitment.admin") || perms.includes("hr.admin");

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnelId: true },
  });
  const personnelId = u?.personnelId ?? null;

  // Departman rolü: personnelId müdür mü / müdür yardımcısı mı?
  let rol: KadroTalepRol = null;
  if (personnelId) {
    const dept = await prisma.departmentDefinition.findFirst({
      where: {
        OR: [{ mudurId: personnelId }, { mudurYardimcisiId: personnelId }],
      },
      select: { mudurId: true, mudurYardimcisiId: true },
    });
    if (dept?.mudurId === personnelId) rol = "MUDUR";
    else if (dept?.mudurYardimcisiId === personnelId) rol = "MUDUR_YRD";
  }

  const acici = perms.includes("kadro.talep.ac");
  const talepAcabilir = ik || rol !== null || acici;
  return { userId, personnelId, talepAcabilir, rol, ik, acici };
}

/**
 * Forma erişebilir mi? (liste/detay/PDF/export/oluşturma/düzenleme/silme ön kapısı)
 * Yetkisiz → 403; sahiplik burada SAYILMAZ (yetkisiz kişinin kaydı olamaz).
 */
export async function kadroTalepErisimiCore(userId: string, perms: string[]): Promise<KadroTalepErisim> {
  const yetki = await kadroTalepYetkisiCore(userId, perms);
  const hasFullAccess = perms.includes("recruitment.admin");
  const canViewByDept = perms.includes("recruitment.view");
  return { ...yetki, hasFullAccess, canViewByDept, erisebilir: hasFullAccess || canViewByDept || yetki.talepAcabilir };
}

type ErisimSonuc =
  | { erisim: KadroTalepErisim; session: NonNullable<Awaited<ReturnType<typeof requireSession>>["session"]>; error: null }
  | { erisim: null; session: null; error: NextResponse };

/** Oturum + erişim; erişemiyorsa 403 hazır döner (uç: `if (error) return error`). */
export async function kadroTalepErisimi(): Promise<ErisimSonuc> {
  const { session, error } = await requireSession();
  if (error) return { erisim: null, session: null, error };
  const erisim = await kadroTalepErisimiCore(session.user.id, session.user.permissions ?? []);
  if (!erisim.erisebilir) return { erisim: null, session: null, error: kadroTalepErisimYok() };
  return { erisim, session, error: null };
}

// Erişim yok (403) — oturum var ama form kapsamı dışında.
export function kadroTalepErisimYok() {
  return NextResponse.json({ error: "Personel talep formuna erişim yetkiniz yok." }, { status: 403 });
}

// Page-safe boolean kısayolu (server component'te getServerSession sonrası çağrılır).
export async function talepAcabilirMi(
  userId: string,
  perms: string[]
): Promise<boolean> {
  const { talepAcabilir } = await kadroTalepYetkisiCore(userId, perms);
  return talepAcabilir;
}

export async function kadroTalepYetkisi(): Promise<Sonuc> {
  const { session, error } = await requireSession();
  if (error) return { yetki: null, error };

  const yetki = await kadroTalepYetkisiCore(
    session.user.id,
    session.user.permissions ?? []
  );

  return { yetki, error: null };
}

// Yetkisiz (403) — oturum var ama talep açma yetkisi yok.
export function kadroTalepYetkisiz() {
  return NextResponse.json(
    { error: "Personel kadro talebi açma yetkiniz yok." },
    { status: 403 }
  );
}
