# 💰 İleriHub - Maliyet Analizi Modülü

## Tasarım Dokümanı v2.0

---

## 📋 Modül Özeti

| Bilgi | Değer |
|-------|-------|
| **Modül Adı** | Maliyet Analizi (Cost Analysis) |
| **Amaç** | Ürün maliyetlerinin detaylı takibi, Should-Cost analizi |
| **Hedef Kullanıcı** | Maliyet mühendisleri, satış ekibi, yönetim |
| **Referans** | Roketsan 2'li TG maliyet yapısı |

---

## 🎨 Tasarım Kuralları

### Renk Paleti (Pastel)

```css
/* Pastel Renkler */
--pastel-blue: #E8F4FD;      /* Malzeme */
--pastel-green: #E8F5E9;     /* İşçilik */
--pastel-orange: #FFF3E0;    /* Dış Hizmet */
--pastel-purple: #F3E5F5;    /* Diğer/Ayarlar */
--pastel-teal: #E0F2F1;      /* Özet/Hesaplama */
--pastel-yellow: #FFF8E1;    /* Uyarı */
--pastel-red: #FFEBEE;       /* Hata */

/* Ana Tema (mevcut İleriHub) */
--primary: teal-600;         /* #0d9488 */
--primary-dark: teal-700;    /* #0f766e */
```

### Kılavuz Kutusu Yapısı (Her Sayfada)

```tsx
// Kaizen tarzı kılavuz kutusu
<div className="bg-pastel-blue rounded-lg p-5 border-l-4 border-blue-500 mb-6">
  <h3 className="font-semibold text-blue-800 mb-2">Kılavuz Başlığı</h3>
  <p className="text-blue-700 text-sm mb-4">Açıklama metni...</p>
  
  <div className="grid grid-cols-2 gap-4">
    <div className="bg-white bg-opacity-60 rounded-lg p-3">
      <h4 className="font-medium text-blue-800 mb-2">Alt Başlık 1</h4>
      <ul className="text-sm text-blue-700 space-y-1">
        <li>• Madde 1</li>
        <li>• Madde 2</li>
      </ul>
    </div>
    <div className="bg-white bg-opacity-60 rounded-lg p-3">
      <h4 className="font-medium text-blue-800 mb-2">Alt Başlık 2</h4>
      <ul className="text-sm text-blue-700 space-y-1">
        <li>• Madde 1</li>
        <li>• Madde 2</li>
      </ul>
    </div>
  </div>
</div>
```

### İkon Kullanımı

```
❌ YAPMA: Her yere emoji/ikon koyma
✅ YAP: Sadece şu yerlerde kullan:
   - Durum badge'leri (Onaylı, Taslak, vb.)
   - Boş state görselleri
   - Kritik uyarılar
```

---

## 🗄️ Prisma Schema

### Ana Model: CostAnalysis

```prisma
model CostAnalysis {
  id                String   @id @default(cuid())
  code              String   @unique  // 2910, 2911, vb.
  name              String             // 2'li TG
  description       String?
  revision          String   @default("A")
  
  // Ürün bilgileri
  finishedWeight    Decimal  @db.Decimal(10, 2)  // kg
  currency          Currency @default(EUR)
  
  // İlişkiler
  categoryId        String?
  category          CostCategory? @relation(fields: [categoryId], references: [id])
  customerId        String?
  customer          CostCustomer? @relation(fields: [customerId], references: [id])
  
  // Hesaplanan değerler (cache)
  materialCost      Decimal  @default(0) @db.Decimal(12, 2)
  laborCost         Decimal  @default(0) @db.Decimal(12, 2)
  externalCost      Decimal  @default(0) @db.Decimal(12, 2)
  otherCost         Decimal  @default(0) @db.Decimal(12, 2)
  subtotal          Decimal  @default(0) @db.Decimal(12, 2)
  
  // Genel gider ve kar
  overheadRate      Decimal  @default(25) @db.Decimal(5, 2)  // %
  overheadAmount    Decimal  @default(0) @db.Decimal(12, 2)
  totalCost         Decimal  @default(0) @db.Decimal(12, 2)
  
  profitRate        Decimal  @default(20) @db.Decimal(5, 2)  // %
  profitAmount      Decimal  @default(0) @db.Decimal(12, 2)
  salesPrice        Decimal  @default(0) @db.Decimal(12, 2)
  pricePerKg        Decimal  @default(0) @db.Decimal(10, 2)
  
  // Durum
  status            CostAnalysisStatus @default(DRAFT)
  
  // Onay bilgileri
  approvedById      String?
  approvedBy        User?    @relation("ApprovedCostAnalyses", fields: [approvedById], references: [id])
  approvedAt        DateTime?
  rejectionReason   String?
  
  // Audit
  createdById       String
  createdBy         User     @relation("CreatedCostAnalyses", fields: [createdById], references: [id])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Alt tablolar
  materials         CostMaterial[]
  laborItems        CostLabor[]
  externalServices  CostExternalService[]
  otherCosts        CostOtherItem[]
  versions          CostAnalysisVersion[]
}

enum CostAnalysisStatus {
  DRAFT
  PENDING_REVIEW
  APPROVED
  REJECTED
  ARCHIVED
}

enum Currency {
  TRY
  EUR
  USD
  GBP
}
```

