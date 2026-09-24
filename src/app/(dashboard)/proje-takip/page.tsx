import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { getMuhendislikEkibi } from "@/app/api/proje-takip/_lib/muhendislik-ekibi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { SorumluFiltre } from "./_components/SorumluFiltre";
import type { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

const ANA_RENK = "#1B4F72";

const ACIK_DURUMLAR = [
  "YENI_DEVAM_EDEN",
  "TASARIM_YENI_DEVAM_EDEN",
  "ONAY_BEKLEYEN_GONDERILEN",
  "REVIZYON",
] as const;

const FILTRELER = [
  { key: "tumu", label: "Tümü" },
  { key: "acik", label: "Açık" },
  { key: "kapanmis", label: "Kapanmış" },
  { key: "iptal", label: "İptal" },
] as const;

function whereForFiltreler(
  durum: string,
  sorumlu: string | undefined
): Prisma.ProjeTakipWhereInput {
  const where: Prisma.ProjeTakipWhereInput = {};

  if (durum === "acik") where.durum = { in: [...ACIK_DURUMLAR] };
  else if (durum === "kapanmis") where.durum = "ONAY_ALAN";
  else if (durum === "iptal") where.durum = "IPTAL";

  if (sorumlu === "atanmamis") where.muhendislikSorumluId = null;
  else if (sorumlu) where.muhendislikSorumluId = sorumlu;

  return where;
}

export default async function ProjeTakipListePage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; sorumlu?: string }>;
}) {
  const { error } = await requireUser();
  if (error) redirect("/login");

  const { durum, sorumlu } = await searchParams;
  const aktifFiltre = durum && FILTRELER.some((f) => f.key === durum) ? durum : "tumu";

  const muhendisler = await getMuhendislikEkibi();

  const projeler = await prisma.projeTakip.findMany({
    where: whereForFiltreler(aktifFiltre, sorumlu),
    orderBy: { createdAt: "desc" },
  });

  const sorumluIdler = [...new Set(
    projeler.map((p) => p.muhendislikSorumluId).filter((id): id is string => !!id)
  )];
  const sorumlular = sorumluIdler.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: sorumluIdler } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const sorumluAdi = new Map(sorumlular.map((u) => [u.id, u.name ?? u.email]));

  function durumHref(key: string) {
    const params = new URLSearchParams();
    if (key !== "tumu") params.set("durum", key);
    if (sorumlu) params.set("sorumlu", sorumlu);
    const query = params.toString();
    return query ? `/proje-takip?${query}` : "/proje-takip";
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: ANA_RENK }}>
          Proje Takip
        </h1>
        <Link href="/proje-takip/yeni">
          <Button style={{ backgroundColor: ANA_RENK }}>
            <Plus className="w-4 h-4 mr-1" />
            Yeni Proje
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTRELER.map((f) => (
          <Link key={f.key} href={durumHref(f.key)}>
            <Button
              type="button"
              variant={aktifFiltre === f.key ? "default" : "outline"}
              style={aktifFiltre === f.key ? { backgroundColor: ANA_RENK } : undefined}
              size="sm"
            >
              {f.label}
            </Button>
          </Link>
        ))}
        <SorumluFiltre muhendisler={muhendisler} />
      </div>

      {projeler.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu filtrede proje yok.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proje No</TableHead>
              <TableHead>Ürün</TableHead>
              <TableHead>Müşteri</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Sorumlu Mühendis</TableHead>
              <TableHead className="text-right">Açılış Tarihi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projeler.map((p) => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium">
                  <Link href={`/proje-takip/${p.projeNo}`} className="block">
                    {p.projeNo}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/proje-takip/${p.projeNo}`} className="block">
                    {p.ileriTanim}
                  </Link>
                </TableCell>
                <TableCell>{p.musteriFirma}</TableCell>
                <TableCell><Badge variant="outline">{p.durum}</Badge></TableCell>
                <TableCell>
                  {p.muhendislikSorumluId ? sorumluAdi.get(p.muhendislikSorumluId) ?? "—" : "—"}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {p.createdAt.toLocaleDateString("tr-TR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
