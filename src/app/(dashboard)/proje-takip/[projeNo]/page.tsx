import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { getMuhendislikEkibi } from "@/app/api/proje-takip/_lib/muhendislik-ekibi";
import { fiyatAlanlariniCikar } from "@/lib/proje-takip/can-see-fiyat";
import { resolveCanSeeProjeFiyat } from "@/lib/proje-takip/can-see-fiyat.server";
import { ProjeDetayForm } from "../_components/ProjeDetayForm";

export const dynamic = "force-dynamic";

export default async function ProjeDetayPage({
  params,
}: {
  params: Promise<{ projeNo: string }>;
}) {
  const { user, error } = await requireUser();
  if (error) redirect("/login");

  const canSeeFiyat = await resolveCanSeeProjeFiyat(user);

  const { projeNo } = await params;

  const proje = await prisma.projeTakip.findUnique({
    where: { projeNo },
  });
  if (!proje) notFound();

  const olusturan = await prisma.user.findUnique({
    where: { id: proje.olusturanId },
    select: { name: true, email: true },
  });
  const muhendisler = await getMuhendislikEkibi();

  return (
    <ProjeDetayForm
      // canSeeFiyat false ise fiyat alanları objeden tamamen çıkarılır (null değil,
      // key'in kendisi hiç gitmez) - Client Component'e bu şekilde geçiyor.
      proje={canSeeFiyat ? proje : fiyatAlanlariniCikar(proje)}
      canSeeFiyat={canSeeFiyat}
      projeSorumlusuAdi={olusturan?.name ?? olusturan?.email ?? "—"}
      muhendisler={muhendisler}
    />
  );
}
