import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/has-permission";
import { IfsOdevlerKatalog } from "./_client";

// IFS ÖDEVLER — kursiyer kataloğunun sunucu kapısı.
//
// Sayfa "use client" olduğu için kapı YOKTU: yetki yalnız menüdeydi, üstelik
// besleyen uçlar (ifs/departments, ifs/areas) da sadece oturum arıyordu — yani
// giriş yapan herkes IFS katalogunu okuyabiliyordu. 09.09.2026'da ikisi de
// ifs.view'a bağlandı; bu sayfa o kapının ekran tarafı.
//
// Ölçüm: ifs.view "Kullanıcı" rolünde (176 aktif kullanıcının 169'unda).
// Taşımayan 7 hesabın hepsi terminal/kiosk — rolsüz üç personele rol atandı.
export default async function IfsOdevlerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const yetkili = await hasPermission("ifs.view");
  if (!yetkili) redirect("/?error=unauthorized");

  return <IfsOdevlerKatalog />;
}
