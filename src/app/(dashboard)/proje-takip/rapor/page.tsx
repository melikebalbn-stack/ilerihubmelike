import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ANA_RENK = "#1B4F72";

async function getRaporVerisi() {
  const toplam = await prisma.projeTakip.count();

  const bekleyen = await prisma.projeTakip.count({
    where: { muhendislikDoldurmaDurumu: "BEKLIYOR" },
  });
  const tamamlanan = await prisma.projeTakip.count({
    where: { muhendislikDoldurmaDurumu: "TAMAMLANDI" },
  });

  const ayBasi = new Date();
  ayBasi.setDate(1);
  ayBasi.setHours(0, 0, 0, 0);
  const buAyAcilan = await prisma.projeTakip.count({
    where: { createdAt: { gte: ayBasi } },
  });

  const durumGrup = await prisma.projeTakip.groupBy({
    by: ["durum"],
    _count: { _all: true },
  });

  const projeDurumTipiGrup = await prisma.projeTakip.groupBy({
    by: ["projeDurumTipi"],
    _count: { _all: true },
  });

  const grupKodGrup = await prisma.projeTakip.groupBy({
    by: ["grupKod"],
    _count: { _all: true },
  });

  const sonEklenenler = await prisma.projeTakip.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      projeNo: true,
      ileriTanim: true,
      musteriFirma: true,
      durum: true,
      createdAt: true,
    },
  });

  return {
    toplam, bekleyen, tamamlanan, buAyAcilan,
    durumGrup: durumGrup.sort((a, b) => b._count._all - a._count._all),
    projeDurumTipiGrup: projeDurumTipiGrup.sort((a, b) => b._count._all - a._count._all),
    grupKodGrup: grupKodGrup.sort((a, b) => b._count._all - a._count._all).slice(0, 10),
    sonEklenenler,
  };
}

export default async function ProjeTakipRaporPage() {
  const { error } = await requireUser();
  if (error) redirect("/login");

  const data = await getRaporVerisi();
  const yuzde = (n: number) => data.toplam > 0 ? `%${((n / data.toplam) * 100).toFixed(1)}` : "%0";

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: ANA_RENK }}>
          Proje Takip Raporu
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} itibarıyla
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold">{data.toplam}</p>
            <p className="text-sm text-muted-foreground">Toplam Proje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold text-amber-600">{data.bekleyen}</p>
            <p className="text-sm text-muted-foreground">Mühendislik Bekliyor</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold text-emerald-600">{data.tamamlanan}</p>
            <p className="text-sm text-muted-foreground">Tamamlanan</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold" style={{ color: ANA_RENK }}>{data.buAyAcilan}</p>
            <p className="text-sm text-muted-foreground">Bu Ay Açılan</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium" style={{ color: ANA_RENK }}>Durum Dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {data.durumGrup.map((d) => (
              <div key={d.durum ?? "belirsiz"} className="flex items-center justify-between px-6 py-2.5 text-sm">
                <span className="text-muted-foreground">{d.durum ?? "Belirsiz"}</span>
                <span className="flex items-center gap-6">
                  <span className="font-medium tabular-nums">{d._count._all}</span>
                  <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                    {yuzde(d._count._all)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium" style={{ color: ANA_RENK }}>Proje Durum Tipi (Numune / Prototip / Seri...)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {data.projeDurumTipiGrup.map((d) => (
              <div key={d.projeDurumTipi ?? "belirsiz"} className="flex items-center justify-between px-6 py-2.5 text-sm">
                <span className="text-muted-foreground">{d.projeDurumTipi ?? "Belirsiz"}</span>
                <span className="font-medium tabular-nums">{d._count._all}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium" style={{ color: ANA_RENK }}>Grup Kod Dağılımı (İlk 10)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {data.grupKodGrup.map((d) => (
              <div key={d.grupKod ?? "belirsiz"} className="flex items-center justify-between px-6 py-2.5 text-sm">
                <span className="text-muted-foreground">{d.grupKod ?? "Belirsiz"}</span>
                <span className="font-medium tabular-nums">{d._count._all}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium" style={{ color: ANA_RENK }}>Son Eklenen Projeler</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {data.sonEklenenler.map((p) => (
              <a
                key={p.projeNo}
                href={`/proje-takip/${p.projeNo}`}
                className="flex items-center justify-between gap-4 px-6 py-2.5 text-sm hover:bg-muted/40"
              >
                <span className="font-medium w-24 shrink-0">{p.projeNo}</span>
                <span className="flex-1 truncate">{p.ileriTanim}</span>
                <span className="flex-1 truncate text-muted-foreground">{p.musteriFirma}</span>
                <span className="text-xs text-muted-foreground w-40 text-right">{p.durum}</span>
                <span className="text-xs text-muted-foreground w-20 text-right">
                  {p.createdAt.toLocaleDateString("tr-TR")}
                </span>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
