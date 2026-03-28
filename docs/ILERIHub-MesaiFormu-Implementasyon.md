# 🕐 ILERIHub - Mesai Formu Modülü Implementasyon Rehberi

## Modül Özeti

| Bilgi | Değer |
|-------|-------|
| Modül Adı | Mesai Formu (Fazla Mesai Talep Sistemi) |
| Sidebar Konumu | Formlar → Mesai Formu |
| Route | `/forms/overtime` |
| API | `/api/overtime` |
| Erişim | Tüm roller (oluşturma), Onay zinciri (onaylama) |

---

## 1. Prisma Schema

`prisma/schema.prisma` dosyasına eklenecek:

```prisma
// ==================== OVERTIME (MESAİ FORMU) ====================

model OvertimeForm {
  id              String   @id @default(cuid())
  formNo          String   @unique  // OT-2026-001
  
  // Mesai bilgileri
  overtimeType    OvertimeType
  date            DateTime @db.Date
  isFullDay       Boolean  @default(true)
  startTime       String?  // "17:00" (saat aralığı için)
  endTime         String?  // "20:30"
  description     String?  // Genel açıklama
  
  // Oluşturan
  createdById     String
  createdBy       User     @relation("OvertimeCreator", fields: [createdById], references: [id])
  
  // Durum
  status          OvertimeStatus @default(DRAFT)
  currentStep     Int      @default(0) // Hangi onay adımında
  sendToGM        Boolean  @default(false) // Genel Müdür'e gönderilsin mi
  
  // Zaman damgaları
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // İlişkiler
  personnel       OvertimePersonnel[]
  approvals       OvertimeApproval[]
}

enum OvertimeType {
  SATURDAY      // Cumartesi Mesaisi
  SUNDAY        // Pazar Mesaisi
  WEEKDAY_EXTRA // Hafta İçi Fazla Mesai
  HOLIDAY       // Resmi Tatil Mesaisi
}

enum OvertimeStatus {
  DRAFT         // Taslak
  PENDING       // Onay bekliyor
  IN_PROGRESS   // Onay sürecinde
  APPROVED      // Onaylandı
  REJECTED      // Reddedildi
  CANCELLED     // İptal edildi
}

model OvertimePersonnel {
  id                  String   @id @default(cuid())
  overtimeFormId      String
  overtimeForm        OvertimeForm @relation(fields: [overtimeFormId], references: [id], onDelete: Cascade)
  
  // Personel bilgileri
  userId              String
  user                User     @relation("OvertimePersonnel", fields: [userId], references: [id])
  
  // Mesai detayları
  workDepartment      String   // Mesai yapacak bölüm (kendi bölümünden farklı olabilir)
  serviceRoute        String?  // Servis güzergahı (mavi yaka için)
  targetProduction    String?  // Hedef üretim
  actualProduction    String?  // Gerçekleşen üretim
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  @@unique([overtimeFormId, userId])
}

model OvertimeApproval {
  id              String   @id @default(cuid())
  overtimeFormId  String
  overtimeForm    OvertimeForm @relation(fields: [overtimeFormId], references: [id], onDelete: Cascade)
  
  // Onay bilgileri
  step            Int      // Sıra numarası (1-7)
  role            String   // Onaylayan ünvan
  approverId      String?
  approver        User?    @relation("OvertimeApprover", fields: [approverId], references: [id])
  
  // Karar
  decision        ApprovalDecision @default(PENDING)
  comment         String?
  decidedAt       DateTime?
  
  // GM'e gönder seçeneği (sadece Genel Müdür Yardımcısı için)
  forwardToGM     Boolean  @default(false)
  
  createdAt       DateTime @default(now())
}

enum ApprovalDecision {
  PENDING
  APPROVED
  REJECTED
}
```

**User modeline eklenecek relation'lar:**

```prisma
// User modeline ekle:
  overtimeFormsCreated  OvertimeForm[]      @relation("OvertimeCreator")
  overtimePersonnel     OvertimePersonnel[] @relation("OvertimePersonnel")
  overtimeApprovals     OvertimeApproval[]  @relation("OvertimeApprover")
```

Migration komutu:
```bash
npx prisma migrate dev --name add_overtime_module
```

---

## 2. Onay Zinciri

Sabit onay sırası (7 adım, 8. opsiyonel):