### Malzeme: CostMaterial

```prisma
model CostMaterial {
  id              String   @id @default(cuid())
  costAnalysisId  String
  costAnalysis    CostAnalysis @relation(fields: [costAnalysisId], references: [id], onDelete: Cascade)
  
  // Malzeme bilgileri
  materialCode    String?
  name            String
  specification   String?
  category        MaterialCategory @default(RAW_MATERIAL)
  
  // Miktar ve fiyat
  unit            String   @default("kg")
  grossQuantity   Decimal  @db.Decimal(10, 3)
  wasteRate       Decimal  @default(0) @db.Decimal(5, 2)  // Fire %
  netQuantity     Decimal  @db.Decimal(10, 3)  // Hesaplanan
  unitPrice       Decimal  @db.Decimal(10, 2)
  totalPrice      Decimal  @db.Decimal(12, 2)  // Hesaplanan
  
  // Tedarikçi
  supplierId      String?
  supplier        CostSupplier? @relation(fields: [supplierId], references: [id])
  
  // Sıralama
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum MaterialCategory {
  RAW_MATERIAL      // Hammadde
  SEMI_FINISHED     // Yarı mamul
  PURCHASED_PART    // Satın alınan parça
  STANDARD_PART     // Standart parça (cıvata, somun)
  CONSUMABLE        // Sarf malzeme
}
```

### İşçilik: CostLabor

```prisma
model CostLabor {
  id              String   @id @default(cuid())
  costAnalysisId  String
  costAnalysis    CostAnalysis @relation(fields: [costAnalysisId], references: [id], onDelete: Cascade)
  
  // Operasyon bilgileri
  operationCode   String?
  operationName   String
  workCenter      String?
  laborType       LaborType @default(INTERNAL)
  
  // Süreler (saat)
  setupTime       Decimal  @default(0) @db.Decimal(6, 2)
  processTime     Decimal  @db.Decimal(6, 2)
  totalTime       Decimal  @db.Decimal(6, 2)  // Hesaplanan
  
  // Ücret
  hourlyRate      Decimal  @db.Decimal(8, 2)
  totalCost       Decimal  @db.Decimal(12, 2)  // Hesaplanan
  
  // Makine ilişkisi
  machineId       String?
  machine         CostMachine? @relation(fields: [machineId], references: [id])
  
  // Sıralama
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum LaborType {
  INTERNAL    // Dahili
  EXTERNAL    // Dış hizmet
  ASSEMBLY    // Montaj
}
```

### Dış Hizmet: CostExternalService

