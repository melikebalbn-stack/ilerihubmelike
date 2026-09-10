import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/has-permission";
import { IfsRaporlar } from "./_client";

// IFS RAPORLAR — sunucu kapısı.
//
// Sayfa baştan sona "use client" idi, sunucu guard'ı yoktu: yetki yalnız menüde
// ve uçlardaydı. Desen /ifs/egitimler, /ifs/odevler ve /ifs/degerlendirme ile
// aynı — kapı page.tsx'te, istemci kısmı _client.tsx'te.
//
// Yetki ifs.rapor.view — menüdeki girdiyle birebir. ifs.admin BİLEREK yok:
// rapor izni ayrı bir anahtar ve 8 kişiye atanmış durumda; ifs.admin şartı
// koymak o kitleyi kapı dışında bırakırdı.
//
// Suspense GEREKMİYOR: istemci bileşeni useSearchParams kullanmıyor.
export default async function IfsRaporlarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const yetkili = await hasPermission("ifs.rapor.view");
  if (!yetkili) redirect("/?error=unauthorized");

  return <IfsRaporlar />;
}
