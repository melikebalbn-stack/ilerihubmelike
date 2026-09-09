import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/has-permission";
import { IfsEgitimDokumanlari } from "./_client";

// IFS EĞİTİMLER — kursiyer tarafı eğitim dokümanı kataloğu.
//
// Bu rota ÖNCE yönetici takip ekranıydı; o ekran /ifs/degerlendirme'ye taşındı
// ("Eğitimler" adı yönetici tablosunu anlatmıyordu). /ifs/egitimler artık adının
// söylediği şeyi yapıyor: departmanın eğitim dokümanlarını listeler.
//
// Yetki ifs.view — Ödevler ile AYNI kitle (izin "Kullanıcı" rolünde, yani
// pratikte herkes). Eğitim dokümanı bilerek geniş açık.
export default async function IfsEgitimlerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const yetkili = await hasPermission("ifs.view");
  if (!yetkili) redirect("/?error=unauthorized");

  return <IfsEgitimDokumanlari />;
}
