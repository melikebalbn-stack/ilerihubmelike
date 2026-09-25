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
import {
  Plus, FolderKanban, Hourglass, CircleDot, CheckCircle2, XCircle,
  CalendarDays, ArrowUpDown, BarChart3,
} from "lucide-react";
import { AramaKutusu } from "./_components/AramaKutusu";
import { SorumluFiltre } from "./_components/SorumluFiltre";
import { TarihAraligi } from "./_components/TarihAraligi";
import type { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

const ANA_RENK = "#1B4F72";

const ACIK_DURUMLAR = [
  "YENI_DEVAM_EDEN",
  "TASARIM_YENI_DEVAM_EDEN",
  "ONAY_BEKLEYEN_GONDERILEN",
  "REVIZYON",
] as const;

type KartAnahtar = "tumu" | "bekleyen" | "acik" | "kapanmis" | "iptal" | "buAy";

type SearchParamsShape = {
  durum?: string;
  bekleyen?: string;
  buAy?: string;
  sorumlu?: string;
  q?: string;
  tarihBaslangic?: string;
  tarihBitis?: string;
};

function buAyBaslangicStr(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function aktifKart(sp: SearchParamsShape): KartAnahtar {
  if (sp.bekleyen === "1") return "bekleyen";
  if (sp.buAy === "1") return "buAy";
  if (sp.durum === "acik") return "acik";
  if (sp.durum === "kapanmis") return "kapanmis";
  if (sp.durum === "iptal") return "iptal";
  return "tumu";
}

// Kart-ekseni koşulu (durum/bekleyen/buAy) - tek seferde sadece biri aktif.
function kartKosulu(kart: KartAnahtar): Prisma.ProjeTakipWhereInput {
  if (kart === "acik") return { durum: { in: [...ACIK_DURUMLAR] } };
  if (kart === "kapanmis") return { durum: "ONAY_ALAN" };
  if (kart === "iptal") return { durum: "IPTAL" };
  if (kart === "bekleyen") return { muhendislikDoldurmaDurumu: "BEKLIYOR" };
  if (kart === "buAy") return { createdAt: { gte: new Date(buAyBaslangicStr()) } };
  return {};
}

// Kart eksenleri DIŞINDAKİ bağımsız filtreler: sorumlu, arama, tarih aralığı.
// Bunlar hangi kart seçili olursa olsun AYNI kalır, birbirini sıfırlamaz.
async function bagimsizFiltreler(sp: SearchParamsShape): Promise<Prisma.ProjeTakipWhereInput> {
  const where: Prisma.ProjeTakipWhereInput = {};

  if (sp.sorumlu === "atanmamis") where.muhendislikSorumluId = null;
  else if (sp.sorumlu) where.muhendislikSorumluId = sp.sorumlu;

  if (sp.tarihBaslangic || sp.tarihBitis) {
    where.createdAt = {
      ...(sp.tarihBaslangic ? { gte: new Date(sp.tarihBaslangic) } : {}),
      ...(sp.tarihBitis ? { lte: new Date(`${sp.tarihBitis}T23:59:59.999`) } : {}),
    };
  }

  if (sp.q?.trim()) {
    const q = sp.q.trim();
    const sorumluEslesenler = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    where.OR = [
      { projeNo: { contains: q, mode: "insensitive" } },
      { ileriTanim: { contains: q, mode: "insensitive" } },
      { musteriFirma: { contains: q, mode: "insensitive" } },
      ...(sorumluEslesenler.length > 0
        ? [{ muhendislikSorumluId: { in: sorumluEslesenler.map((u) => u.id) } }]
        : []),
    ];
  }

  return where;
}

function kartHref(kart: KartAnahtar, sp: SearchParamsShape): string {
  const params = new URLSearchParams();
  if (sp.sorumlu) params.set("sorumlu", sp.sorumlu);
  if (sp.q) params.set("q", sp.q);
  if (sp.tarihBaslangic) params.set("tarihBaslangic", sp.tarihBaslangic);
  if (sp.tarihBitis) params.set("tarihBitis", sp.tarihBitis);

  if (kart === "acik") params.set("durum", "acik");
  else if (kart === "kapanmis") params.set("durum", "kapanmis");
  else if (kart === "iptal") params.set("durum", "iptal");
  else if (kart === "bekleyen") params.set("bekleyen", "1");
  else if (kart === "buAy") params.set("buAy", "1");

  const query = params.toString();
  return query ? `/proje-takip?${query}` : "/proje-takip";
}

export default async function ProjeTakipListePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  const { error } = await requireUser();
  if (error) redirect("/login");

  const sp = await searchParams;
  const secili = aktifKart(sp);
  const muhendisler = await getMuhendislikEkibi();
  const temel = await bagimsizFiltreler(sp);

  const KARTLAR: { key: KartAnahtar; label: string; icon: typeof FolderKanban; renk: string }[] = [
    { key: "tumu", label: "Toplam", icon: FolderKanban, renk: ANA_RENK },
    { key: "bekleyen", label: "Mühendisliği Bekleyen", icon: Hourglass, renk: "#B45309" },
    { key: "acik", label: "Açık", icon: CircleDot, renk: "#2563EB" },
    { key: "kapanmis", label: "Kapanmış", icon: CheckCircle2, renk: "#059669" },
    { key: "iptal", label: "İptal", icon: XCircle, renk: "#DC2626" },
    { key: "buAy", label: "Bu Ay", icon: CalendarDays, renk: ANA_RENK },
  ];

  // AND: [...] kullanılıyor (spread değil) - temel'in createdAt aralığı
  // (manuel tarih filtresi) ile bir kartın kendi createdAt koşulu (Bu Ay)
  // aynı anda varsa, spread biri diğerini sessizce ezerdi.
  const sayilar = Object.fromEntries(
    await Promise.all(
      KARTLAR.map(async (k) => [
        k.key,
        await prisma.projeTakip.count({ where: { AND: [temel, kartKosulu(k.key)] } }),
      ])
    )
  ) as Record<KartAnahtar, number>;

  const projeler = await prisma.projeTakip.findMany({
    where: { AND: [temel, kartKosulu(secili)] },
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

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Proje Takip</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/proje-takip/rapor">
            <Button variant="outline">
              <BarChart3 className="w-4 h-4 mr-1" />
              Rapor
            </Button>
          </Link>
          <Link href="/proje-takip/yeni">
            <Button style={{ backgroundColor: ANA_RENK }}>
              <Plus className="w-4 h-4 mr-1" />
              Yeni Proje
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {KARTLAR.map((k) => {
          const Icon = k.icon;
          const aktif = secili === k.key;
          return (
            <Link
              key={k.key}
              href={kartHref(k.key, sp)}
              className={`rounded-lg border p-4 flex items-center gap-3 transition-colors ${
                aktif ? "ring-2 ring-blue-500 ring-offset-1 border-blue-500" : "hover:bg-muted/40"
              }`}
            >
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${k.renk}1A` }}
              >
                <Icon className="w-5 h-5" style={{ color: k.renk }} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-semibold leading-tight">{sayilar[k.key]}</p>
                <p className="text-xs text-muted-foreground truncate">{k.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <AramaKutusu />
        <SorumluFiltre muhendisler={muhendisler} />
        <TarihAraligi />
      </div>

      {projeler.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu filtrede proje yok.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><span className="inline-flex items-center gap-1">Proje No <ArrowUpDown className="w-3 h-3" /></span></TableHead>
              <TableHead><span className="inline-flex items-center gap-1">Ürün <ArrowUpDown className="w-3 h-3" /></span></TableHead>
              <TableHead><span className="inline-flex items-center gap-1">Müşteri <ArrowUpDown className="w-3 h-3" /></span></TableHead>
              <TableHead><span className="inline-flex items-center gap-1">Durum <ArrowUpDown className="w-3 h-3" /></span></TableHead>
              <TableHead><span className="inline-flex items-center gap-1">Sorumlu Mühendis <ArrowUpDown className="w-3 h-3" /></span></TableHead>
              <TableHead className="text-right"><span className="inline-flex items-center gap-1">Açılış Tarihi <ArrowUpDown className="w-3 h-3" /></span></TableHead>
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
