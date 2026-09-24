import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { MuhendislikDoldurForm } from "../../_components/MuhendislikDoldurForm";

export const dynamic = "force-dynamic";

export default async function MuhendislikDoldurPage({
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

  return <MuhendislikDoldurForm proje={proje} />;
}
