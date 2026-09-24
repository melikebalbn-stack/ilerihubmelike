import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const ANA_RENK = "#1B4F72";

export const dynamic = "force-dynamic";

export default async function MuhendislikListePage() {
  const { error } = await requireUser();
  if (error) redirect("/login");

  const bekleyenler = await prisma.projeTakip.findMany({
    where: { muhendislikDoldurmaDurumu: "BEKLIYOR" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-xl font-semibold mb-1" style={{ color: ANA_RENK }}>
        Doldurulmayı Bekleyen Projeler
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Satış tarafından açılan, mühendislik plant parametreleri henüz girilmemiş projeler.
      </p>

      {bekleyenler.length === 0 && (
        <p className="text-sm text-muted-foreground">Bekleyen proje yok.</p>
      )}

      <div className="space-y-3">
        {bekleyenler.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{p.projeNo} — {p.ileriTanim}</p>
                <p className="text-sm text-muted-foreground">{p.musteriFirma}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{p.durum}</Badge>
                <Link
                  href={`/proje-takip/muhendislik/${p.projeNo}`}
                  className="text-sm underline"
                  style={{ color: ANA_RENK }}
                >
                  Doldur
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
