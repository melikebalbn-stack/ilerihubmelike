import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { AkademiTopBar } from "@/components/akademi/layout/AkademiTopBar";

export default async function AkademiLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="akademi-scope min-h-full flex flex-col">
      <AkademiTopBar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
