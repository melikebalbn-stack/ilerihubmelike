# Hub → IFS Personel Senkronu — Keşif + Faz 1 Pilot Raporu

**Tarih:** 16.09.2026 · **Hedef:** IFS Cloud test (`ifscloudtest`), Company `ILERI2`, Site `ILER2`, Structure `ILERI2` (StructBuId 61). IFS env `.env.local` (`IFS_*`), TLS `NODE_EXTRA_CA_CERTS=~/certs/rapidssl-tls-rsa-ca-g1.pem`. Token/secret bu belgede yok.

Kod: `src/lib/ifs/personel-sync/` (kodlar · ifs-api · plan · uygula · kuyruk), `/api/cron/ifs-personel-sync`, `scripts/ifs-personel-pilot.ts`, `scripts/ifs-test-temizlik.ts`. Dal `feat/ifs-personel-sync`.

## 0. Kilitli kararlar (16.09)

| # | Karar |
|---|---|
| A | `EmpNo = Personnel.sicilNo` aynen; senkron yalnız `ILR-` önekli kayıtlara dokunur (IG002, TEST-005, 3, 4 yok sayılır). |
| B | Yeni kod ailesi: `OrgCode/PosCode = OrgUnit.code.replace('ORG-TF-','')` (`P0021-N001`, `P0008-K01`, ≤10 kar.); `LaborClassNo` = üretim bölümü kodu tiresiz (`P0021N001`), Kaynakhane görevden `…R` (ROBOT) / `…M` (diğer). Koltuk başına 1 IFS pozisyonu (kadro düzeyi). `ifsKod` kolonu yok. |
| C | Üretim bölümü = aktif MAVI/GRI personeli olan bölüm − `SHOP_FLOOR_DISI=['İdari İşler']`. Kalite ve 4 depo içeride. Beyaz yaka asla shop-floor değil. → 16 bölüm / 17 sınıf. |
| D | Org hiyerarşisi EVET (`SupOrgCode` = en yakın DEPARTMENT atası; Hub'da bölümün üstü çoğunlukla müdür KOLTUĞU, onun üstü müdürlük). Pozisyon hiyerarşisi HAYIR (`SupPosCode='*'`) — faz 2. |
| E | `EntitledToOvertime=true`, `MasterEmployment=true`, `EmploymentType='DAIMI'`, `DegreeOfOccupation=1`, `Gender` gönderilir, `ValidTo/EmploymentEndDate=2099-12-31`. Pasif→tekrar aktif faz 1'de tespit+rapor (`YENIDEN_AKTIF`), yazma yok. |
| F | KVKK minimum set: sicil, ad-soyad, giriş/çıkış tarihi, org/pos kodu, cinsiyet, yaka (`FreeField1`), bölüm adı (`FreeField2`). Başka alan yok. |
| G | Çok koltuklu (6 kişi) → en eski aktif ana koltuk; koltuksuz (1) → ATLA + rapor. DELETE yok; create-then-update; ETag'li PATCH; her yazım `permission_audit_log` (`IFS_PERSONEL_SYNC`). |

## 1. Projeksiyon / set / anahtar

| Varlık | Projeksiyon (hepsi **/main**) | Set → tip | `$Key` | Not |
|---|---|---|---|---|
| Kişi | `PersonHandling` | `PersonInfoSet` → `PersonInfo` | `PersonId` | **Grant yok (403)**. Employee POST Person'ı `PersonId=EmpNo` ile kendisi açıyor. İstenmeyecek (karar). |
| Çalışan | `EmployeesHandling` | `CompanyPersons` → `CompanyPerson` (89 alan) | `CompanyId, EmpNo` | İstihdam + atama gömülü (`EmpOrgCode/EmpPosCode`, `EmploymentDate/EndDate`, `ValidFrom/To`). **Yalnız CREATE çalışıyor**; PATCH her alanda `500 ODP_ILLEGAL_STATE` (pilot). |
| Org birimi | `OrganizationUnitsHandling` | `CompanyOrgAlls` → `CompanyOrgAll` | `CompanyId, StructureId, OrgCode` | POST ✓ (pilot). Zorunlu: `OrgTermId`, `ExclusiveReg`. |
| Pozisyon | `PositionsHandling` | `CompanyPositionStrs` → `CompanyPositionStr` | `CompanyId, PosCode` | POST ✓ (pilot). Zorunlu: `StructureId`, `AssignedProtected`, `DefaultAccessExtension`. |
| Atama | — | ayrı set **yok** | — | `CompanyPerson` içinde; değişiklik için Employee File projeksiyonu gerekiyor (30 aday ad → 404). |
| Shop-floor employee | `ShopFloorEmployeesHandling` | `ShopFloorEmployees` | `Company, EmployeeId` | POST kanıtlı. |
| Shop-floor site | `ShopFloorEmployeesHandling` | `ShopFloorEmployeeSites` | `Company, EmployeeId, Contract` | POST/PATCH + `_SetBlocked/_SetActive` (ETag) kanıtlı. |
| Labor class | okuma `ShopFloorEmployeesHandling.Reference_LaborClass`; yazma `ManufacturingLaborClassesHandling.LaborClassSet` | `LaborClass` | `LaborClassNo, Contract` | **Yazma 403** (grant yok). |
| /int | `ShopFloorService` | set 0, yalnız action | — | personel yazımına uygun değil. |

`$metadata` zorunlu alan işareti taşımıyor; zorunlular POST hata kodlarından (`ORA-20124 NULLVALUE`) çıkarıldı. Yazma başlığı: `Content-Type: application/json` (IEEE754Compatible ile Decimal alanlar reddediliyor), `Prefer: wait=99999`; `x-ifs-accept-warnings` LaborClass'ta 400 → gönderilmiyor.

## 2. Grant durumu (IFS_POSTMAN)

| Projeksiyon | Durum | İstenecek |
|---|---|---|
| EmployeesHandling | okuma ✓ · CompanyPersons POST ✓ · PATCH ✗ (ODP_ILLEGAL_STATE) | Employee File / güncelleme projeksiyonu (güncelleme + `EmploymentEndDate` ile pasifleştirme için) |
| OrganizationUnitsHandling | okuma/POST/PATCH ✓ | — |
| PositionsHandling | okuma/POST ✓ | — |
| ShopFloorEmployeesHandling | okuma/POST/PATCH/action ✓ | — |
| **ManufacturingLaborClassesHandling** | GET/POST **403** | `LaborClassSet` okuma+yazma grant'i — 17 sınıf bunsuz yaratılamaz |
| PersonHandling / PersonsHandling | 403 | istenmeyecek (karar) |

## 3. IFS test verisi ve çakışmalar (16.09 sabahı, pilot öncesi)

- Employee **103**: 99 `ILR-*` + `3`, `4`, `IG002`, `TEST-005`. Hepsi `EmployeeStatus='*'`, `DAIMI`; `EmploymentEndDate` 100× `2099-12-31`, ILR-00016 `2026-01-13`. Hub kesişimi: 95 aktif · 4 Hub'da pasif (00125, 00207, 00734, 01123) · 4 ILR-dışı. Hub aktif 189'un **94'ü IFS'te yok** (58 beyaz, 32 mavi, 4 gri).
- Org **27** düz (`100-115` müdürlükler, `201-211` üretim), pozisyon **113** (100× `1001xx` düz + 13× `10xx-yy` İV pilotu, 4 mükerrer unvan), labor class 9 + `TEST`, shop-floor 101 (hepsi `WMM`, 6 Blocked).
- Eski aile senkronda **kullanılmaz**; temizlik betiği (`scripts/ifs-test-temizlik.ts`) yalnız eski aileyi hedefler, yeni aile regex ile korunur.

## 4. Alan eşleme (uygulanan)

**Org** — `OrgCode`=türetilmiş kod · `OrgName`=Hub bölüm adı (≤40) · `SupOrgCode`=üst bölüm kodu / `*` · `OrgTermId` = üst birimse 6 (Müdürlük) / alt birimse 8 (Yöneticilik) · `ExclusiveReg=false` · `ExcludeFromOrgChart=false` · `ValidFrom 2000-01-01` · `ValidTo 9999-12-31`.
**Pozisyon** — `PosCode`=türetilmiş · `PositionTitle`=koltuk adı (≤60) · `SupPosCode='*'` · `StructureId='ILERI2'` · `StructBuId=61` · `AssignedProtected=false` · `DefaultAccessExtension=false` · `ExportEmployees=false` · `ExcludeFromExport=false` · `ValidFrom 2000-01-01` · `ValidTo 2099-12-31`.
**Labor class** — `LaborClassNo`, `LaborClassDescription` (≤35, "Kaynakhane – Robot").
**Çalışan (CREATE)** — `EmpNo=PersonId=sicilNo` · `Fname/Lname` (son kelime soyad, tr-TR Başlık Hâli) · `InternalDisplayName/ExternalDisplayName/EmployeeName` · `ValidFrom=EmploymentDate=iseGirisTarihi` · `ValidTo=EmploymentEndDate=2099-12-31` · `EmpOrgCode/EmpPosCode` · sabitler (E) · `Gender` (MALE→Male, FEMALE→Female) · `FreeField1/2` (gönderilir ama IFS kalıcı yazmıyor → fark hesabı dışı).
**Shop-floor** — IG002 deseni (`WorkbenchUser`, `AllowEmpTimeManagement`, `ResumeOption=NoResume`, `AllowConcurrentOp=AskNewActivity`, `AttendanceAutoClockIn=Warning`); site `PrimaryLaborClass`, `LaborClassResource=true`, `PrimaryContract=true`; pasif → `_SetBlocked`.

## 5. Bölüm → labor class (üretilen 17 sınıf)

| Hub bölümü | Kod | | Hub bölümü | Kod |
|---|---|---|---|---|
| Kaynakhane (ROBOT görev) | `P0021N001R` | | Talaşlı İmalat | `P0023N003` |
| Kaynakhane (diğer) | `P0021N001M` | | Bakımhane | `P0020N001` |
| Mekanik Montaj | `P0022N003` | | Kalite Müdürlüğü | `P0078` |
| Plastik Enjeksiyon | `P0022N001` | | Asansör Müdürlüğü | `P0108` |
| Paketleme & Direksiyon | `P0022N002` | | Prototip Atölye | `P0068N002` |
| Lazer & Daire Testere | `P0023N002` | | Yarı Mamul ve Hammadde Depo | `P0025N001` |
| Preshane | `P0023N001` | | Mamul Depo | `P0025N002` |
| Kalıphane | `P0068N001` | | Tesellüm Depo | `P0025N003` |
| | | | Sarf Depo | `P0025N004` |

Shop-floor dışı: İdari İşler (6 MAVI: meydancı 4, şoför 1, çay/temizlik 1) — `SF_EMPLOYEE ATLA` olarak raporlanır. WKM (Kilit Montaj) Hub'da karşılıksız, üretilmez.

## 6. Sıra ve idempotency (uygulanan)

`planla()` → ORG (derinlik sırası) → POZISYON → LABOR_CLASS → EMPLOYEE (PASIF önce) → SF_EMPLOYEE → SF_SITE (PASIF önce). Her kalem GET durumuna göre CREATE / UPDATE (yalnız değişen alanlar, `If-Match: ETag`) / PASIF / NOOP / ATLA(sebep). `uygula()` sırayla yürütür; EMPLOYEE hatalıysa aynı kişinin SF katmanları denenmez; bu turda yaratılamayan labor class'a bağlı SF_SITE atlanır. Kuyruk (`ifs_personel_sync_kayit`) yalnız "yeniden bak" işareti; cron `?batch=N` ile boşaltır, `?tam=1` tam tarama, `?dryRun=1` yazmaz.

## 7. Açık kararlar → durum

| # | Konu | Durum |
|---|---|---|
| 1 | Kod ailesi | KAPANDI: yeni aile (B). Pilot: 6 org + 5 pozisyon yeni kodla yaratıldı. |
| 2 | Hiyerarşi | KAPANDI: org evet / pozisyon hayır (D). |
| 3 | Labor class boşlukları | KAPANDI kural olarak (C); **yazım grant'e takılı** (§2). |
| 4 | Kaynakhane R/M | KAPANDI: görevden (B). |
| 5 | Sabitler | KAPANDI (E). |
| 6 | PersonHandling grant | KAPANDI: istenmeyecek. |
| 7 | IG002/TEST-005/3/4 | temizlik betiği hazır, yalnız dry-run koşuldu (8 employee, 113 pozisyon, 27 org, 10 labor class, 6+6 shop-floor aday). |
| 8 | KVKK seti | KAPANDI (F); `FreeField1/2` IFS tarafında tutulmuyor. |
| **9 (yeni)** | **Çalışan güncelleme/pasifleştirme** | `CompanyPersons` PATCH desteklenmiyor → `EMPLOYEE_PATCH_DESTEKLI=false`; mevcut 95 ILR'nin yeni org/pos'a taşınması ve `EmploymentEndDate` ile pasifleştirme **IFS tarafı projeksiyon/grant bekliyor**. Pasifleştirme şimdilik yalnız shop-floor `Blocked`. |
| **10 (yeni)** | **Eski cron çakışması** | `/etc/cron.d/ilerihub-cron` satır 50: `ipro/cron/ifs-personel-sync` 03:30'da hâlâ koşuyor; tezgah eşlemesi olmayan Hub sicillerinin shop-floor site'ını **Blocked'a çeker** ve yeni operatörleri **eski kod ailesiyle** açar. Yeni senkron genişletilmeden önce bu satır kaldırılmalı (cron'a dokunulmadı). |

