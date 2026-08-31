// Kalıcı yönlendirme: IFS modülü /ifs altına taşındı.
// ?dept=<packageId> KORUNUR — kayıtlı/paylaşılmış deep-link'ler kırılmasın.
import { redirect } from "next/navigation";

export default async function AkademiIfsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const dept = typeof sp.dept === "string" ? sp.dept : undefined;
  redirect(dept ? `/ifs/gorevlerim?dept=${encodeURIComponent(dept)}` : "/ifs/gorevlerim");
}
