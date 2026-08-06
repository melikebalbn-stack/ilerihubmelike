// GET /api/kadro-talep/menu-bayrak
// Sidebar için kadro talep menü bayrağı — SUNUCUDA hesaplanır (kadroTalepYetkisi).
// İstemci yalnız boolean okur; müdür/müdür-yrd (DB) + İK (recruitment.admin|hr.admin)
// mantığı tek kaynakta (kadro-talep-yetki.ts) çözülür. Oturum yoksa requireSession
// 401 döner → Sidebar fetch !ok görür, bayrak false kalır (menü öğesi gizli).

import { NextResponse } from "next/server";
import { kadroTalepYetkisi } from "@/lib/kadro-talep/kadro-talep-yetki";

export async function GET() {
  const { yetki, error } = await kadroTalepYetkisi();
  if (error) return error;
  return NextResponse.json({ talepAcabilir: yetki.talepAcabilir });
}