## 8. Pilot (16.09, ifscloudtest) — sonuç

Kapsam: ILR-01072 (beyaz, Fabrika Müdürlüğü) · ILR-00085 (mavi, Preshane) · ILR-00069 (mavi, Kalıphane) · ILR-00093 (mavi, Kaynakhane robot) · ILR-00449 (gri, Talaşlı İmalat). Mavi/gri kişiler bilerek IFS'te var olan + tezgah eşlemeli seçildi (§7-10 eski cron onları bloke etmesin diye).

| Varlık | Anahtar | İşlem | Round-trip |
|---|---|---|---|
| ORG | P0016 Fabrika Müdürlüğü | CREATE | ✓ sup=* |
| ORG | P0067 Mühendislik Müdürlüğü | CREATE | ✓ sup=* |
| ORG | P0023-N003 Talaşlı İmalat | CREATE | ✓ sup=P0016 |
| ORG | P0021-N001 Kaynakhane | CREATE | ✓ sup=P0016 |
| ORG | P0068-N001 Kalıphane | CREATE | ✓ sup=P0067 |
| ORG | P0023-N001 Preshane | CREATE | ✓ sup=P0016 |
| POZISYON | P0037 / P0050-K02 / P0039 / P0077-K07 / P0045-K05 | CREATE ×5 | ✓ başlıklar birebir |
| LABOR_CLASS | P0021N001R, P0068N001, P0023N003, P0023N001 | CREATE ×4 | ✗ 403 (grant) |
| EMPLOYEE | ILR-01072 | CREATE | ✓ org=P0016 pos=P0039 giriş=2024-09-30 bitiş=2099-12-31 cins=Female |
| EMPLOYEE | ILR-00449 / 00085 / 00069 / 00093 | ATLA `IFS_PATCH_YOK` | eski org/pos'ta kaldılar (204/206/203/201) |
| SF_SITE | 4 kişi (WMM → yeni sınıf) | ATLA | labor class yok |
| **2. koşu** | tümü | NOOP (LC 403 hariç) | idempotent ✓ |

Tam dry-run (189 aktif + 4 pasif): ORG create 21 / noop 6 · POZISYON create 221 / noop 5 · LABOR_CLASS create 17 · EMPLOYEE create 90 / noop 1 / atla 102 (94 IFS_PATCH_YOK, 4 Hub-pasif IFS_PATCH_YOK, 2 GENEL MÜDÜRLÜK şema kutusu yok, 1 koltuksuz, 1 YENIDEN_AKTIF) · SF_EMPLOYEE create 32 / noop 91 / atla 6 (İdari İşler) · SF_SITE create 32 / update 91.

## 9. Faz 2 / backlog

- Çevirici ekranına "Personel" sekmesi (kuyruk/hata görünümü) — bu turda YOK.
- Pozisyon hiyerarşisi; pasif→tekrar aktif yazımı; `EmploymentEndDate` pasifleştirme (grant sonrası `EMPLOYEE_PATCH_DESTEKLI=true`).
- Eski `ipro/cron/ifs-personel-sync` emekliliği + cron satırı.
- Migration `20260916120000_ifs_personel_sync_kayit` prod'a `psql -f` + `prisma migrate resolve --applied` (uygulanmadı).
