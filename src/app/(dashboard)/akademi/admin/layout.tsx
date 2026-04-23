import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAkademiAdminRole } from "@/lib/akademi-admin-roles";
import { AdminSubNav } from "@/components/akademi/admin/AdminSubNav";

export default async function AkademiAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as { role?: string }).role;
  if (!isAkademiAdminRole(role)) {
    redirect("/akademi?error=unauthorized");
  }

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto">
      <div className="mb-4 ak-animate-in">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: "var(--ak-text-primary)" }}
        >
          ⚙️ Akademi Yönetimi
        </h1>
        <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Kurslar, atamalar ve kullanıcı ilerleme yönetimi
        </p>
      </div>
      <AdminSubNav />
      {children}
    </div>
  );
}
