import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface AssetSeed {
  name: string
  category: string
  type: string
  confidentiality: number
  integrity: number
  availability: number
  classification: string
  department?: string
  location?: string
  description?: string
}

const COMMON_ASSETS: AssetSeed[] = [
  // --- YAZILIM ---
  {
    name: "ERP Sistemi (Canias)",
    category: "SOFTWARE",
    type: "APPLICATION",
    confidentiality: 4,
    integrity: 5,
    availability: 5,
    classification: "CONFIDENTIAL",
    department: "Bilgi Islem",
    description: "Kurumsal kaynak planlama yazilimi",
  },
  {
    name: "E-Posta Sistemi (Exchange/O365)",
    category: "SOFTWARE",
    type: "APPLICATION",
    confidentiality: 4,
    integrity: 4,
    availability: 4,
    classification: "CONFIDENTIAL",
    department: "Bilgi Islem",
    description: "Kurumsal e-posta ve isbirligi platformu",
  },
  {
    name: "Antivirus / Endpoint Protection",
    category: "SOFTWARE",
    type: "APPLICATION",
    confidentiality: 3,
    integrity: 4,
    availability: 4,
    classification: "INTERNAL",
    department: "Bilgi Islem",
    description: "Uc nokta guvenlik yazilimi",
  },
  {
    name: "Microsoft Office Lisanslari",
    category: "SOFTWARE",
    type: "APPLICATION",
    confidentiality: 2,
    integrity: 3,
    availability: 3,
    classification: "INTERNAL",
    description: "Ofis uygulamalari lisans paketi",
  },
  {
    name: "Windows Isletim Sistemi Lisanslari",
    category: "SOFTWARE",
    type: "OPERATING_SYSTEM",
    confidentiality: 2,
    integrity: 4,
    availability: 4,
    classification: "INTERNAL",
    description: "Masaustu ve sunucu isletim sistemi lisanslari",
  },

  // --- AG ---
  {
    name: "Ana Guvenlik Duvari (Firewall)",
    category: "NETWORK",
    type: "FIREWALL",
    confidentiality: 5,
    integrity: 5,
    availability: 5,
    classification: "RESTRICTED",
    department: "Bilgi Islem",
    location: "Sunucu Odasi",
    description: "Internet cikisi ve ag segmentasyonu icin ana firewall",
  },
  {
    name: "Cekirdek Ag Anahtari (Core Switch)",
    category: "NETWORK",
    type: "SWITCH",
    confidentiality: 3,
    integrity: 4,
    availability: 5,
    classification: "CONFIDENTIAL",
    location: "Sunucu Odasi",
    description: "Merkezi ag anahtari",
  },
  {
    name: "Yonlendirici (Router)",
    category: "NETWORK",
    type: "ROUTER",
    confidentiality: 3,
    integrity: 4,
    availability: 5,
    classification: "CONFIDENTIAL",
    location: "Sunucu Odasi",
    description: "WAN baglantisi yonlendirici",
  },
  {
    name: "Kablosuz Erisim Noktalari (WiFi AP)",
    category: "NETWORK",
    type: "ACCESS_POINT",
    confidentiality: 3,
    integrity: 3,
    availability: 3,
    classification: "INTERNAL",
    description: "Kablosuz ag erisim noktalari",
  },

  // --- HIZMET ---
  {
    name: "Internet Hizmeti",
    category: "SERVICE",
    type: "UTILITY",
    confidentiality: 2,
    integrity: 3,
    availability: 5,
    classification: "INTERNAL",
    description: "Kurumsal internet erisim hizmeti",
  },
  {
    name: "Bulut Yedekleme Hizmeti",
    category: "SERVICE",
    type: "CLOUD_SERVICE",
    confidentiality: 4,
    integrity: 4,
    availability: 4,
    classification: "CONFIDENTIAL",
    description: "Uzak yedekleme ve felaket kurtarma hizmeti",
  },
  {
    name: "Bakim/Destek Sozlesmeleri",
    category: "SERVICE",
    type: "EXTERNAL_SERVICE",
    confidentiality: 2,
    integrity: 3,
    availability: 3,
    classification: "INTERNAL",
    description: "Donanim ve yazilim bakim destek sozlesmeleri",
  },

  // --- BILGI ---
  {
    name: "Musteri Veritabani",
    category: "INFORMATION",
    type: "DATABASE",
    confidentiality: 5,
    integrity: 5,
    availability: 4,
    classification: "RESTRICTED",
    description: "Musteri bilgileri ve siparis kayitlari",
  },
  {
    name: "Finansal Kayitlar",
    category: "INFORMATION",
    type: "RECORD",
    confidentiality: 5,
    integrity: 5,
    availability: 3,
    classification: "RESTRICTED",
    description: "Muhasebe, fatura ve mali raporlar",
  },
  {
    name: "Insan Kaynaklari Verileri",
    category: "INFORMATION",
    type: "RECORD",
    confidentiality: 5,
    integrity: 4,
    availability: 3,
    classification: "RESTRICTED",
    description: "Personel ozluk bilgileri, maas ve performans verileri",
  },
  {
    name: "Uretim Veritabani",
    category: "INFORMATION",
    type: "DATABASE",
    confidentiality: 4,
    integrity: 5,
    availability: 5,
    classification: "CONFIDENTIAL",
    description: "Uretim planlama, stok ve kalite kontrol verileri",
  },
  {
    name: "Sistem Yedekleri",
    category: "INFORMATION",
    type: "BACKUP",
    confidentiality: 4,
    integrity: 5,
    availability: 3,
    classification: "CONFIDENTIAL",
    description: "Sunucu ve veritabani yedekleri",
  },

  // --- DONANIM ---
  {
    name: "Ana Sunucu (Domain Controller)",
    category: "HARDWARE",
    type: "SERVER",
    confidentiality: 5,
    integrity: 5,
    availability: 5,
    classification: "RESTRICTED",
    location: "Sunucu Odasi",
    description: "Active Directory ve DNS hizmetleri sunucusu",
  },
  {
    name: "Yedek Sunucu",
    category: "HARDWARE",
    type: "SERVER",
    confidentiality: 4,
    integrity: 4,
    availability: 4,
    classification: "CONFIDENTIAL",
    location: "Sunucu Odasi",
    description: "Yedekleme ve ikincil hizmetler sunucusu",
  },
  {
    name: "NAS Depolama Unitesi",
    category: "HARDWARE",
    type: "STORAGE",
    confidentiality: 4,
    integrity: 4,
    availability: 4,
    classification: "CONFIDENTIAL",
    location: "Sunucu Odasi",
    description: "Merkezi dosya paylasimi ve yedekleme depolama",
  },

  // --- FIZIKSEL ---
  {
    name: "Sunucu Odasi",
    category: "PHYSICAL",
    type: "ROOM",
    confidentiality: 5,
    integrity: 5,
    availability: 5,
    classification: "RESTRICTED",
    description: "BT ekipmanlarin bulundugu fiziksel alan",
  },
  {
    name: "Ana Bina",
    category: "PHYSICAL",
    type: "BUILDING",
    confidentiality: 2,
    integrity: 3,
    availability: 4,
    classification: "INTERNAL",
    description: "Ileri Group ana uretim ve ofis binasi",
  },
  {
    name: "Guvenlik Kamera Sistemi (CCTV)",
    category: "PHYSICAL",
    type: "MEDIA",
    confidentiality: 3,
    integrity: 3,
    availability: 3,
    classification: "CONFIDENTIAL",
    description: "Bina ici ve disi guvenlik kamera altyapisi",
  },
  {
    name: "Kartli Gecis Sistemi",
    category: "PHYSICAL",
    type: "MEDIA",
    confidentiality: 4,
    integrity: 4,
    availability: 4,
    classification: "CONFIDENTIAL",
    description: "Fiziksel erisim kontrol ve takip sistemi",
  },
  {
    name: "Kesintisiz Guc Kaynagi (UPS)",
    category: "PHYSICAL",
    type: "MEDIA",
    confidentiality: 1,
    integrity: 3,
    availability: 5,
    classification: "INTERNAL",
    location: "Sunucu Odasi",
    description: "Sunucu odasi kesintisiz guc kaynagi",
  },
];

