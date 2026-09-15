import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canIfsRaporView } from "@/lib/ifs/rapor-erisim";
import { IfsRaporlar } from "./_client";

// IFS RAPORLAR — sunucu kapısı.
//
// Sayfa baştan sona "use client" idi, sunucu guard'ı yoktu: yetki yalnız menüde
// ve uçlardaydı. Desen /ifs/egitimler, /ifs/odevler ve /ifs/degerlendirme ile
// aynı — kapı page.tsx'te, istemci kısmı _client.tsx'te.
//
// Yetki DİNAMİK (canIfsRaporView): ifs.rapor.view izni VEYA görevi "MÜDÜR"
// içeren VEYA bölümü "Sistem Geliştirme Müdürlüğü" olan personel. Menüdeki
// girdiyle birebir (aynı fonksiyon, sunucu bayrağıyla).
//
// Suspense GEREKMİYOR: istemci bileşeni useSearchParams kullanmıyor.
export default async function IfsRaporlarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // DİNAMİK kural: ifs.rapor.view izni VEYA görev "MÜDÜR" VEYA bölüm Sistem Geliştirme.
  const yetkili = await canIfsRaporView(session.user.id);
  if (!yetkili) redirect("/?error=unauthorized");

  return <IfsRaporlar />;
}
