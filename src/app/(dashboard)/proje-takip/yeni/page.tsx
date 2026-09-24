import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { YeniProjeForm } from "../_components/YeniProjeForm";

export const dynamic = "force-dynamic";

export default async function YeniProjePage() {
  const { error } = await requireUser();
  if (error) redirect("/login");

  return <YeniProjeForm />;
}