```prisma
model CostExternalService {
  id              String   @id @default(cuid())
  costAnalysisId  String
  costAnalysis    CostAnalysis @relation(fields: [costAnalysisId], references: [id], onDelete: Cascade)
  
  // Hizmet bilgileri
  serviceCode     String?
  serviceName     String
  description     String?
  serviceType     ServiceType @default(PROCESSING)
  
  // Miktar ve fiyat
  quantity        Decimal  @default(1) @db.Decimal(10, 2)
  unit            String   @default("adet")
  unitPrice       Decimal  @db.Decimal(12, 2)
  totalPrice      Decimal  @db.Decimal(12, 2)  // Hesaplanan
  
  // Tedarikçi
  supplierId      String?
  supplier        CostSupplier? @relation(fields: [supplierId], references: [id])
  
  // Sıralama
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum ServiceType {
  PROCESSING        // İşleme (ısıl işlem, vb.)
  SURFACE_TREATMENT // Yüzey işleme (boya, kaplama)
  TESTING           // Test (NDT, vb.)
  CERTIFICATION     // Sertifikasyon
  TRANSPORT         // Nakliye
  OTHER             // Diğer
}
```

### Diğer Maliyetler: CostOtherItem

```prisma
model CostOtherItem {
  id              String   @id @default(cuid())
  costAnalysisId  String
  costAnalysis    CostAnalysis @relation(fields: [costAnalysisId], references: [id], onDelete: Cascade)
  
  // Kalem bilgileri
  name            String
  description     String?
  category        OtherCostCategory
  
  // Miktar ve fiyat
  quantity        Decimal  @default(1) @db.Decimal(10, 2)
  unit            String   @default("adet")
  unitPrice       Decimal  @db.Decimal(12, 2)
  totalPrice      Decimal  @db.Decimal(12, 2)  // Hesaplanan
  
  // Sıralama
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum OtherCostCategory {
  ASSEMBLY_LABOR      // Montaj işçiliği
  CONNECTION_PARTS    // Bağlantı elemanları
  QUALITY_CONTROL     // Kalite kontrol
  TRANSPORT           // Nakliye
  PACKAGING           // Paketleme
  ENGINEERING         // Mühendislik
  TOOLING             // Takım/kalıp
  CERTIFICATION       // Sertifikasyon
  OTHER               // Diğer
}
```

### Ayar Tabloları

```prisma
model CostCategory {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  color       String   @default("#6366f1")  // Tailwind renk kodu
  description String?
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  analyses    CostAnalysis[]
}

model CostCustomer {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  country     String?
  contact     String?
  email       String?
  phone       String?
  isActive    Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  analyses    CostAnalysis[]
}

model CostSupplier {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  type        SupplierType @default(MATERIAL)
  country     String?
  contact     String?
  email       String?
  phone       String?
  isActive    Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  materials   CostMaterial[]
  services    CostExternalService[]
}

enum SupplierType {
  MATERIAL    // Malzeme tedarikçisi
  SERVICE     // Hizmet tedarikçisi
  BOTH        // Her ikisi
}

model CostMachine {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  type        String?              // CNC, Lazer, Kaynak, vb.
  hourlyRate  Decimal  @db.Decimal(8, 2)
  description String?
  isActive    Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  laborItems  CostLabor[]
}

model ExchangeRate {
  id          String   @id @default(cuid())
  fromCurrency Currency
  toCurrency   Currency
  rate        Decimal  @db.Decimal(10, 4)
  effectiveDate DateTime @default(now())
  
  createdAt   DateTime @default(now())
  
  @@unique([fromCurrency, toCurrency, effectiveDate])
}

model CostAnalysisVersion {
  id              String   @id @default(cuid())
  costAnalysisId  String
  costAnalysis    CostAnalysis @relation(fields: [costAnalysisId], references: [id], onDelete: Cascade)
  
  version         Int
  snapshot        Json     // Tüm verilerin JSON snapshot'ı
  reason          String?  // Değişiklik nedeni
  
  createdById     String
  createdAt       DateTime @default(now())
}
```

---

## 📁 Dosya Yapısı