```typescript
// src/lib/overtime-approval-chain.ts

export const APPROVAL_CHAIN = [
  { step: 1, role: "Üretim Müdür Yardımcısı", position: "PRODUCTION_DEPUTY" },
  { step: 2, role: "Fabrika Müdürü", position: "FACTORY_MANAGER" },
  { step: 3, role: "T. Planlama Müdürü", position: "PLANNING_MANAGER" },
  { step: 4, role: "Kalite Müdürü", position: "QUALITY_MANAGER" },
  { step: 5, role: "İ.V. Müdürü", position: "HR_MANAGER" },
  { step: 6, role: "Genel Müdür Yardımcısı", position: "DEPUTY_GM" },
  { step: 7, role: "Genel Müdür", position: "GM", optional: true },
]

// Onay akışı: Her onaylayan onayladığında currentStep +1 artar.
// Eğer sendToGM false ise step 6'dan sonra form APPROVED olur.
// Eğer sendToGM true ise (GMY tarafından ayarlanır) step 7'ye gider.
// Herhangi birisi reddederse form REJECTED olur.
```

---

## 3. API Endpoints

### `src/app/api/overtime/route.ts`

```
GET  /api/overtime          → Formları listele (filtreleme: status, tarih, tür)
POST /api/overtime          → Yeni form oluştur veya taslak kaydet
```

### `src/app/api/overtime/[id]/route.ts`

```
GET    /api/overtime/[id]          → Form detayı (personeller + onay geçmişi dahil)
PUT    /api/overtime/[id]          → Formu güncelle (taslak iken)
DELETE /api/overtime/[id]          → Formu sil (taslak iken)
```

### `src/app/api/overtime/[id]/submit/route.ts`

```
POST /api/overtime/[id]/submit    → Formu onaya gönder (DRAFT → PENDING)
```

### `src/app/api/overtime/[id]/approve/route.ts`

```
POST /api/overtime/[id]/approve   → Onayla veya reddet
Body: { decision: "APPROVED" | "REJECTED", comment?: string, forwardToGM?: boolean }
```

### `src/app/api/overtime/[id]/personnel/route.ts`

```
PUT /api/overtime/[id]/personnel  → Gerçekleşen üretim güncelle (mesai sonrası)
```

### `src/app/api/overtime/form-no/route.ts`

```
GET /api/overtime/form-no         → Sonraki form numarasını al (OT-2026-XXX)
```

---

## 4. Sayfa Yapısı

```
src/app/(dashboard)/forms/overtime/
├── page.tsx                    # Liste sayfası (tüm formlar)
├── new/
│   └── page.tsx                # Yeni form oluşturma (3 adımlı wizard)
├── [id]/
│   └── page.tsx                # Form detay / önizleme / onay sayfası
└── [id]/edit/
    └── page.tsx                # Taslak düzenleme
```

---

## 5. Sayfa Detayları

### 5.1 Liste Sayfası (`page.tsx`)

- Üst: "Mesai Formları" başlık + "Yeni Form" butonu
- Kaizen kutusu: Mesai formu sürecini açıklayan bilgi kutusu
- Filtreler: Durum (tümü/taslak/beklemede/onaylı/red), Mesai türü, Tarih aralığı
- Tablo sütunları: Form No, Mesai Türü, Tarih, Personel Sayısı, Durum (badge), Onay Adımı, İşlemler
- Durum badge renkleri:
  - DRAFT: `bg-gray-100 text-gray-700`
  - PENDING: `bg-yellow-100 text-yellow-700`
  - IN_PROGRESS: `bg-blue-100 text-blue-700`
  - APPROVED: `bg-green-100 text-green-700`
  - REJECTED: `bg-red-100 text-red-700`

### 5.2 Yeni Form (`new/page.tsx`)

**3 adımlı wizard** (prototipteki gibi):

**Adım 1 - Mesai Bilgileri:**
- Mesai türü seçimi (4 kart: Cumartesi, Pazar, Hafta İçi, Resmi Tatil)
- Tarih seçici
- Tam gün / Saat aralığı toggle
- Hafta İçi Fazla Mesai seçilince otomatik: saat aralığı modu, 17:00 - 20:30
- Açıklama (opsiyonel textarea)

