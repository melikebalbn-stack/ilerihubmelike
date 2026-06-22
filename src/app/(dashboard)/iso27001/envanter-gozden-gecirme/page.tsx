import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { ClipboardCheck } from "lucide-react"

// PR-EGG-1: Liste sayfası henüz yok. Tek tutanak varsa direkt detayı aç,
// yoksa boş durum göster. PR-EGG-2'de bu sayfa liste sayfasına dönüşecek.
export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect("/login")

  const first = await prisma.inventoryReview.findFirst({
    orderBy: { reviewDate: "desc" },
  })

  if (first) {
    redirect(`/iso27001/envanter-gozden-gecirme/${first.id}`)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Envanter Gözden Geçirme
          </CardTitle>
          <CardDescription>
            ISO 27001 A.5.9 — Bilgi varlıkları envanterinin yıllık gözden
            geçirme tutanakları
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Henüz tutanak oluşturulmamış. İlk tutanak BGYS Sorumlusu tarafından
            hazırlanacaktır.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
