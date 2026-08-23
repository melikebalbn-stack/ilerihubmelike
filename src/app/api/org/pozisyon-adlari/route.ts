import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pozisyonSecenekleriYukle } from "@/lib/org/pozisyon-secenekleri";

// Personel formundaki "Görev" seçeneklerinin kaynağı. Oturum yeterli — içerik
// yalnız şemadaki pozisyon ADLARI (kişi verisi yok).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  try {
    const pozisyonlar = await pozisyonSecenekleriYukle();
    return NextResponse.json({ pozisyonlar, toplam: pozisyonlar.length });
  } catch (error) {
    console.error("pozisyon-adlari:", error);
    return NextResponse.json({ error: "Pozisyon listesi alınamadı" }, { status: 500 });
  }
}