```
src/
├── app/
│   └── (dashboard)/
│       └── cost-analysis/
│           ├── page.tsx                    # Ana liste
│           ├── new/
│           │   └── page.tsx                # Yeni analiz
│           ├── [id]/
│           │   ├── page.tsx                # Detay/Düzenleme
│           │   ├── materials/
│           │   │   └── page.tsx            # Malzemeler
│           │   ├── labor/
│           │   │   └── page.tsx            # İşçilik
│           │   ├── services/
│           │   │   └── page.tsx            # Dış hizmetler
│           │   ├── other/
│           │   │   └── page.tsx            # Diğer maliyetler
│           │   ├── summary/
│           │   │   └── page.tsx            # Maliyet özeti
│           │   └── versions/
│           │       └── page.tsx            # Versiyon geçmişi
│           ├── settings/
│           │   ├── page.tsx                # Ayarlar ana
│           │   ├── categories/
│           │   │   └── page.tsx
│           │   ├── customers/
│           │   │   └── page.tsx
│           │   ├── suppliers/
│           │   │   └── page.tsx
│           │   ├── machines/
│           │   │   └── page.tsx
│           │   └── exchange-rates/
│           │       └── page.tsx
│           ├── reports/
│           │   ├── page.tsx                # Raporlar
│           │   └── comparison/
│           │       └── page.tsx            # Karşılaştırma
│           └── import/
│               └── page.tsx                # Excel import
│
├── api/
│   └── cost-analysis/
│       ├── route.ts                        # GET (list), POST (create)
│       ├── [id]/
│       │   ├── route.ts                    # GET, PUT, DELETE
│       │   ├── duplicate/
│       │   │   └── route.ts                # POST
│       │   ├── approve/
│       │   │   └── route.ts                # POST
│       │   ├── reject/
│       │   │   └── route.ts                # POST
│       │   ├── recalculate/
│       │   │   └── route.ts                # POST
│       │   └── export/
│       │       ├── excel/
│       │       │   └── route.ts            # GET
│       │       └── pdf/
│       │           └── route.ts            # GET
│       ├── materials/
│       │   └── [analysisId]/
│       │       └── route.ts                # CRUD
│       ├── labor/
│       │   └── [analysisId]/
│       │       └── route.ts                # CRUD
│       ├── external-services/
│       │   └── [analysisId]/
│       │       └── route.ts                # CRUD
│       ├── other-costs/
│       │   └── [analysisId]/
│       │       └── route.ts                # CRUD
│       ├── categories/
│       │   └── route.ts                    # CRUD
│       ├── customers/
│       │   └── route.ts                    # CRUD
│       ├── suppliers/
│       │   └── route.ts                    # CRUD
│       ├── machines/
│       │   └── route.ts                    # CRUD
│       ├── exchange-rates/
│       │   └── route.ts                    # CRUD
│       └── import/
│           └── excel/
│               └── route.ts                # POST
│
└── components/
    └── cost-analysis/
        ├── CostAnalysisList.tsx
        ├── CostAnalysisForm.tsx
        ├── CostSummaryCards.tsx
        ├── CostGuideBox.tsx                # Kılavuz kutusu componenti
        │
        ├── materials/
        │   ├── MaterialTable.tsx
        │   ├── MaterialForm.tsx
        │   └── MaterialGuide.tsx
        │
        ├── labor/
        │   ├── LaborTable.tsx
        │   ├── LaborForm.tsx
        │   └── LaborGuide.tsx
        │
        ├── external-services/
        │   ├── ServiceTable.tsx
        │   └── ServiceForm.tsx
        │
        ├── other-costs/
        │   ├── OtherCostTable.tsx
        │   └── OtherCostForm.tsx
        │
        ├── summary/
        │   ├── CostBreakdown.tsx
        │   ├── PriceCalculator.tsx
        │   ├── CostChart.tsx
        │   └── SummaryGuide.tsx
        │
        ├── settings/
        │   ├── CategoryManager.tsx
        │   ├── CustomerManager.tsx
        │   ├── SupplierManager.tsx
        │   ├── MachineManager.tsx
        │   └── ExchangeRateManager.tsx
        │
        └── shared/
            ├── CostStatusBadge.tsx
            ├── CurrencyDisplay.tsx
            └── PercentageInput.tsx
```

---

## 🧮 Hesaplama Fonksiyonları

