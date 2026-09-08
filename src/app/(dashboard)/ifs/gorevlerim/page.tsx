// Kalıcı yönlendirme: IFS kursiyer kataloğu /ifs/odevler altına taşındı.
// Rota adı menü etiketiyle ters düşüyordu ("gorevlerim" URL'i, "Eğitimler" adı);
// ikisi de "Ödevler"e hizalandı. Kayıtlı/paylaşılmış linkler kırılmasın diye
// bu sayfa duruyor — ?dept= parametresi KORUNUR.
import { redirect } from "next/navigation";

export default async function IfsGorevlerimRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const dept = typeof sp.dept === "string" ? sp.dept : undefined;
  redirect(dept ? `/ifs/odevler?dept=${encodeURIComponent(dept)}` : "/ifs/odevler");
}
