// GET /api/strategic-hr/is-analizi/menu-bayrak
// Sidebar için İş Analizi rol bayrakları — SUNUCUDA hesaplanır (iaRolCozumle).
// İstemci yalnız boolean okur; amir (DB) ve ik (recruitment.admin|hr.admin OR)
// mantığı burada, tek kaynakta çözülür. Oturum yoksa iaRolCozumle 401 döner →
// Sidebar fetch !ok görür, bayraklar false kalır (menü öğeleri gizli).

import { NextResponse } from "next/server";
import { iaRolCozumle } from "@/lib/is-analizi/ia-yetki";

export async function GET() {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;
  return NextResponse.json({ amir: rol.amir, ik: rol.ik });
}
