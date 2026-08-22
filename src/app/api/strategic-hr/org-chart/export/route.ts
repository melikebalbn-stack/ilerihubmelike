import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";
import { buildOrgSheetModel } from "@/lib/org-export/build-sheet-model";
import { renderSheetModelToXlsx } from "@/lib/org-export/render-xlsx";

// org-chart/route.ts'teki checkAccess private (export edilmemiş) olduğu için
// import edilemiyor — employees/route.ts'te yapıldığı gibi aynı rol listesiyle
// yerel bir kopya tutuyoruz.
function checkAccess(session: any) {
  const userRole = session?.user?.role;
  const userDepartment = session?.user?.department || "";

  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
  const isHrDepartment = hrDepartments.some((dept) => userDepartment.toLowerCase().includes(dept));

  return {
    hasFullAccess: fullAccessRoles.includes(userRole) || isHrDepartment,
  };
}

// GET - Org şeması Excel export'u (yalnız hasFullAccess — tam blok, alan gizleme değil)
export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? new NextResponse("Unauthorized", { status: 401 });

  const { hasFullAccess } = checkAccess(session);
  if (!hasFullAccess) return new NextResponse("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code") ?? "ORG-TF";
  if (!/^ORG-[A-Z0-9-]+$/.test(code)) {
    return new NextResponse("Geçersiz bölüm kodu", { status: 400 });
  }

  // Audit — üretimden ÖNCE. PII loglanmaz, yalnız kapsam/hedef özeti.
  await logAuditEvent({
    action: "ORG_CHART_EXPORT",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: code,
    details: { scope: "org-chart-export", format: "xlsx" },
  });

  let models;
  try {
    models = await buildOrgSheetModel(code);
  } catch {
    return new NextResponse("Bölüm bulunamadı", { status: 404 });
  }

  const buffer = await renderSheetModelToXlsx(models);

  const today = new Date().toISOString().slice(0, 10);
  const anaSheetName = models[0].sheetName;

  // ASCII fallback (eski tarayıcı) — Türkçe harfleri ASCII'ye indir. \p{L} Türkçe
  // harfleri (İ=U+0130=304 vb.) SİLMEZ (geçerli Unicode harf sayılır), bu yüzden
  // header'a çıplak Unicode sızıp ByteString dönüşümünde 500 atıyordu (pm2 log ile doğrulandı).
  const asciiName = anaSheetName
    .replace(/İ/g, "I").replace(/ı/g, "i").replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g").replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ö/g, "O").replace(/ö/g, "o").replace(/Ç/g, "C").replace(/ç/g, "c")
    .replace(/[^A-Za-z0-9]+/g, "_");
  const asciiFile = `ORG_${asciiName}_${today}.xlsx`;
  // RFC 5987 UTF-8 (modern tarayıcı) — Türkçe ad korunur
  const utf8File = encodeURIComponent(`ORG_${anaSheetName}_${today}.xlsx`);

  // Buffer<ArrayBufferLike> generic tipi Next'in BodyInit union'ıyla yapısal olarak
  // eşleşmiyor (bu @types/node sürümünde) — aynı byte'lar, düz Uint8Array'e çeviriyoruz.
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFile}"; filename*=UTF-8''${utf8File}`,
    },
  });
}