**Adım 2 - Personel Seçimi:**
- Sol panel: Personel listesi (API'den /api/users ile çek)
  - Filtreler: Mavi yaka / Beyaz yaka / Hepsi, Bölüm dropdown, İsim/sicil arama
  - NOT: Mavi yaka = collarType === "BLUE" (User modelinde varsa) veya belirli departmanlar
- Sağ panel: Seçili personel detayları
  - Her personel için: Mesai Yapacak Bölüm (select), Servis Güzergahı (mavi yaka için select), Hedef Üretim (text), Gerçekleşen Üretim (number)

**Adım 3 - Önizleme:**
- Form bilgi özeti (tür, tarih, saat)
- Personel tablosu (Excel formuna benzer görünüm)
- Onay zinciri gösterimi (ok işaretleri ile sıralı)
- "Genel Müdür onayına da gönder" checkbox
- "Taslak Kaydet" + "Onaya Gönder" butonları

### 5.3 Detay Sayfası (`[id]/page.tsx`)

- Form bilgileri (readonly)
- Personel tablosu
- Onay geçmişi timeline (her adım: onaylayan, tarih, karar, yorum)
- Eğer kullanıcı sıradaki onaylayan ise: Onayla/Reddet butonları + yorum alanı
- Eğer kullanıcı GMY ise: "Genel Müdür'e gönder" checkbox
- Gerçekleşen üretim güncelleme (form onaylandıktan sonra)

---

## 6. Sidebar Entegrasyonu

`src/components/layout/Sidebar.tsx` - `formsMenuItems` array'ine ekle:

```typescript
const formsMenuItems = [
  { name: "Ziyaret Raporları", icon: FileText, href: "/forms/visit-reports", roles: ["*"] },
  { name: "Toplantı Raporu", icon: Calendar, href: "/meetings", roles: ["*"] },
  { name: "Mesai Formu", icon: Clock, href: "/forms/overtime", roles: ["*"] },
  // { name: "Proje Bar", icon: BarChart3, href: "/forms/project-bar", roles: ["*"] }, // Şimdilik gizli
]
```

`Clock` icon zaten import edilmiş durumda.

---

## 7. Bölüm ve Servis Güzergahı Verileri

Sistem ayarlarından veya sabit olarak:

```typescript
// src/lib/overtime-constants.ts

export const BOLUMLER = [
  "KAYNAKHANE", "LAZER", "CNC", "PAKET", "MONTAJ", "TALAŞLI İMALAT",
  "BOYA", "KALİTE KONTROL", "DEPO", "BAKIM", "ÜRETİM PLANLAMA",
  "DİREKSİYON & PAKETLEME", "LAZER & DAİRE TESTERE"
]

export const SERVIS_GUZERGAHLARI = [
  "BELEDİYE", "BATTI ÇIKTI", "ADEM YAVUZ KAPALI PAZAR (TRAFO)",
  "GEBZE", "DARICA", "DİLOVASI"
]

export const MESAI_TURLERI = [
  { value: "SATURDAY", label: "Cumartesi Mesaisi" },
  { value: "SUNDAY", label: "Pazar Mesaisi" },
  { value: "WEEKDAY_EXTRA", label: "Hafta İçi Fazla Mesai" },
  { value: "HOLIDAY", label: "Resmi Tatil Mesaisi" },
]
```

---

## 8. Bildirim Entegrasyonu

Form onaya gönderildiğinde ve her onay adımında bildirim oluştur:

```typescript
// Onaya gönderildiğinde → İlk onaylayıcıya bildirim
await prisma.notification.create({
  data: {
    userId: ilkOnaylayanId,
    title: "Yeni Mesai Formu Onayı",
    message: `${formNo} numaralı mesai formu onayınızı bekliyor.`,
    type: "REMINDER",
    link: `/forms/overtime/${formId}`,
  }
})

// Her onay sonrası → Bir sonraki onaylayıcıya bildirim
// Red durumunda → Form oluşturana bildirim
// Tüm onaylar tamamlandığında → Form oluşturana "Onaylandı" bildirimi
```

---

## 9. Form Numarası Üretimi

```typescript
// OT-2026-001 formatında
async function generateFormNo(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `OT-${year}-`
  
  const lastForm = await prisma.overtimeForm.findFirst({
    where: { formNo: { startsWith: prefix } },
    orderBy: { formNo: 'desc' }
  })
  
  let nextNumber = 1
  if (lastForm) {
    const lastNumber = parseInt(lastForm.formNo.split('-').pop() || '0')
    nextNumber = lastNumber + 1
  }
  
  return `${prefix}${nextNumber.toString().padStart(3, '0')}`
}
```

---

## 10. Tasarım Notları

- **Pastel renk paleti** kullan (prototipteki gibi teal-based)
- **Kaizen bilgi kutusu** her sayfanın üstünde
- Mesai türü kartları renkli: Cumartesi=mavi, Pazar=mor, Hafta İçi=amber, Tatil=kırmızı (pastel)
- Onay akışı ok işaretleri ile yatay gösterim
- Responsive: Mobilde tek kolon, masaüstünde yan yana paneller
- Durum badge'leri tutarlı pastel renkler

---

## 11. İlk Aşamada Kapsam Dışı (Raporlama için sonra)

- ❌ Aylık/haftalık mesai özet raporları
- ❌ Departman bazlı mesai karşılaştırma
- ❌ Hedef vs Gerçekleşen üretim analizi
- ❌ Mesai maliyet hesaplama
- ❌ Excel export
- ❌ PDF çıktı (Excel formuna benzer)

Bu özellikler 2. aşamada raporlama modülü olarak eklenecek.

---

*Bu doküman ILERIHub Mesai Formu modülü implementasyonu için hazırlanmıştır.*
