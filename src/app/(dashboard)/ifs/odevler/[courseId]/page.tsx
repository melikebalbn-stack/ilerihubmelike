import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/has-permission";
import { IfsOdevAlanDetay } from "./_client";

// IFS ÖDEVLER — alan detayının sunucu kapısı. Kök katalogla AYNI anahtar
// (ifs.view): biri açılıp diğeri açılmasın diye ikisi birlikte kapatıldı.
// courseId'yi istemci useParams ile okuyor, kabuğun devretmesi gerekmiyor.
export default async function IfsOdevAlanDetayPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const yetkili = await hasPermission("ifs.view");
  if (!yetkili) redirect("/?error=unauthorized");

  return <IfsOdevAlanDetay />;
}
