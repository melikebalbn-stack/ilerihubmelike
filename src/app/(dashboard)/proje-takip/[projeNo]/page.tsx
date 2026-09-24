import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { getMuhendislikEkibi } from "@/app/api/proje-takip/_lib/muhendislik-ekibi";
import { ProjeDetayForm } from "../_components/ProjeDetayForm";

export const dynamic = "force-dynamic";

export default async function ProjeDetayPage({
  params,
}: {
  params: Promise<{ projeNo: string }>;
}) {
  const { error } = await requireUser();
  if (error) redirect("/login");

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
      proje={proje}
      projeSorumlusuAdi={olusturan?.name ?? olusturan?.email ?? "—"}
      muhendisler={muhendisler}
    />
  );
}
