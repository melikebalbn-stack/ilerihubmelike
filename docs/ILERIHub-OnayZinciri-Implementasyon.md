# 🔗 ILERIHub - Mesai Formu Onay Zinciri & Test Modu

## Sorun

Mesai formu "Onaya Gönder" denildiğinde `Cannot read properties of undefined (reading 'id')` hatası alınıyor. Sebep: Onay zincirindeki pozisyonlar (Fabrika Müdürü, Kalite Müdürü vb.) gerçek kullanıcılara eşlenmemiş.

## Çözüm: 2 Parça

1. **ApprovalPosition tablosu** — Ayarlar sayfasında pozisyon-kullanıcı eşleştirmesi
2. **Test Modu** — SUPER_ADMIN için tek butonla tüm onayları geç

---

## 1. Prisma Schema — Yeni Tablo

`prisma/schema.prisma` dosyasına ekle:

```prisma
// ==================== ONAY POZİSYONLARI ====================

model ApprovalPosition {
  id          String   @id @default(cuid())
  code        String   @unique  // PRODUCTION_DEPUTY, FACTORY_MANAGER, vb.
  title       String             // Üretim Müdür Yardımcısı, Fabrika Müdürü, vb.
  userId      String?            // Atanmış kullanıcı (null = henüz atanmamış)
  user        User?    @relation("ApprovalPositionUser", fields: [userId], references: [id])
  sortOrder   Int      @default(0) // Sıralama
  isActive    Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**User modeline ekle:**

```prisma
// User modeline ekle:
  approvalPositions   ApprovalPosition[] @relation("ApprovalPositionUser")
```

**Migration:**

```bash
npx prisma migrate dev --name add_approval_positions
```

---

## 2. Seed Data — İlk Pozisyonları Oluştur

`prisma/seed.ts` dosyasına ekle (veya mevcut seed'e ekle):

```typescript
// Onay pozisyonlarını oluştur
const approvalPositions = [
  { code: "PRODUCTION_DEPUTY", title: "Üretim Müdür Yardımcısı", sortOrder: 1 },
  { code: "FACTORY_MANAGER",   title: "Fabrika Müdürü",          sortOrder: 2 },
  { code: "PLANNING_MANAGER",  title: "T. Planlama Müdürü",      sortOrder: 3 },
  { code: "QUALITY_MANAGER",   title: "Kalite Müdürü",           sortOrder: 4 },
  { code: "HR_MANAGER",        title: "İ.V. Müdürü",             sortOrder: 5 },
  { code: "DEPUTY_GM",         title: "Genel Müdür Yardımcısı",  sortOrder: 6 },
  { code: "GM",                title: "Genel Müdür",             sortOrder: 7 },
]

for (const pos of approvalPositions) {
  await prisma.approvalPosition.upsert({
    where: { code: pos.code },
    update: { title: pos.title, sortOrder: pos.sortOrder },
    create: pos,
  })
}

console.log("✅ Onay pozisyonları oluşturuldu")
```

**Çalıştır:**

```bash
npx prisma db seed
```

---

## 3. API — Onay Pozisyonları CRUD

### `src/app/api/approval-positions/route.ts`

```typescript
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET — Tüm pozisyonları listele
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const positions = await prisma.approvalPosition.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true }
      }
    }
  })

  return NextResponse.json(positions)
}