```typescript
// lib/cost-analysis/calculations.ts

export interface CostCalculationResult {
  materialCost: number;
  laborCost: number;
  externalCost: number;
  otherCost: number;
  subtotal: number;
  overheadAmount: number;
  totalCost: number;
  profitAmount: number;
  salesPrice: number;
  pricePerKg: number;
}

export function calculateCosts(
  materials: CostMaterial[],
  laborItems: CostLabor[],
  externalServices: CostExternalService[],
  otherCosts: CostOtherItem[],
  overheadRate: number,
  profitRate: number,
  finishedWeight: number
): CostCalculationResult {
  
  // 1. Malzeme toplamı
  const materialCost = materials.reduce((sum, m) => {
    const netQty = m.grossQuantity * (1 + (m.wasteRate / 100));
    return sum + (netQty * m.unitPrice);
  }, 0);
  
  // 2. İşçilik toplamı (sadece dahili)
  const laborCost = laborItems
    .filter(l => l.laborType === 'INTERNAL')
    .reduce((sum, l) => {
      const totalTime = l.setupTime + l.processTime;
      return sum + (totalTime * l.hourlyRate);
    }, 0);
  
  // 3. Dış hizmet toplamı
  const externalCost = externalServices.reduce((sum, s) => {
    return sum + (s.quantity * s.unitPrice);
  }, 0);
  
  // 4. Diğer maliyetler toplamı
  const otherCost = otherCosts.reduce((sum, o) => {
    return sum + (o.quantity * o.unitPrice);
  }, 0);
  
  // 5. Ara toplam
  const subtotal = materialCost + laborCost + externalCost + otherCost;
  
  // 6. İşletme gideri
  const overheadAmount = subtotal * (overheadRate / 100);
  
  // 7. Toplam maliyet
  const totalCost = subtotal + overheadAmount;
  
  // 8. Kar
  const profitAmount = totalCost * (profitRate / 100);
  
  // 9. Satış fiyatı
  const salesPrice = totalCost + profitAmount;
  
  // 10. kg başına fiyat
  const pricePerKg = finishedWeight > 0 ? salesPrice / finishedWeight : 0;
  
  return {
    materialCost,
    laborCost,
    externalCost,
    otherCost,
    subtotal,
    overheadAmount,
    totalCost,
    profitAmount,
    salesPrice,
    pricePerKg
  };
}

// Malzeme satırı hesaplama
export function calculateMaterialRow(
  grossQuantity: number,
  wasteRate: number,
  unitPrice: number
): { netQuantity: number; totalPrice: number } {
  const netQuantity = grossQuantity * (1 + (wasteRate / 100));
  const totalPrice = netQuantity * unitPrice;
  return { netQuantity, totalPrice };
}

// İşçilik satırı hesaplama
export function calculateLaborRow(
  setupTime: number,
  processTime: number,
  hourlyRate: number
): { totalTime: number; totalCost: number } {
  const totalTime = setupTime + processTime;
  const totalCost = totalTime * hourlyRate;
  return { totalTime, totalCost };
}
```

---

## 🎯 Kılavuz İçerikleri

### Ana Liste Kılavuzu (Modal)

```typescript
const mainGuideContent = {
  title: "Maliyet Kılavuzu - Should-Cost Analizi",
  description: "Should-Cost analizi ve maliyet hesaplama metodolojisi",
  sections: [
    {
      title: "Should-Cost Nedir?",
      color: "blue",
      content: "Should-Cost analizi, bir ürünün 'olması gereken' maliyetini belirlemek için kullanılan sistematik bir yaklaşımdır."
    },
    {
      title: "Temel Prensipler",
      color: "green",
      items: [
        "Malzeme maliyetlerini pazar fiyatlarıyla karşılaştır",
        "İşçilik sürelerini standartlarla doğrula",
        "Genel gider oranlarını sektör ortalamasıyla kıyasla",
        "Kar marjını makul seviyede tut"
      ]
    },
    {
      title: "7 Muda (İsraf Türleri)",
      color: "orange",
      items: ["Aşırı Üretim", "Bekleme", "Taşıma", "İşleme", "Stok", "Hareket", "Hata"]
    }
  ]
};
```

### Malzeme Sayfası Kılavuzu

