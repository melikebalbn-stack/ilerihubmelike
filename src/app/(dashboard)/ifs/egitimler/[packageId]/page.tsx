// Kalıcı yönlendirme: departman YÖNETİM ekranı /ifs/degerlendirme/[packageId]
// altına taşındı. Kök /ifs/egitimler yönlendirme DEĞİL — orası artık kursiyer
// tarafı eğitim dokümanı kataloğu; yalnız bu alt yol eski hedefe gider.
import { redirect } from "next/navigation";

export default async function IfsEgitimlerPaketRedirect({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = await params;
  redirect(`/ifs/degerlendirme/${packageId}`);
}