// PUT — Pozisyona kullanıcı ata (toplu güncelleme)
export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Sadece SUPER_ADMIN ve ADMIN
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  })
  if (!currentUser || !["SUPER_ADMIN", "ADMIN"].includes(currentUser.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 })
  }

  const body = await request.json()
  // body: [{ code: "FACTORY_MANAGER", userId: "clxyz..." }, ...]

  const updates = await Promise.all(
    body.map((item: { code: string; userId: string | null }) =>
      prisma.approvalPosition.update({
        where: { code: item.code },
        data: { userId: item.userId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } }
        }
      })
    )
  )

  return NextResponse.json(updates)
}
```

---

## 4. Submit API Güncelleme

`src/app/api/overtime/[id]/submit/route.ts` dosyasını güncelle:

```typescript
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const form = await prisma.overtimeForm.findUnique({
    where: { id: params.id },
    include: { personnel: true }
  })

  if (!form) {
    return NextResponse.json({ error: "Form bulunamadı" }, { status: 404 })
  }

  if (form.status !== "DRAFT") {
    return NextResponse.json({ error: "Sadece taslak formlar onaya gönderilebilir" }, { status: 400 })
  }

  if (form.personnel.length === 0) {
    return NextResponse.json({ error: "En az 1 personel eklenmeli" }, { status: 400 })
  }

  // ✅ Onay pozisyonlarını veritabanından çek
  const positions = await prisma.approvalPosition.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { user: true }
  })

  // GM hariç ilk 6 pozisyon zorunlu
  const requiredPositions = positions.filter(p => p.code !== "GM")
  const unassigned = requiredPositions.filter(p => !p.userId)

  if (unassigned.length > 0) {
    const names = unassigned.map(p => p.title).join(", ")
    return NextResponse.json({ 
      error: `Şu pozisyonlara kullanıcı atanmamış: ${names}. Ayarlar > Onay Pozisyonları sayfasından atama yapın.` 
    }, { status: 400 })
  }

  // Son adım sayısını belirle (GM dahil mi?)
  const maxStep = form.sendToGM ? 7 : 6

  // Onay kayıtlarını oluştur
  const approvalData = positions
    .filter(p => p.sortOrder <= maxStep)
    .map(p => ({
      overtimeFormId: form.id,
      step: p.sortOrder,
      role: p.title,
      approverId: p.userId, // ✅ Artık null olmayacak
      decision: "PENDING" as const,
    }))

  // Transaction ile güncelle
  await prisma.$transaction([
    // Mevcut onayları sil (tekrar gönderilmişse)
    prisma.overtimeApproval.deleteMany({
      where: { overtimeFormId: form.id }
    }),
    // Yeni onay kayıtlarını oluştur
    prisma.overtimeApproval.createMany({
      data: approvalData
    }),
    // Form durumunu güncelle
    prisma.overtimeForm.update({
      where: { id: form.id },
      data: {
        status: "PENDING",
        currentStep: 1,
      }
    }),
  ])

  // İlk onaylayıcıya bildirim gönder
  const firstApprover = positions.find(p => p.sortOrder === 1)
  if (firstApprover?.userId) {
    await prisma.notification.create({
      data: {
        userId: firstApprover.userId,
        title: "Yeni Mesai Formu Onayı",
        message: `${form.formNo} numaralı mesai formu onayınızı bekliyor.`,
        type: "REMINDER",
        link: `/forms/overtime/${form.id}`,
      }
    })
  }

  return NextResponse.json({ success: true, message: "Form onaya gönderildi" })
}
```

---

## 5. Approve API Güncelleme

`src/app/api/overtime/[id]/approve/route.ts`:

```typescript
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { decision, comment, forwardToGM } = body
  // decision: "APPROVED" | "REJECTED"

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    return NextResponse.json({ error: "Geçersiz karar" }, { status: 400 })
  }

  const form = await prisma.overtimeForm.findUnique({
    where: { id: params.id },
    include: { approvals: { orderBy: { step: "asc" } } }
  })

  if (!form) {
    return NextResponse.json({ error: "Form bulunamadı" }, { status: 404 })
  }

  if (!["PENDING", "IN_PROGRESS"].includes(form.status)) {
    return NextResponse.json({ error: "Bu form onaylanamaz" }, { status: 400 })
  }

  // Sıradaki onay kaydını bul
  const currentApproval = form.approvals.find(
    a => a.step === form.currentStep && a.decision === "PENDING"
  )

  if (!currentApproval) {
    return NextResponse.json({ error: "Onay adımı bulunamadı" }, { status: 400 })
  }

  // ✅ Yetkili mi kontrol et (atanmış kişi mi?)
  if (currentApproval.approverId !== session.user.id) {
    return NextResponse.json({ 
      error: "Bu adımı onaylama yetkiniz yok" 
    }, { status: 403 })
  }

  // Kararı kaydet
  await prisma.overtimeApproval.update({
    where: { id: currentApproval.id },
    data: {
      decision,
      comment: comment || null,
      decidedAt: new Date(),
      forwardToGM: forwardToGM || false,
    }
  })

  if (decision === "REJECTED") {
    // ❌ Reddedildi — form reddedildi olarak işaretle
    await prisma.overtimeForm.update({
      where: { id: form.id },
      data: { status: "REJECTED" }
    })

    // Form oluşturana bildirim
    await prisma.notification.create({
      data: {
        userId: form.createdById,
        title: "Mesai Formu Reddedildi",
        message: `${form.formNo} numaralı mesai formu ${currentApproval.role} tarafından reddedildi.`,
        type: "ERROR",
        link: `/forms/overtime/${form.id}`,
      }
    })

    return NextResponse.json({ success: true, message: "Form reddedildi" })
  }

  // ✅ Onaylandı — sonraki adıma geç
  const maxStep = (forwardToGM || form.sendToGM) ? 7 : 6
  const nextStep = form.currentStep + 1

  if (nextStep > maxStep) {
    // Tüm onaylar tamam!
    await prisma.overtimeForm.update({
      where: { id: form.id },
      data: { 
        status: "APPROVED", 
        currentStep: nextStep,
        sendToGM: forwardToGM ? true : form.sendToGM,
      }
    })

    // Form oluşturana bildirim
    await prisma.notification.create({
      data: {
        userId: form.createdById,
        title: "Mesai Formu Onaylandı ✅",
        message: `${form.formNo} numaralı mesai formu tüm onaylardan geçti.`,
        type: "SUCCESS",
        link: `/forms/overtime/${form.id}`,
      }
    })
  } else {
    // Sonraki adıma geç
    // GM'e forward edildiyse ve henüz GM onayı yoksa, oluştur
    if (forwardToGM && !form.approvals.find(a => a.step === 7)) {
      const gmPosition = await prisma.approvalPosition.findUnique({
        where: { code: "GM" }
      })
      if (gmPosition?.userId) {
        await prisma.overtimeApproval.create({
          data: {
            overtimeFormId: form.id,
            step: 7,
            role: gmPosition.title,
            approverId: gmPosition.userId,
            decision: "PENDING",
          }
        })
      }
    }

    await prisma.overtimeForm.update({
      where: { id: form.id },
      data: { 
        status: "IN_PROGRESS", 
        currentStep: nextStep,
        sendToGM: forwardToGM ? true : form.sendToGM,
      }
    })

    // Sonraki onaylayıcıya bildirim
    const nextApproval = form.approvals.find(a => a.step === nextStep)
    if (nextApproval?.approverId) {
      await prisma.notification.create({
        data: {
          userId: nextApproval.approverId,
          title: "Mesai Formu Onayı Bekliyor",
          message: `${form.formNo} numaralı mesai formu onayınızı bekliyor.`,
          type: "REMINDER",
          link: `/forms/overtime/${form.id}`,
        }
      })
    }
  }

  return NextResponse.json({ success: true, message: "Onay kaydedildi" })
}
```

---

## 6. Test Modu API

Sadece `SUPER_ADMIN` kullanabilir. Tek istekle tüm adımları onaylar.

### `src/app/api/overtime/[id]/test-approve-all/route.ts`

```typescript
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ⚠️ Sadece SUPER_ADMIN
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  })
  if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Sadece Super Admin kullanabilir" }, { status: 403 })
  }

  // Sadece development veya test ortamında çalışsın
  // (Production'da da SUPER_ADMIN olarak çalışır, risk düşük)

  const form = await prisma.overtimeForm.findUnique({
    where: { id: params.id },
    include: { approvals: { orderBy: { step: "asc" } } }
  })

  if (!form) {
    return NextResponse.json({ error: "Form bulunamadı" }, { status: 404 })
  }

  if (!["PENDING", "IN_PROGRESS"].includes(form.status)) {
    return NextResponse.json({ error: "Bu form onaylanamaz" }, { status: 400 })
  }

  // Tüm bekleyen onayları onayla
  const now = new Date()
  await prisma.$transaction([
    prisma.overtimeApproval.updateMany({
      where: {
        overtimeFormId: form.id,
        decision: "PENDING",
      },
      data: {
        decision: "APPROVED",
        decidedAt: now,
        comment: "🧪 Test modu ile otomatik onaylandı",
      }
    }),
    prisma.overtimeForm.update({
      where: { id: form.id },
      data: {
        status: "APPROVED",
        currentStep: form.sendToGM ? 8 : 7,
      }
    }),
  ])

  return NextResponse.json({ 
    success: true, 
    message: "🧪 Tüm onaylar test modunda geçildi" 
  })
}
```

---

## 7. Ayarlar Sayfası — Onay Pozisyonları

### Konum: `src/app/(dashboard)/settings/approval-positions/page.tsx`

**Sayfa tasarımı:**

```
┌─────────────────────────────────────────────────────────┐
│ ⚙️ Ayarlar > Onay Pozisyonları                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ℹ️ Kaizen Kutusu:                                       │
│ Mesai formu onay sürecinde her pozisyona bir kullanıcı  │
│ atanmalıdır. Atanmamış pozisyon varsa form onaya        │
│ gönderilemez. Genel Müdür opsiyoneldir.                 │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ # │ Pozisyon           │ Atanmış Kişi    │ İşlem  │ │
│ │───│────────────────────│─────────────────│────────│ │
│ │ 1 │ Üretim Müd. Yrd.  │ [Kullanıcı Seç ▾]│ ✓     │ │
│ │ 2 │ Fabrika Müdürü     │ [Kullanıcı Seç ▾]│ ✓     │ │
│ │ 3 │ T. Planlama Müd.   │ [Kullanıcı Seç ▾]│ ✓     │ │
│ │ 4 │ Kalite Müdürü      │ [Kullanıcı Seç ▾]│ ✓     │ │
│ │ 5 │ İ.V. Müdürü        │ [Kullanıcı Seç ▾]│ ✓     │ │
│ │ 6 │ Genel Müd. Yrd.    │ [Kullanıcı Seç ▾]│ ✓     │ │
│ │ 7 │ Genel Müdür (ops.) │ [Kullanıcı Seç ▾]│ ✓     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Atanmamış: 7 pozisyon  ⚠️                               │
│                                                         │
│                            [ 💾 Kaydet ]                │
└─────────────────────────────────────────────────────────┘
```

**Özellikler:**
- Her satırda kullanıcı seçici (Combobox/Select — tüm kullanıcıları listele)
- Arama yapılabilir (isim veya e-posta ile)
- Kaydet butonu — toplu güncelleme (PUT /api/approval-positions)
- GM satırında "(opsiyonel)" notu
- Atanmamış pozisyonlar sarı uyarı ile gösterilir
- Sadece SUPER_ADMIN ve ADMIN erişebilir

---

## 8. Detay Sayfasına Test Modu Butonu

`src/app/(dashboard)/forms/overtime/[id]/page.tsx` içinde:

Eğer kullanıcı SUPER_ADMIN ise ve form durumu PENDING veya IN_PROGRESS ise, sayfanın altında göster:

```tsx
{currentUser.role === "SUPER_ADMIN" && 
 ["PENDING", "IN_PROGRESS"].includes(form.status) && (
  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-amber-800">🧪 Test Modu</p>
        <p className="text-xs text-amber-600">
          Tüm onay adımlarını otomatik olarak geçer. Sadece test amaçlıdır.
        </p>
      </div>
      <Button 
        variant="outline" 
        className="border-amber-300 text-amber-700 hover:bg-amber-100"
        onClick={handleTestApproveAll}
      >
        Tümünü Onayla (Test)
      </Button>
    </div>
  </div>
)}
```

**handleTestApproveAll fonksiyonu:**

```typescript
const handleTestApproveAll = async () => {
  if (!confirm("🧪 Test modu: Tüm onay adımları otomatik geçilecek. Emin misiniz?")) return
  
  try {
    const res = await fetch(`/api/overtime/${form.id}/test-approve-all`, {
      method: "POST",
    })
    const data = await res.json()
    
    if (data.success) {
      toast({ title: "Başarılı", description: data.message })
      router.refresh()
    } else {
      toast({ title: "Hata", description: data.error, variant: "destructive" })
    }
  } catch (error) {
    toast({ title: "Hata", description: "İstek başarısız", variant: "destructive" })
  }
}
```

---

## 9. Sidebar — Ayarlar Altmenüsü

Ayarlar sayfasının altmenüsüne "Onay Pozisyonları" ekle:

```typescript
// Settings alt menüsü veya Settings sayfasındaki linkler:
{ name: "Onay Pozisyonları", href: "/settings/approval-positions", icon: UserCheck }
```

`UserCheck` veya `Shield` ikonunu `lucide-react`'tan import et.

---

## 10. Uygulama Sırası (Claude Code İçin)

```
1. prisma/schema.prisma → ApprovalPosition tablosunu ekle
2. npx prisma migrate dev --name add_approval_positions
3. prisma/seed.ts → 7 pozisyonu seed et
4. npx prisma db seed
5. src/app/api/approval-positions/route.ts → GET + PUT
6. src/app/(dashboard)/settings/approval-positions/page.tsx → Ayarlar sayfası
7. src/app/api/overtime/[id]/submit/route.ts → Güncelle (pozisyonları DB'den çek)
8. src/app/api/overtime/[id]/approve/route.ts → Güncelle (yetki kontrolü)
9. src/app/api/overtime/[id]/test-approve-all/route.ts → Yeni endpoint
10. Detay sayfasına test modu butonu ekle
11. Sidebar'da settings altmenüsüne link ekle
```

---

## 11. Onay Akışı Özet

```
Form Oluştur (DRAFT)
      ↓
Onaya Gönder → Pozisyonlar DB'den çekilir, atanmamış varsa hata döner
      ↓
PENDING → Step 1: Üretim Müd. Yrd. onaylar
      ↓
IN_PROGRESS → Step 2: Fabrika Müdürü onaylar
      ↓
IN_PROGRESS → Step 3: T. Planlama Müdürü onaylar
      ↓
IN_PROGRESS → Step 4: Kalite Müdürü onaylar
      ↓
IN_PROGRESS → Step 5: İ.V. Müdürü onaylar
      ↓
IN_PROGRESS → Step 6: Genel Müdür Yrd. onaylar
      ↓                (opsiyonel: GM'e gönder)
APPROVED ✅  (veya Step 7: Genel Müdür → APPROVED)

Herhangi birisi REDDEDerse → REJECTED ❌ + bildirim oluşturucuya

🧪 Test Modu: SUPER_ADMIN tek butonla tüm adımları geçer
```

---

*Bu doküman ILERIHub Mesai Formu onay zinciri implementasyonu için hazırlanmıştır.*
