import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getBulkCardScanAccess } from "@/app/api/toplu-kart-okutamama/_lib/access"

/**
 * Toplu Kart Okutamama modülü erişim guard'ı (server component).
 * getBulkCardScanAccess ile aynı kural: NONE (Mavi Yaka / yetkisiz beyaz yaka)
 * forma erişemez → ana sayfaya yönlendirilir. Asıl kapı yine her API route'unda
 * (requireUser + getBulkCardScanAccess) uygulanır; bu guard yalnızca UI erişimini
 * kapatır (derinlemesine savunma).
 */
export default async function TopluKartOkutamamaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const access = await getBulkCardScanAccess(session.user.id)
  if (access.level === "NONE") {
    redirect("/")
  }

  return <>{children}</>
}
