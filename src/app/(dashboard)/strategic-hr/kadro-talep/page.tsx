import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ClipboardList, ShieldAlert } from "lucide-react"
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { talepAcabilirMi } from "@/lib/kadro-talep/kadro-talep-yetki"
import { PersonelTalepPaneli } from "@/components/kadro-talep/PersonelTalepPaneli"

// Bağımsız Personel Talep Formu sayfası. Yetki çekirdeği (kadroTalepYetkisiCore →
// talepAcabilirMi) İK VEYA departman müdürü/müdür yardımcısı kontrolünü TEK yerden
// yapar; içerik İşe Alım sekmesiyle ORTAK PersonelTalepPaneli bileşenidir.
export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const talepAcabilir = await talepAcabilirMi(
    session.user.id,
    session.user.permissions ?? []
  )

  if (!talepAcabilir) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Erişim Yok
            </CardTitle>
            <CardDescription>
              Bu sayfaya erişim yetkiniz yok.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Personel talebi yalnızca departman müdürleri, müdür yardımcıları ve İK
            tarafından açılabilir.
          </CardContent>
        </Card>
      </div>
    )
  }

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
