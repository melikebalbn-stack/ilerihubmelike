/**
 * İşe alım — DEPARTMAN KAPSAMI KAPISI. TEK KAYNAK.
 *
 * SORUN (bu modülün kapattığı): liste uçları kapsamı `department: { contains: userDepartment }`
 * ile kuruyordu. `session.user.department` boşsa `contains: ""` HER SATIRLA eşleşir → kapsam
 * sessizce kalkar ve `recruitment.view` olan kullanıcı ŞİRKET GENELİ veriyi görür. Aynısı
 * `if (!isAdmin && canViewByDept && userDepartment)` kalıbında da var: departman boşken dal
 * hiç çalışmaz ve `where` DARALTILMADAN sorguya gider. İkisi de FAIL-OPEN.
 *
 * Detay uçları bunu ZATEN doğru yapıyordu:
 *   · canSeeOpening   → `ctx.userDepartment.length > 0` şartı
 *   · canSeeCandidate → `if (!ctx.userDepartment) return false`
 * Yani liste ile detay AYNI kaydı farklı değerlendiriyordu. Bu modül ikisini eşitler:
 * departman yoksa liste de ERİŞİM YOK der (boş sonuç değil — 403).
 *
 * FAIL-CLOSED tercihi bilinçli: boş departman bir yapılandırma eksiği (LDAP alanı gelmemiş)
 * ve bu durumda "her şeyi göster" yanlış varsayılan. Kullanıcı 403 görüp İK'ya başvurur;
 * sessizce tüm aday havuzunu indirmez.
 */
import { NextResponse } from "next/server";

export type DepartmanKapsami = {
  isAdmin: boolean;
  canViewByDept: boolean;
  userDepartment: string;
};

/**
 * Departman tabanlı daraltmanın GÜVENLE uygulanabileceği durum:
 * admin değil + view izni var + departman DOLU.
 * Admin için false döner (admin daraltılmaz, `isAdmin` ile ayrıca kontrol edilir).
 */
export function departmanDaraltmasiUygulanir(ctx: DepartmanKapsami): boolean {
  return !ctx.isAdmin && ctx.canViewByDept && ctx.userDepartment.trim().length > 0;
}

/**
 * Liste uçları için kapı: erişim var mı?
 *   · admin                      → evet
 *   · view + departman DOLU      → evet (çağıran `where`'i daraltmakla YÜKÜMLÜ)
 *   · view + departman BOŞ       → HAYIR (fail-closed)
 *   · view yok                   → HAYIR
 */
export function departmanKapsamiVarMi(ctx: DepartmanKapsami): boolean {
  return ctx.isAdmin || departmanDaraltmasiUygulanir(ctx);
}

/** Departman tanımsız olduğu için reddedilen istek — sebebi açık 403. */
export function departmanTanimsizYaniti() {
  return NextResponse.json(
    {
      error:
        "Departman bilginiz tanımlı olmadığı için bu listeye erişemiyorsunuz. " +
        "İnsan Varlıkları ile iletişime geçin.",
    },
    { status: 403 },
  );
}
