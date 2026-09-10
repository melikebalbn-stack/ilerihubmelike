import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/has-permission";
import { IfsSinavlar } from "./_client";

// IFS SINAVLAR — sunucu kapısı.
//
// Sayfa baştan sona "use client" idi, sunucu guard'ı yoktu: yetki yalnız menüde
// ve uçlardaydı. Desen /ifs/egitimler, /ifs/odevler ve /ifs/degerlendirme ile
// aynı — kapı page.tsx'te, istemci kısmı _client.tsx'te.
//
// Yetki ifs.admin — menüdeki girdiyle birebir. Ekranın kullandığı iki uç
// (admin/courses?type=ifs, admin/exams?courseId=) akademi.kurs.edit istiyor,
// yani ekranı kapatmak tek savunma değil.
//
// Suspense GEREKMİYOR: istemci bileşeni useSearchParams kullanmıyor.
export default async function IfsSinavlarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const yetkili = await hasPermission("ifs.admin");
  if (!yetkili) redirect("/?error=unauthorized");

  return <IfsSinavlar />;
}
