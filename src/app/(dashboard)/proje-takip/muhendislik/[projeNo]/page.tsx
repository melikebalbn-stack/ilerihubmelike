import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { resolveCanSeeProjeFiyat } from "@/lib/proje-takip/can-see-fiyat";
import { MuhendislikDoldurForm } from "../../_components/MuhendislikDoldurForm";

export const dynamic = "force-dynamic";

export default async function MuhendislikDoldurPage({
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

  // canSeeFiyat false ise fiyat alanları objeden tamamen çıkarılır (null değil,
  // key'in kendisi hiç gitmez) - Client Component'e bu şekilde geçiyor.
  if (!canSeeFiyat) {
    const {
      prototipFiyati, prototipParaBirimi, nre, nreParaBirimi,
      birimFiyat, birimFiyatParaBirimi, kalipTutar, hedefYillik,
      ...projeGizli
    } = proje;
    return <MuhendislikDoldurForm proje={projeGizli} canSeeFiyat={false} />;
  }

  return <MuhendislikDoldurForm proje={proje} canSeeFiyat={true} />;
}
