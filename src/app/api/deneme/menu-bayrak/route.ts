// GET /api/deneme/menu-bayrak
// Sidebar için IV-FR-27 menü bayrağı — SUNUCUDA hesaplanır (is-analizi deseni).
// İstemci yalnız boolean okur.
//
// GÖRÜNÜRLÜK: YALNIZ İV (hr.admin | recruitment.admin). Liste ekranı puanları,
// ortalamayı ve başarılı/başarısız sonucunu gösteriyor — bu İV'nin ekranı.
// Zincirdeki müdürler menüyü GÖRMEZ; onlar maildeki /deneme/<id> bağlantısıyla
// doğrudan kendi formlarını açar, liste hiç görmezler.
// Oturum yoksa 401 → Sidebar fetch !ok görür, bayrak false kalır (menü gizli).

import { NextResponse } from "next/server";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { ikMi } from "@/lib/deneme/deneme-yetki";

export const dynamic = "force-dynamic";

export async function GET() {
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  // Zincir sayımı KALKTI — liste yalnız İV'nin.
  return NextResponse.json({ gorunur: ikMi(aktor) });
}
