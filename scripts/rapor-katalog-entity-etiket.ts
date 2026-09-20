/**
 * rapor_katalog_entity başlangıç sözlüğü — ana iş tabloları için Türkçe entity etiketi.
 *   npx tsx scripts/rapor-katalog-entity-etiket.ts
 * ÖN KOŞUL: rapor_katalog_entity migration'ı uygulanmış olmalı.
 * Aynı entity adı hangi projeksiyonda geçiyorsa hepsine uygulanır; elle girilmiş etiket EZİLMEZ.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const SOZLUK: Record<string, string> = {
  ShopOrd: 'İş Emri',
  ShopOrderOperation: 'İş Emri Operasyonu',
  ShopMaterialAlloc: 'İş Emri Malzeme Rezervasyonu',
  InventoryPart: 'Stok Kartı',
  InventoryPartInStock: 'Stok Bakiyesi',
  PartCatalog: 'Parça Kataloğu',
  CustomerOrder: 'Müşteri Siparişi',
  CustomerOrderLine: 'Müşteri Sipariş Satırı',
  PurchaseOrder: 'Satınalma Siparişi',
  PurchaseOrderLine: 'Satınalma Sipariş Satırı',
  WorkCenter: 'İş Merkezi / Tezgah',
  PersonInfo: 'Kişi Bilgisi',
  CompanyPerson: 'Şirket Personeli',
  Employee: 'Çalışan',
  OrganizationUnit: 'Organizasyon Birimi',
  Position: 'Pozisyon',
  Project: 'Proje',
  Activity: 'Aktivite',
}

async function main() {
  let eklenen = 0, atlanan = 0, bulunamayan: string[] = []
  for (const [entity, etiket] of Object.entries(SOZLUK)) {
    const projeksiyonlar = await prisma.raporKatalog.findMany({ where: { kaynakTipi: 'IFS_ODATA', entity }, select: { kaynakAd: true }, distinct: ['kaynakAd'] })
    if (!projeksiyonlar.length) { bulunamayan.push(entity); continue }
    for (const { kaynakAd } of projeksiyonlar) {
      const mevcut = await prisma.raporKatalogEntity.findUnique({ where: { kaynakAd_entity: { kaynakAd, entity } } })
      if (mevcut?.etiket) { atlanan++; continue }
      await prisma.raporKatalogEntity.upsert({ where: { kaynakAd_entity: { kaynakAd, entity } }, create: { kaynakAd, entity, etiket }, update: { etiket } })
      eklenen++
    }
    console.log(`${entity.padEnd(22)} → ${etiket.padEnd(30)} ${projeksiyonlar.length} projeksiyon`)
  }
  console.log(`\nEklenen: ${eklenen}, mevcut etiketli (atlandı): ${atlanan}${bulunamayan.length ? `, katalogda yok: ${bulunamayan.join(', ')}` : ''}`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
