import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { materializePackage } from "@/lib/akademi-package-materialize";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const { id } = await params;

  const result = await materializePackage(
    id,
    session?.user?.email ?? undefined
  );

  return NextResponse.json({
    success: true,
    materialize: result,
  });
}
