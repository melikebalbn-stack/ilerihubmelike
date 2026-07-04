# Taslak — Workstation / PersonnelWorkstation Prisma Şeması

> **DURUM: TASLAK.** Bu dosya `prisma/schema.prisma`'ya **uygulanmadı**, migration
> **oluşturulmadı**. Sadece tasarım önerisidir. Onaylanınca schema.prisma'ya elle
> taşınıp `prisma migrate` ile alınacak.
>
> Konvansiyon kaynağı: `DepartmentPackage` join-tablosu deseni (explicit join model +
> kompozit `@@unique` + `@@index` + `@@map("snake_case")` + FK'lerde `onDelete: Cascade`).

## Modeller

```prisma
/// Fiziksel tezgah / iş istasyonu. IFS iş merkezi (work_center) ile kod üzerinden eşlenir.
model Workstation {
  id              String   @id @default(cuid())
  kod             String   @unique // Fiziksel tezgah kodu (örn. "CN01")
  ad              String              // Görünen ad (örn. "CNC Torna 1")
  ifsWorkCenterKod String             // IFS iş merkezi kodu (örn. "WMM01") — şimdilik string, aşağıdaki nota bak
  aktif           Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Bu tezgaha atanmış personel bağlantıları
  personelBaglantilari PersonnelWorkstation[]

  @@index([aktif])
  @@index([ifsWorkCenterKod])
  @@map("workstations")
}

/// Personel ↔ Tezgah çoktan-çoğa eşlemesi (explicit join). DepartmentPackage desenini takip eder.
model PersonnelWorkstation {
  id            String   @id @default(cuid())
  personnelId   String
  workstationId String
  createdAt     DateTime @default(now())

  personnel   Personnel   @relation(fields: [personnelId], references: [id], onDelete: Cascade)
  workstation Workstation @relation(fields: [workstationId], references: [id], onDelete: Cascade)

  @@unique([personnelId, workstationId]) // aynı personel-tezgah çifti bir kez
  @@index([workstationId])
  @@map("personnel_workstations")
}
```

## Personnel tarafına eklenecek back-relation

Prisma iki yönlü ilişki ister. `Personnel` modeline (satır ~8483) şu alan eklenmeli:

```prisma
// model Personnel { ... içine:
  workstationBaglantilari PersonnelWorkstation[]
```

`Personnel.id` = `String @id @default(cuid())` olduğundan FK hedefi `references: [id]` doğrudur.

## Notlar

**(a) `ifsWorkCenterKod` şimdilik `String`.**
IFS iş merkezi (work_center) master'ı ileride ayrı bir tabloya (örn. `IfsWorkCenter`)
materialize edilirse, bu alan o tabloya **FK'ye çevrilir** (`ifsWorkCenterId` + relation).
Şu an üretim/terminal katmanı IFS iş merkezini kod olarak taşıyor (bkz. `src/lib/uretim/terminal-mock.ts`
→ `TerminalIsMerkezi { kod: "WMM01" }`; T2'de ShopFloorService projeksiyonuna bağlanacak),
dolayısıyla string kod tutmak mevcut yapıyla tutarlı ve düşük bağımlılıklı başlangıç.

**(b) Veri kaynağı.**
- `ifsWorkCenterKod` değerleri: **IFS work_center listesi** (ShopFloorService / IFS projeksiyonu).
- Fiziksel tezgah kaydı (`kod`, `ad`) ve tezgah↔iş-merkezi eşlemesi: **elle tezgah tanımı**
  (admin ekranı veya seed).
- İçe aktarım/senkron için referans desen: **`scripts/import-ifs-department.ts`**
  (IFS listesini çekip upsert eden idempotent import pattern'i) — workstation/work-center
  senkronu da aynı iskeletle yazılabilir.

**(c) DİKKAT — mevcut `Machine` modeliyle kavramsal örtüşme.**
Şemada CMMS (Tezgah Bakım/Arıza) altında zaten bir `model Machine` var
(`machineCode @unique`, örn. "TZG-001/CNC-002"). `Workstation` üretim/atama amaçlı,
`Machine` bakım amaçlı — farklı bounded-context. Review'da karar verilmeli:
ayrı mı kalsınlar, yoksa `Workstation.machineId?` ile opsiyonel ilişki mi kurulsun.
Bu taslak ikisini **ayrı** tutuyor.
