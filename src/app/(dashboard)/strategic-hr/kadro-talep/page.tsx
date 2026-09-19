import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ClipboardList } from "lucide-react"
import { kadroTalepErisimiCore } from "@/lib/kadro-talep/kadro-talep-yetki"
import { PersonelTalepPaneli } from "@/components/kadro-talep/PersonelTalepPaneli"

// Bağımsız Personel Talep Formu sayfası. Erişim çekirdeği (kadroTalepErisimiCore) İK /
// recruitment.view / departman müdürü-müdür yrd. / kadro.talep.ac kontrolünü TEK yerden
// yapar; içerik İşe Alım sekmesiyle ORTAK PersonelTalepPaneli bileşenidir.
export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  // ÖN KAPI (19.09.2026 erişim daraltma): admin ∨ view ∨ koltuk ∨ kadro.talep.ac; aksi
  // durumda uyarı kartı yerine diğer korumalı sayfalarla aynı desen — /?error=unauthorized.
  const erisim = await kadroTalepErisimiCore(session.user.id, session.user.permissions ?? [])
  if (!erisim.erisebilir) redirect("/?error=unauthorized")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          Personel Talep Formu
        </h1>
        <p className="text-muted-foreground">
          Departmanınız için yeni personel talebi oluşturun ve mevcut talepleri takip edin
        </p>
      </div>
      <PersonelTalepPaneli />
    </div>
  )
}