```typescript
const materialGuideContent = {
  title: "Malzeme Yönetimi Kılavuzu",
  description: "Ürün maliyetinin temelini oluşturan hammadde ve yarı mamullerin takibi.",
  columns: [
    {
      title: "Malzeme Türleri",
      items: [
        { label: "Hammadde", desc: "İşlenmemiş malzeme (çelik, alüminyum)" },
        { label: "Yarı Mamul", desc: "Önceden işlenmiş parçalar" },
        { label: "Satın Alınan", desc: "Hazır parçalar" },
        { label: "Standart", desc: "Cıvata, somun, pul vb." }
      ]
    },
    {
      title: "Fire Oranı Hesaplama",
      items: [
        { label: "Lazer kesim", desc: "%5-10 fire" },
        { label: "CNC işleme", desc: "%8-15 fire" },
        { label: "Sac kesim", desc: "%10-20 fire" },
        { label: "Profil", desc: "%3-5 fire" }
      ]
    }
  ]
};
```

### İşçilik Sayfası Kılavuzu

```typescript
const laborGuideContent = {
  title: "İşçilik Yönetimi Kılavuzu",
  description: "Üretim operasyonlarının süre ve maliyet takibi.",
  columns: [
    {
      title: "İşçilik Türleri",
      items: [
        { label: "Dahili", desc: "Kendi tesisinde yapılan işler" },
        { label: "Dış Hizmet", desc: "Tedarikçide yapılan işler" },
        { label: "Montaj", desc: "Son montaj işçiliği" }
      ]
    },
    {
      title: "Süre Hesaplama",
      items: [
        { label: "Hazırlık", desc: "Setup, kalıp değişimi" },
        { label: "İşlem", desc: "Aktif üretim süresi" },
        { label: "Toplam", desc: "Hazırlık + İşlem" }
      ]
    }
  ]
};
```

### Maliyet Özeti Kılavuzu

```typescript
const summaryGuideContent = {
  title: "Maliyet Hesaplama Kılavuzu",
  description: "Should-Cost analizi ve fiyatlandırma metodolojisi.",
  columns: [
    {
      title: "Maliyet Bileşenleri",
      items: ["Direkt Malzeme", "Direkt İşçilik", "Dış Hizmetler", "Genel Giderler"]
    },
    {
      title: "İşletme Gideri",
      items: [
        { label: "Standart oran", desc: "%20-30" },
        { label: "İçerik", desc: "Kira, enerji, sigorta, yönetim, amortisman" }
      ]
    },
    {
      title: "Kar Marjı",
      items: [
        { label: "Savunma sanayi", desc: "%15-25" },
        { label: "Özel projeler", desc: "%20-40" }
      ]
    }
  ]
};
```

---

## 🔐 Yetkilendirme

```typescript
// lib/cost-analysis/permissions.ts

export const costAnalysisPermissions = {
  'cost-analysis:view': [
    'USER',
    'QUALITY_MANAGER', 
    'ADMIN', 
    'SUPER_ADMIN'
  ],
  'cost-analysis:create': [
    'QUALITY_MANAGER',
    'ADMIN',
    'SUPER_ADMIN'
  ],
  'cost-analysis:edit': [
    'QUALITY_MANAGER',
    'ADMIN',
    'SUPER_ADMIN'
  ],
  'cost-analysis:delete': [
    'ADMIN',
    'SUPER_ADMIN'
  ],
  'cost-analysis:approve': [
    'ADMIN',
    'SUPER_ADMIN'
  ],
  'cost-analysis:settings': [
    'ADMIN',
    'SUPER_ADMIN'
  ],
  'cost-analysis:export': [
    'QUALITY_MANAGER',
    'ADMIN',
    'SUPER_ADMIN'
  ],
};
```

---

## 📊 Sidebar Menü Eklentisi

```typescript
// Mevcut sidebar navigation'a ekle
{
  name: "Maliyet Analizi",
  href: "/cost-analysis",
  icon: Calculator, // lucide-react
  children: [
    { name: "Tüm Analizler", href: "/cost-analysis" },
    { name: "Yeni Analiz", href: "/cost-analysis/new" },
    { name: "Raporlar", href: "/cost-analysis/reports" },
    { name: "Ayarlar", href: "/cost-analysis/settings" },
  ]
}
```

---

## 🚀 Uygulama Sırası

### Faz 1: Temel Yapı (3-4 gün)

