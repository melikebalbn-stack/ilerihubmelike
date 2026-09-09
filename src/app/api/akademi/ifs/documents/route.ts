import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { stripDeptPrefix } from "@/lib/akademi-ifs";
import { NextResponse } from "next/server";

// IFS EĞİTİM DOKÜMANLARI — /ifs/egitimler ekranının veri kaynağı (READ).
//
// Ekran eskiden bu listeyi departments + paket başına bir areas çağrısıyla
// kuruyordu: 10 IFS paketi için sayfa açılışında 11 istek. areas ucu bunun için
// fazla iş yapıyor (paketin kursları, her kursun aktif içerik sayımı, kullanıcı
// ilerlemesi) — oysa ekranın tek ihtiyacı referenceDocs. Bu uç yalnız o veriyi
// tek sorguda döndürür.
//
// Dokümanı olmayan paket HİÇ DÖNMEZ (Melih kararı): boş satır göstermek yerine
// listede yer almıyor. Bugün Kalite ve Sistem Geliştirme dokümansız — 10 aktif
// pakette 8 satır döner. Filtre DB'de (`referenceDocs: { some: {} }`).
//
// Sıralama paket ADINA göre: sortOrder yalnız paket İÇİNDEKİ dokümanları
// sıralar ve 9 kaydın 8'inde 0 — paketler arası sıralama için kullanılamaz.
//
// Guard ifs.view seviyesinde, departments/areas ile aynı desen. Kişi verisi,
// ilerleme ya da değerlendirme DÖNMEZ.

export interface IfsDocumentGroup {
  packageId: string;
  name: string;
  displayName: string;
  docs: { id: string; title: string; fileUrl: string; sortOrder: number }[];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const packages = await prisma.coursePackage.findMany({
    where: { isActive: true, isIfs: true, referenceDocs: { some: {} } },
    include: { referenceDocs: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });

  const groups: IfsDocumentGroup[] = packages.map((p) => ({
    packageId: p.id,
    name: p.name,
    displayName: stripDeptPrefix(p.name),
    docs: p.referenceDocs.map((d) => ({
      id: d.id,
      title: d.title,
      fileUrl: d.fileUrl,
      sortOrder: d.sortOrder,
    })),
  }));

  return NextResponse.json({
    groups,
    ozet: {
      paketSayisi: groups.length,
      dokumanSayisi: groups.reduce((n, g) => n + g.docs.length, 0),
    },
  });
}
