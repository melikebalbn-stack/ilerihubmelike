import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

function recruitAccess(session: { user: { permissions?: string[] } }) {
  const perms = session.user.permissions ?? [];
  return { isAdmin: perms.includes("recruitment.admin"), canView: perms.includes("recruitment.view") };
}

// GET — pozisyon tanımları (mevcut Position tablosu, IFS senkron). İK yönetir (kolonlar).
// Yeni tablo AÇILMAZ — mevcut Position kullanılır.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;
  const { isAdmin, canView } = recruitAccess(session);
  if (!isAdmin && !canView) return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  const positions = await prisma.position.findMany({
    orderBy: [{ isActive: "desc" }, { department: "asc" }, { title: "asc" }],
    select: {
      id: true, code: true, title: true, department: true,
      yaka: true, ingilizceZorunlu: true, hedefTimeToHire: true, isActive: true,
      _count: { select: { requiredCompetencies: true } },
    },
  });
  return NextResponse.json(positions);
}
