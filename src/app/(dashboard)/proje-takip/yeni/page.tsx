import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getMuhendislikEkibi } from "@/app/api/proje-takip/_lib/muhendislik-ekibi";
import { resolveCanSeeProjeFiyat } from "@/lib/proje-takip/can-see-fiyat.server";
import { ProjeDetayForm } from "../_components/ProjeDetayForm";

export const dynamic = "force-dynamic";

export default async function YeniProjePage() {
  const { user, error } = await requireUser();
  if (error) redirect("/login");

  const canSeeFiyat = await resolveCanSeeProjeFiyat(user);

  const muhendisler = await getMuhendislikEkibi();

  return (
    <ProjeDetayForm
      proje={null}
      canSeeFiyat={canSeeFiyat}
      projeSorumlusuAdi="—"
      muhendisler={muhendisler}
    />
  );
}
