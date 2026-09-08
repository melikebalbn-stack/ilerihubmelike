// Kalıcı yönlendirme: alan detayı /ifs/odevler/[courseId] altına taşındı.
// courseId ve ?dept= parametresi KORUNUR.
import { redirect } from "next/navigation";

export default async function IfsGorevlerimDetayRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { courseId } = await params;
  const sp = await searchParams;
  const dept = typeof sp.dept === "string" ? sp.dept : undefined;
  redirect(
    dept
      ? `/ifs/odevler/${courseId}?dept=${encodeURIComponent(dept)}`
      : `/ifs/odevler/${courseId}`
  );
}
