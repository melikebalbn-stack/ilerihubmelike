import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/has-permission";
import { EgitimDegerlendirme } from "./_client";

// IFS EĞİTİM DEĞERLENDİRME — yönetici takip ekranının SUNUCU kapısı.
//
// Sayfa 2026-09'a kadar baştan sona "use client" idi: yetki yalnız menüde ve
// uçlarda kontrol ediliyordu. Yetkisiz biri URL'i bilirse boş kabuk görüyordu
// — veri uçları ifs.admin istediği için dolmuyordu, yani sızıntı değildi ama
// menüde görünen bir yönetici ekranının guard'sız kalması doğru değil.
//
// Desen /ifs/egitimler ve degerlendirme/[packageId] ile aynı: kapı burada,
// istemci kısmı _client.tsx'te.
//
// Yetki ifs.admin — alt sayfa [packageId] ile AYNI. ifs.keyuser tek başına
// AÇMAZ; key user değerlendirme girer, ekranın tamamına erişmez. Uçlar da
// (ifs-egitim-yapisi, ifs-paket-kisiler, ifs-kisi-gorevler) aynı izni istiyor,
// yani ekranı kapatmak tek savunma değil.
//
// Suspense GEREKMİYOR: istemci bileşeni useSearchParams kullanmıyor (yalnız
// useRouter), bu yüzden ön-render sınırı şart değil.
export default async function IfsDegerlendirmePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const yetkili = await hasPermission("ifs.admin");
  if (!yetkili) redirect("/?error=unauthorized");

  return <EgitimDegerlendirme />;
}
