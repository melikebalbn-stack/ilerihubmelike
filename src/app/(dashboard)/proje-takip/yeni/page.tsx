import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getMuhendislikEkibi } from "@/app/api/proje-takip/_lib/muhendislik-ekibi";
import { YeniProjeForm } from "../_components/YeniProjeForm";

export const dynamic = "force-dynamic";

export default async function YeniProjePage() {
  const { error } = await requireUser();
  if (error) redirect("/login");

  const muhendisler = await getMuhendislikEkibi();

  return <YeniProjeForm muhendisler={muhendisler} />;
}