function getCriticality(total: number): string {
  if (total >= 12) return "CRITICAL";
  if (total >= 9) return "HIGH";
  if (total >= 6) return "MEDIUM";
  return "LOW";
}

async function main() {
  console.log("ISO 27001 Ortak Varliklar ekleniyor...\n");

  // Son asset numarasini al
  const lastAsset = await prisma.iso27001Asset.findFirst({
    orderBy: { assetNumber: "desc" },
  });
  let nextNumber = 1;
  if (lastAsset?.assetNumber) {
    const match = lastAsset.assetNumber.match(/ASSET-(\d+)/);
    if (match) nextNumber = parseInt(match[1]) + 1;
  }

  let added = 0;
  let skipped = 0;

  for (const asset of COMMON_ASSETS) {
    // Ayni isimde mevcut varlik var mi kontrol et
    const existing = await prisma.iso27001Asset.findFirst({
      where: { name: asset.name },
    });

    if (existing) {
      console.log(`  Atlaniyor (mevcut): ${asset.name}`);
      skipped++;
      continue;
    }

    const assetNumber = `ASSET-${String(nextNumber).padStart(3, "0")}`;
    const assetValue = asset.confidentiality + asset.integrity + asset.availability;
    const criticality = getCriticality(assetValue);

    await prisma.iso27001Asset.create({
      data: {
        assetNumber,
        name: asset.name,
        description: asset.description || null,
        category: asset.category as any,
        type: asset.type as any,
        location: asset.location || null,
        department: asset.department || null,
        confidentiality: asset.confidentiality,
        integrity: asset.integrity,
        availability: asset.availability,
        assetValue,
        criticality: criticality as any,
        classification: asset.classification as any,
        status: "ACTIVE",
        nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    console.log(`  + ${assetNumber} - ${asset.name} [${criticality}]`);
    nextNumber++;
    added++;
  }

  const total = await prisma.iso27001Asset.count();
  console.log(`\nSonuc: ${added} eklendi, ${skipped} atlandi`);
  console.log(`Toplam varlik sayisi: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
