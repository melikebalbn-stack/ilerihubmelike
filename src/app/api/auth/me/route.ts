import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"

// GET - Mevcut kullanıcı bilgilerini döndür
export async function GET() {
  // PR-Y2.5: requireUser helper — id-based lookup, email casing bağımlılığı yok
  const { user, error } = await requireUser()
  if (error) return error

  // Frontend kontratını birebir koru — eski select'tekiyle aynı subset
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    jobTitle: user.jobTitle,
    isActive: user.isActive,
  })
}