```
1. Prisma schema ekle (tüm modeller)
2. npx prisma migrate dev --name add_cost_analysis
3. Temel API endpoints (CRUD)
   - /api/cost-analysis (list, create)
   - /api/cost-analysis/[id] (get, update, delete)
4. Ana liste sayfası (/cost-analysis/page.tsx)
5. Yeni analiz formu (/cost-analysis/new/page.tsx)
```

### Faz 2: Detay Sayfaları (3-4 gün)

```
1. Malzeme yönetimi
   - API: /api/cost-analysis/materials/[analysisId]
   - Sayfa: /cost-analysis/[id]/materials
   - Components: MaterialTable, MaterialForm, MaterialGuide
   
2. İşçilik yönetimi
   - API: /api/cost-analysis/labor/[analysisId]
   - Sayfa: /cost-analysis/[id]/labor
   - Components: LaborTable, LaborForm, LaborGuide
   
3. Dış hizmet yönetimi
   - API: /api/cost-analysis/external-services/[analysisId]
   - Sayfa: /cost-analysis/[id]/services
   
4. Diğer maliyetler
   - API: /api/cost-analysis/other-costs/[analysisId]
   - Sayfa: /cost-analysis/[id]/other
```

### Faz 3: Hesaplama ve Özet (2-3 gün)

```
1. Hesaplama fonksiyonları (lib/cost-analysis/calculations.ts)
2. Özet sayfası (/cost-analysis/[id]/summary)
3. Maliyet dağılım grafiği
4. Fiyat hesaplama widget'ı
```

### Faz 4: Ayarlar (2 gün)

```
1. Kategori yönetimi
2. Müşteri yönetimi
3. Tedarikçi yönetimi
4. Makine yönetimi
5. Döviz kurları
```

### Faz 5: İyileştirmeler (2-3 gün)

```
1. Excel import/export
2. PDF export
3. Versiyon geçmişi
4. Karşılaştırma raporu
5. Test ve bug fix
```

---

## 📝 VS Code Claude Talimatları

Projeyi açtıktan sonra şu mesajı gönder:

```
Bu projede yeni bir modül geliştireceğiz: Maliyet Analizi

docs/MALIYET_ANALIZI_TASARIM.md dosyasını oku ve bu tasarıma göre implementasyona başla.

Sıralama:
1. Prisma schema'ya tüm modelleri ekle
2. Migration çalıştır
3. API endpoints oluştur
4. Sayfa ve component'leri oluştur

Önemli kurallar:
- Mevcut proje pattern'lerini takip et
- Pastel renkler kullan (tasarımdaki gibi)
- Her sayfaya kılavuz kutusu ekle
- Türkçe UI, İngilizce kod
- shadcn/ui ve Tailwind kullan

Faz 1 ile başla: Prisma schema + temel API + ana liste sayfası
```

---

## ✅ Checklist

### Başlamadan Önce
- [ ] Bu dokümanı projeye kopyala: `docs/MALIYET_ANALIZI_TASARIM.md`
- [ ] HTML önizlemeyi referans olarak sakla

### Faz 1
- [ ] Prisma schema eklendi
- [ ] Migration başarılı
- [ ] Ana liste API çalışıyor
- [ ] Ana liste sayfası görüntüleniyor
- [ ] Yeni analiz oluşturulabiliyor

### Faz 2
- [ ] Malzeme CRUD çalışıyor
- [ ] İşçilik CRUD çalışıyor
- [ ] Dış hizmet CRUD çalışıyor
- [ ] Diğer maliyetler CRUD çalışıyor
- [ ] Kılavuz kutuları eklendi

### Faz 3
- [ ] Hesaplamalar doğru çalışıyor
- [ ] Özet sayfası tamamlandı
- [ ] Grafikler eklendi

### Faz 4
- [ ] Tüm ayar sayfaları tamamlandı

### Faz 5
- [ ] Excel import/export çalışıyor
- [ ] PDF export çalışıyor
- [ ] Testler geçiyor

---

*Bu doküman İleriHub - Maliyet Analizi Modülü için hazırlanmıştır.*
*Versiyon: 2.0*
*Tarih: Şubat 2026*
