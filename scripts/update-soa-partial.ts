import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Ekran görüntüsündeki 3 kontrol - TÜM ALANLAR
const CONTROLS = [
  {
    controlId: "A.5.1",
    status: "IMPLEMENTED",
    applicability: true,
    controlSource: "BGYS", // Kaynağı
    relatedAssets: "Mevcut Kontrol", // İlgili Varlıklar
    implementationNotes: "Bilgi Güvenliği Politikası, İç Denetim Raporları, Yönetimi Gözden Geçirme Toplantısında yılda en az bir defa değerlendirilecektir.", // Uygulanan Kontrol
    justification: "Kuruluşta ISO 27001:2022 BGYS standardı gereği uygulanmaktadır.", // Seçilme Nedenleri
    documentRef: "L.11.520 Bilgi Güvenliği Yönetim Sistemi Politikası- YGG", // Doküman/Kayıt
  },
  {
    controlId: "A.5.2",
    status: "IMPLEMENTED",
    applicability: true,
    controlSource: "BGYS",
    relatedAssets: "Mevcut Kontrol",
    implementationNotes: "Bilgi Güvenliği Politikası BGYS Temsilcisi ve BG Ekibi",
    justification: "Kuruluşta ISO 27001:2022 BGYS standardı gereği uygulanmaktadır.",
    documentRef: "L.11.520 Bilgi Güvenliği Yönetim Sistemi Politikası",
  },
  {
    controlId: "A.5.3",
    status: "IMPLEMENTED",
    applicability: true,
    controlSource: "BGYS",
    relatedAssets: "Mevcut Kontrol",
    implementationNotes: "Görev Tanımları",
    justification: "Kuruluşta ISO 27001:2022 BGYS standardı gereği uygulanmaktadır.",
    documentRef: "Görev Tanımları",
  },
]

async function main() {
  console.log("3 kontrol güncelleniyor...")
  console.log("================================")

  for (const ctrl of CONTROLS) {
    const result = await prisma.iso27001Control.updateMany({
      where: { controlId: ctrl.controlId },
      data: {
        status: ctrl.status as any,
        applicability: ctrl.applicability,
        controlSource: ctrl.controlSource,
        relatedAssets: ctrl.relatedAssets,
        implementationNotes: ctrl.implementationNotes,
        justification: ctrl.justification,
      },
    })

    if (result.count > 0) {
      console.log(`✓ ${ctrl.controlId} güncellendi`)
      console.log(`  Kaynak: ${ctrl.controlSource}`)
      console.log(`  İlgili Varlıklar: ${ctrl.relatedAssets}`)
      console.log(`  Uygulanan Kontrol: ${ctrl.implementationNotes}`)
      console.log(`  Seçilme Nedeni: ${ctrl.justification}`)
      console.log(`  Doküman: ${ctrl.documentRef}`)
      console.log("")
    } else {
      console.log(`✗ ${ctrl.controlId} bulunamadı`)
    }
  }

  console.log("================================")
  console.log("Tamamlandı!")

  await prisma.$disconnect()
  await pool.end()
}

main().catch(console.error)
