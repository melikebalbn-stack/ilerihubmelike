import { Suspense } from "react";
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
//
// Suspense ŞART: istemci bileşeni Sv1→Sv2 seçimini ?dept= ile URL'e yansıtmak
// için useSearchParams kullanıyor; sınır olmadan Next bu sayfayı ön-render
// edemez (build hatası).
export default async function IfsEgitimlerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const yetkili = await hasPermission("ifs.view");
  if (!yetkili) redirect("/?error=unauthorized");

  return (
    <Suspense fallback={null}>
      <IfsEgitimDokumanlari />
    </Suspense>
  );
}
