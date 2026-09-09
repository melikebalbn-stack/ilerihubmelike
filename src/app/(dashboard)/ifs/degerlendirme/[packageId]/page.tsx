import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/has-permission";
import { PaketYonetim } from "./_client";

// IFS DEPARTMAN YÖNETİMİ — /ifs/degerlendirme'deki kalem ikonunun hedefi.
//
// Yetki kapısı BİLEREK dar: yalnız akademi.kurs.edit. ifs.keyuser tek başına
// bu sayfayı AÇMAZ — key user değerlendirme girer, yapıyı (alan/görev/atama)
// değiştirmez. Aynı kural uçlarda da geçerli (contents, packages/* hepsi
// akademi.kurs.edit istiyor), yani ekranı gizlemek tek savunma değil.
export default async function IfsPaketYonetimPage({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Yalnız ifs.admin — eski akademi.kurs.edit kaldırıldı. ifs.keyuser BİLEREK
  // YOK: key user değerlendirme girer, yapıyı değiştirmez.
  const yetkili = await hasPermission("ifs.admin");
  // Hedef /ifs/degerlendirme DEGIL: kok sayfa da artik ayni ifs.admin kapisini
  // tasiyor, oraya atmak yetkisiz kullaniciyi ikinci bir sicramaya sokardi.
  // /ifs altindaki tum yetkisiz yonlendirmeler tek hedefe gider.
  if (!yetkili) redirect("/?error=unauthorized");

  const { packageId } = await params;
  return <PaketYonetim packageId={packageId} />;
}
