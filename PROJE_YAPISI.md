# İleriHub - Proje Yapısı Özeti

**Oluşturulma Tarihi:** 1 Şubat 2026

---

## 1. Proje Durum Raporu (PROJE_DURUMU.md)

```markdown
# İleriHub - Proje Durum Raporu

**Son Güncelleme:** 30 Ocak 2026
**Versiyon:** 0.39.7
**Geliştirici:** Melih Dilben & Claude AI

---

## 1. Proje Özeti

İleriHub, İleri Group için geliştirilmiş kapsamlı bir kurumsal yönetim ve dijital dönüşüm platformudur. Next.js 15 tabanlı modern bir web uygulaması olarak tasarlanmış olup, şirketin tüm iç süreçlerini dijitalleştirmeyi hedeflemektedir.

### Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes |
| Veritabanı | PostgreSQL + Prisma ORM |
| Kimlik Doğrulama | NextAuth.js + LDAP (Active Directory) |
| Sunucu | Ubuntu Linux, Nginx, PM2 |
| CDN/SSL | Cloudflare |
| Versiyon Kontrolü | Git + GitHub |

---

## 2. Modüller ve Durumları

### 2.1 Tamamlanan Modüller ✅

#### Dashboard (Ana Sayfa)
- Özet istatistikler
- Hızlı erişim kartları
- Duyurular widget'ı
- Yaklaşan görevler
- Mobil responsive

#### Kullanıcı Yönetimi
- LDAP entegrasyonu (Active Directory)
- Otomatik kullanıcı senkronizasyonu
- Rol bazlı yetkilendirme (ADMIN, SUPER_ADMIN, QUALITY_MANAGER, USER)
- Departman bazlı erişim kontrolü

#### Görev Yönetimi (Tasks)
- Görev oluşturma, düzenleme, silme
- Durum takibi (Bekliyor, Devam Ediyor, Tamamlandı, İptal)
- Öncelik seviyeleri
- Departman/kişi bazlı filtreleme
- Eskalasyon sistemi
- Mobil responsive ✅

#### Mesajlaşma (Messages)
- Dahili mesajlaşma sistemi
- Konuşma bazlı görünüm
- Okundu/okunmadı takibi
- Mobil responsive ✅

#### Öneri Sistemi (Suggestions)
- Çalışan önerileri
- Kaizen yönetimi
- Ramak Kala (Near Miss) raporları
- 5S denetim sistemi
- Ödül puanlama sistemi
- Mobil responsive ✅

#### Toplantı Yönetimi (Meetings) 🆕
- Toplantı planlama ve takibi
- Gündem maddeleri yönetimi
- Katılımcı yönetimi (dahili + misafir)
- Toplantı kararları ve aksiyon takibi
- Toplantı tutanağı PDF çıktısı
- Başkan ve raportör ataması

#### ISO 27001 BGYS Modülü 🆕
- **Varlık Yönetimi:** BT varlıklarının envanteri
- **Risk Yönetimi:** Risk değerlendirme ve işleme
- **Kontrol Yönetimi:** 93 adet ISO 27001:2022 kontrolü
- **SoA (Uygulanabilirlik Beyanı):** Kontrol durumları
- **Denetim Yönetimi:** İç/dış denetim takibi
- **Olay Yönetimi:** Güvenlik olayları kaydı
- **Doküman Yönetimi:** Politika ve prosedürler
- **Eğitim Yönetimi:** BGYS eğitimleri ve takibi
- **Yönetim Gözden Geçirmesi:** YGG toplantı kayıtları

#### Eğitimlerim (My Trainings) 🆕
- Atanan eğitimlerin listesi
- PDF eğitim içerikleri
- İlerleme takibi
- Dijital imza ile tamamlama

#### Formlar 🆕
- **Ziyaret Raporları:** Müşteri/tedarikçi ziyaret kayıtları
- **Proje Planlama:** Gantt chart benzeri proje takibi
- PDF çıktı ve e-posta gönderimi

#### Mavi Yaka Kullanıcı Yönetimi 🆕
- LDAP dışı kullanıcı yönetimi
- Üretim personeli için basitleştirilmiş erişim

#### QDMS (Kalite Doküman Yönetim Sistemi)
- Doküman yönetimi
- Tedarikçi yönetimi
- Müşteri şikayetleri
- Uygunsuzluk raporları (NCR)
- CAPA yönetimi
- Risk yönetimi
- Eğitim takibi
- Değişiklik yönetimi

#### Stratejik İK
- Organizasyon şeması
- Performans değerlendirme
- İşe alım yönetimi
- Yedekleme planlaması
- Yetenek yönetimi

#### Anketler (Surveys)
- Anket oluşturma
- Çoktan seçmeli/açık uçlu sorular
- Sonuç analizi ve raporlama

#### Kalibrasyon Yönetimi
- Ölçü aleti takibi
- Kalibrasyon tarihleri
- Otomatik hatırlatmalar

#### Yangın Güvenliği
- Yangın söndürücü takibi
- Kontrol tarihleri
- Bakım kayıtları

### 2.2 Devam Eden / Planlanan Modüller 🔄

#### IT Raporları (it-reports)
- Durum: Geliştirme aşamasında
- Haftalık/aylık IT raporları
- Sistem performans metrikleri

#### Helpdesk
- Durum: Temel yapı mevcut
- Destek talepleri yönetimi
- SLA takibi

#### İzin Yönetimi (Leaves)
- Durum: Temel yapı mevcut
- İzin talepleri ve onayları
- İzin bakiyesi takibi

#### Devam Takibi (Attendance)
- Durum: Planlama aşamasında
- Giriş/çıkış kayıtları
- Mesai hesaplama

---

## 3. Teknik Altyapı

### 3.1 Veritabanı Şeması (Prisma)

Temel Modeller:
├── User (Kullanıcılar)
├── Department (Departmanlar)
├── Task (Görevler)
├── Message/Conversation (Mesajlaşma)
├── Suggestion/Kaizen/NearMiss (Öneri Sistemi)
├── Meeting/MeetingAttendee/AgendaItem/Decision (Toplantılar)
├── ISO27001Asset/Risk/Control/Audit/Incident (BGYS)
├── Training/UserTraining (Eğitimler)
├── VisitReport (Ziyaret Raporları)
├── ProjectPlan (Proje Planları)
├── Survey/SurveyQuestion/SurveyResponse (Anketler)
├── CalibrationEquipment (Kalibrasyon)
├── FireExtinguisher (Yangın Güvenliği)
└── ... (QDMS modelleri)

### 3.2 API Yapısı

/api
├── /auth (NextAuth endpoints)
├── /users (Kullanıcı işlemleri)
├── /tasks (Görev yönetimi)
├── /messages (Mesajlaşma)
├── /suggestions (Öneri sistemi)
├── /meetings (Toplantı yönetimi)
├── /iso27001 (BGYS endpoints)
│   ├── /assets
│   ├── /risks
│   ├── /controls
│   ├── /audits
│   ├── /incidents
│   ├── /documents
│   ├── /trainings
│   └── /soa
├── /forms
│   ├── /visit-reports
│   └── /project-plans
├── /qdms (Kalite yönetimi)
├── /surveys (Anketler)
├── /calibration (Kalibrasyon)
└── /fire-safety (Yangın güvenliği)

### 3.3 Kimlik Doğrulama Akışı

1. Kullanıcı giriş yapar
2. NextAuth LDAP provider'a bağlanır
3. Active Directory'de doğrulama yapılır
4. Kullanıcı bilgileri veritabanına senkronize edilir
5. JWT token oluşturulur
6. Session başlatılır

### 3.4 Sunucu Yapılandırması

Sunucu: Ubuntu Linux (172.16.16.33)
├── Nginx (Reverse Proxy, Port 80)
├── PM2 (Process Manager)
│   └── ilerihub (Next.js, Port 3000)
├── PostgreSQL (Veritabanı)
└── Cloudflare (CDN, SSL, DDoS koruması)

### 3.5 Güvenlik Önlemleri

- HTTPS zorunlu (Cloudflare SSL)
- HSTS header aktif
- CSP (Content Security Policy) tanımlı
- X-Frame-Options: SAMEORIGIN
- Rate limiting uygulanmış
- LDAP üzerinden merkezi kimlik doğrulama
- Rol bazlı erişim kontrolü (RBAC)
- Middleware ile rota koruması

---

## 4. Mobil Uyumluluk

### Tamamlanan Sayfalar ✅
- Dashboard
- Tasks (Görevler)
- Messages (Mesajlar)
- Suggestions (Öneriler)
- Login sayfası

### Mobil Tasarım Prensipleri
- Tailwind responsive sınıfları (sm:, md:, lg:)
- iOS safe-area padding
- Touch-friendly butonlar (min 44px)
- Scrollable tab'lar
- Bottom sheet modal'lar
- Küçük ekranlarda gizlenen/kısaltılan içerikler

---

## 5. Yapılacaklar Listesi

### Kısa Vadeli (1-2 Hafta)

- [ ] IT Raporları modülünü tamamla
- [ ] Helpdesk modülünü geliştir
- [ ] Meetings modülü mobil responsive yap
- [ ] ISO 27001 modülü mobil responsive yap
- [ ] E-posta bildirimleri genişlet
- [ ] Dashboard widget'larını özelleştirilebilir yap

### Orta Vadeli (1-2 Ay)

- [ ] İzin Yönetimi modülünü tamamla
- [ ] Devam Takibi modülünü geliştir
- [ ] PWA (Progressive Web App) özelliği ekle
- [ ] Push notification desteği
- [ ] Raporlama ve analitik dashboard
- [ ] Çoklu dil desteği (EN/TR)
- [ ] Dark mode

### Uzun Vadeli (3+ Ay)

- [ ] Mobil uygulama (React Native)
- [ ] AI destekli öneri sistemi
- [ ] Chatbot entegrasyonu
- [ ] ERP entegrasyonu
- [ ] Barkod/QR kod okuyucu
- [ ] Offline çalışma modu

---

## 6. Bilinen Sorunlar ve Çözümler

### Çözülen Sorunlar ✅

| Sorun | Çözüm | Tarih |
|-------|-------|-------|
| Diğer tarayıcılardan erişim sorunu | Cloudflare SSL + HSTS düzeltmesi | 30.01.2026 |
| Toplantı edit sayfası hata mesajları | Detaylı hata yönetimi eklendi | 30.01.2026 |
| Meetings middleware koruması | Middleware'e meetings eklendi | 30.01.2026 |

### Bilinen Sorunlar 🔄

| Sorun | Öncelik | Durum |
|-------|---------|-------|
| useEffect dependency warnings | Düşük | İzleniyor |
| Next.js workspace root uyarısı | Düşük | İzleniyor |

---

## 7. Deployment Prosedürü

### Geliştirme → Production

# 1. Değişiklikleri test et
npm run build

# 2. Git'e commit et
git add .
git commit -m "Değişiklik açıklaması"

# 3. GitHub'a push et
git push origin main

# 4. Sunucuda build al
npm run build

# 5. PM2'yi yeniden başlat
pm2 restart ilerihub

# 6. Logları kontrol et
pm2 logs ilerihub

### Rollback Prosedürü

# Önceki commit'e dön
git revert HEAD
npm run build
pm2 restart ilerihub

---

## 8. Yedekleme Stratejisi

### Veritabanı Yedekleme
- Konum: `/home/rokunet/backups/`
- Sıklık: Her gün otomatik
- Saklama: Son 7 gün

### Kod Yedekleme
- GitHub: https://github.com/melihjoe/ilerihub
- Son commit: 30.01.2026

### Dosya Yedekleme
- Uploads klasörü ayrı yedeklenmeli
- Eğitim dosyaları (public/trainings)

---

## 9. İletişim ve Destek

**Teknik Destek:** melih.dilben@ilerigroup.com
**GitHub:** https://github.com/melihjoe/ilerihub
**Sunucu:** hub.ilerigroup.com (172.16.16.33)

---

## 10. Sürüm Geçmişi

| Versiyon | Tarih | Değişiklikler |
|----------|-------|---------------|
| 0.39.7 | 30.01.2026 | Büyük güncelleme: Meetings, ISO27001, Forms, mobil iyileştirmeler |
| 0.1.0 | - | İlk commit |
```

---

## 2. Prisma Schema - Model ve Enum Listesi

### Core Models (Authentication & Users)
- `Account`, `Session`, `User`, `VerificationToken`
- `Department`, `Notification`, `PushSubscription`, `SystemSetting`

### Calibration Module
- `CalibrationLocation`, `CalibrationDeviceType`, `CalibrationDeviceModel`, `CalibrationDeviceName`, `CalibrationDepartment`
- `CalibrationDevice`, `CalibrationHistory`, `CalibrationEmailLog`
- `CalibrationNotificationEmail`, `CalibrationNotificationRule`

### Task Management
- `TaskCategory`, `PlannedTask`, `TaskEmailLog`, `TaskNotificationEmail`
- `TaskEscalationSettings`, `TaskExecutiveEmail`

### Suggestion System
- `SuggestionCategory`, `Suggestion`, `SuggestionApproval`, `SuggestionComment`
- `SuggestionTimeline`, `SuggestionSettings`, `SuggestionEvaluator`, `SuggestionBoardMember`

### Kaizen & Near Miss
- `KaizenProject`, `KaizenTeamMember`, `KaizenPDCAStep`, `KaizenAttachment`, `KaizenTimeline`
- `NearMiss`, `NearMissAttachment`, `NearMissAction`, `NearMissTimeline`

### 5S System
- `FiveSArea`, `FiveSTemplate`, `FiveSAudit`, `FiveSFinding`, `FiveSPhoto`, `FiveSSchedule`

### Points & Badges
- `EmployeePoints`, `PointHistory`, `Badge`

### Announcements & Surveys
- `AnnouncementCategory`, `Announcement`, `AnnouncementRead`, `AnnouncementComment`, `AnnouncementReaction`
- `Survey`, `SurveyQuestion`, `SurveyOption`, `SurveyResponse`, `SurveyAnswer`

### Messaging
- `Conversation`, `ConversationParticipant`, `Message`, `MessageReadReceipt`

### Helpdesk (Tickets)
- `TicketCategory`, `TicketTeam`, `Ticket`, `TicketComment`, `TicketTimeline`, `TicketWorkLog`
- `SLAPolicy`, `KnowledgeArticle`

### Maintenance (TPM)
- `Machine`, `MaintenancePlan`, `MaintenanceWorkOrder`, `DowntimeRecord`
- `SparePart`, `MachineSparePartUsage`, `MaintenanceLaborLog`, `MaintenanceTimeline`
- `MachineDocument`, `MachineOEERecord`, `MaintenanceKPITarget`

### QDMS (Quality Management)
- `QdmsDocument`, `QdmsDocumentRevision`, `QdmsDocumentApproval`, `QdmsDocumentDistribution`
- `QdmsCapa`, `QdmsCapaAction`, `QdmsNonConformance`
- `QdmsAudit`, `QdmsAuditTeamMember`, `QdmsAuditChecklist`, `QdmsAuditFinding`
- `QdmsRisk`, `QdmsSupplier`, `QdmsSupplierEvaluation`
- `QdmsChangeRequest`, `QdmsChangeRequestApproval`, `QdmsTrainingRecord`, `QdmsCustomerComplaint`

### Backup
- `BackupLog`, `BackupSchedule`

### Strategic HR
- `DailyMenu`, `Competency`, `Position`, `PositionCompetency`
- `TalentProfile`, `EmployeeCompetency`, `SuccessionPlan`, `SuccessionCandidate`
- `CareerPath`, `DevelopmentPlan`, `DevelopmentGoal`, `MentorshipRelation`, `TalentActivityLog`

### Performance Management
- `PerformanceCycle`, `PerformanceReview`, `PerformanceGoal`, `FeedbackRequest`, `FeedbackResponse`

### Recruitment
- `PersonnelRequest`, `JobOpening`, `Candidate`, `JobApplication`
- `InterviewStage`, `Interview`, `PublicJobApplication`

### Organization
- `OrgUnit`, `OrgEmployee`, `LoginLog`

### ISO 27001 (ISMS)
- `Iso27001Document`, `Iso27001DocumentVersion`, `Iso27001Signature`
- `Iso27001Control`, `Iso27001ControlDocument`, `Iso27001Evidence`
- `Iso27001Audit`, `Iso27001AuditTeamMember`, `Iso27001AuditFinding`
- `Iso27001Risk`, `Iso27001ManagementReview`
- `Iso27001Training`, `Iso27001TrainingParticipant`, `Iso27001TrainingAssignment`
- `Iso27001Asset`, `Iso27001Incident`, `Iso27001IncidentAttachment`, `Iso27001IncidentAction`, `Iso27001IncidentTimeline`

### Forms
- `VisitReport`, `VisitReportParticipant`, `VisitReportAction`, `VisitReportAttachment`

### Meetings
- `Meeting`, `MeetingAttendee`, `MeetingAgendaItem`, `MeetingDecision`, `MeetingAttachment`

### Project Planning
- `ProjectPlan`, `ProjectPlanItem`

---

## 3. Dashboard Modülleri

```
~/projects/ilerihub/src/app/(dashboard)/

drwx------ 24 rokunet rokunet 4096 Jan 28 07:16 .
drwxrwxr-x 10 rokunet rokunet 4096 Jan 30 05:37 ..
drwxrwxr-x  4 rokunet rokunet 4096 Dec 30 23:13 announcements
drwxrwxr-x  2 rokunet rokunet 4096 Jan  7 19:17 backups
drwxrwxr-x  2 rokunet rokunet 4096 Jan  1 20:19 calendar
drwxrwxr-x  2 rokunet rokunet 4096 Dec 30 01:42 calibration
drwx------  2 rokunet rokunet 4096 Jan 30 20:52 dashboard
drwxrwxr-x  2 rokunet rokunet 4096 Dec 24 12:45 fire-safety
drwxrwxr-x  4 rokunet rokunet 4096 Jan 28 12:06 forms
drwxrwxr-x 12 rokunet rokunet 4096 Jan 24 09:21 iso27001
drwx------  3 rokunet rokunet 4096 Jan 29 12:10 it-reports
drwxrwxr-x  2 rokunet rokunet 4096 Jan 11 01:04 it-support
-rw-------  1 rokunet rokunet 1900 Jan 10 22:28 layout.tsx
-rw-------  1 rokunet rokunet  406 Dec 29 02:36 loading.tsx
drwxrwxr-x  2 rokunet rokunet 4096 Jan 11 21:28 login-logs
drwxrwxr-x  3 rokunet rokunet 4096 Jan  2 12:55 maintenance
drwxrwxr-x  4 rokunet rokunet 4096 Jan 28 07:20 meetings
drwxrwxr-x  2 rokunet rokunet 4096 Jan 30 06:05 messages
drwxrwxr-x  3 rokunet rokunet 4096 Jan 23 12:06 my-trainings
drwxrwxr-x 11 rokunet rokunet 4096 Jan  4 19:38 qdms
drwx------  2 rokunet rokunet 4096 Jan 10 23:16 settings
drwxrwxr-x  7 rokunet rokunet 4096 Jan 29 11:40 strategic-hr
drwxrwxr-x  3 rokunet rokunet 4096 Jan 30 06:34 suggestions
drwxrwxr-x  3 rokunet rokunet 4096 Jan 14 08:34 surveys
drwxrwxr-x  2 rokunet rokunet 4096 Jan  8 18:20 talent-management
drwxrwxr-x  2 rokunet rokunet 4096 Jan 30 06:09 tasks
```

### Modül Listesi (24 Adet)

| Modül | Açıklama |
|-------|----------|
| `announcements/` | Duyurular |
| `backups/` | Yedekleme |
| `calendar/` | Takvim |
| `calibration/` | Kalibrasyon |
| `dashboard/` | Ana sayfa |
| `fire-safety/` | Yangın güvenliği |
| `forms/` | Formlar (Ziyaret raporları, Proje planları) |
| `iso27001/` | ISO 27001 BGYS modülü |
| `it-reports/` | IT Raporları |
| `it-support/` | IT Destek |
| `login-logs/` | Giriş logları |
| `maintenance/` | Bakım (TPM) |
| `meetings/` | Toplantı yönetimi |
| `messages/` | Mesajlaşma |
| `my-trainings/` | Eğitimlerim |
| `qdms/` | Kalite Doküman Yönetimi |
| `settings/` | Ayarlar |
| `strategic-hr/` | Stratejik İK |
| `suggestions/` | Öneri sistemi |
| `surveys/` | Anketler |
| `talent-management/` | Yetenek yönetimi |
| `tasks/` | Görev yönetimi |

---

## 4. API Endpoints

```
~/projects/ilerihub/src/app/api/

drwxrwxr-x 42 rokunet rokunet 4096 Jan 29 11:39 .
drwxrwxr-x 10 rokunet rokunet 4096 Jan 30 05:37 ..
drwxrwxr-x  4 rokunet rokunet 4096 Dec 30 23:56 announcements
drwxrwxr-x  4 rokunet rokunet 4096 Jan  8 14:35 auth
drwxrwxr-x  7 rokunet rokunet 4096 Jan  7 20:28 backups
drwxrwxr-x  3 rokunet rokunet 4096 Jan 29 11:40 bluecollar-users
drwxrwxr-x  3 rokunet rokunet 4096 Dec 31 00:11 calendar
drwxrwxr-x  7 rokunet rokunet 4096 Dec 30 23:31 calibration
drwx------  3 rokunet rokunet 4096 Dec 24 08:10 cron
drwxrwxr-x  2 rokunet rokunet 4096 Dec 30 23:43 departments
drwxrwxr-x  3 rokunet rokunet 4096 Dec 24 12:53 email
drwxrwxr-x  3 rokunet rokunet 4096 Dec 30 03:24 files
drwxrwxr-x  3 rokunet rokunet 4096 Jan 26 06:47 forms
drwxrwxr-x 17 rokunet rokunet 4096 Jan 24 22:24 iso27001
drwxrwxr-x  2 rokunet rokunet 4096 Jan 20 06:51 job-application
drwxrwxr-x  2 rokunet rokunet 4096 Jan  9 23:15 login-logs
drwxrwxr-x  3 rokunet rokunet 4096 Jan  2 11:06 machines
drwxrwxr-x  3 rokunet rokunet 4096 Jan  2 11:01 maintenance
drwx------  3 rokunet rokunet 4096 Jan  2 11:11 maintenance-plans
drwxrwxr-x  3 rokunet rokunet 4096 Jan 28 11:36 meetings
drwxrwxr-x  4 rokunet rokunet 4096 Jan  7 20:55 menu
drwxrwxr-x  4 rokunet rokunet 4096 Jan  9 12:34 messages
drwxrwxr-x  4 rokunet rokunet 4096 Jan  1 19:58 notifications
drwxrwxr-x  3 rokunet rokunet 4096 Jan 28 13:03 project-plans
drwxrwxr-x  5 rokunet rokunet 4096 Jan 12 22:15 public
drwxrwxr-x  4 rokunet rokunet 4096 Jan  1 19:56 push
drwxrwxr-x 11 rokunet rokunet 4096 Jan  4 19:46 qdms
drwxrwxr-x  2 rokunet rokunet 4096 Jan  1 20:01 search
drwx------ 10 rokunet rokunet 4096 Dec 25 08:57 settings
drwxrwxr-x  3 rokunet rokunet 4096 Jan  1 19:57 sse
drwxrwxr-x  3 rokunet rokunet 4096 Jan 11 01:22 sso
drwxrwxr-x  6 rokunet rokunet 4096 Jan  8 17:54 strategic-hr
drwxrwxr-x 12 rokunet rokunet 4096 Dec 30 23:33 suggestions
drwxrwxr-x  3 rokunet rokunet 4096 Jan  9 20:25 surveys
drwxrwxr-x  3 rokunet rokunet 4096 Dec 30 21:15 system
drwxrwxr-x  5 rokunet rokunet 4096 Jan  7 22:46 talent-management
drwxrwxr-x  9 rokunet rokunet 4096 Jan 11 13:47 tasks
drwxrwxr-x  6 rokunet rokunet 4096 Jan  1 22:39 tickets
drwx------  2 rokunet rokunet 4096 Dec 30 03:24 upload
drwxrwxr-x  3 rokunet rokunet 4096 Jan 26 06:58 users
drwxrwxr-x  3 rokunet rokunet 4096 Jan 11 20:50 verify
drwxrwxr-x  3 rokunet rokunet 4096 Jan  2 11:06 work-orders
```

### API Endpoint Listesi (42 Adet)

| Endpoint | Açıklama |
|----------|----------|
| `announcements/` | Duyuru API |
| `auth/` | NextAuth endpoints |
| `backups/` | Yedekleme API |
| `bluecollar-users/` | Mavi yaka kullanıcı API |
| `calendar/` | Takvim API |
| `calibration/` | Kalibrasyon API |
| `cron/` | Zamanlanmış görevler |
| `departments/` | Departman API |
| `email/` | E-posta API |
| `files/` | Dosya yönetimi |
| `forms/` | Form API (ziyaret raporları) |
| `iso27001/` | ISO 27001 BGYS API (17 alt klasör) |
| `job-application/` | İş başvurusu API |
| `login-logs/` | Giriş logları API |
| `machines/` | Makine API |
| `maintenance/` | Bakım API |
| `maintenance-plans/` | Bakım planları API |
| `meetings/` | Toplantı API |
| `menu/` | Menü API |
| `messages/` | Mesajlaşma API |
| `notifications/` | Bildirim API |
| `project-plans/` | Proje planı API |
| `public/` | Herkese açık API |
| `push/` | Push notification API |
| `qdms/` | QDMS API (11 alt klasör) |
| `search/` | Arama API |
| `settings/` | Ayarlar API |
| `sse/` | Server-Sent Events |
| `sso/` | Single Sign-On |
| `strategic-hr/` | Stratejik İK API |
| `suggestions/` | Öneri sistemi API (12 alt klasör) |
| `surveys/` | Anket API |
| `system/` | Sistem ayarları API |
| `talent-management/` | Yetenek yönetimi API |
| `tasks/` | Görev yönetimi API |
| `tickets/` | Destek talepleri API |
| `upload/` | Dosya yükleme API |
| `users/` | Kullanıcı API |
| `verify/` | Doğrulama API |
| `work-orders/` | İş emri API |

---

*Bu doküman Claude AI tarafından otomatik olarak oluşturulmuştur. Tarih: 1 Şubat 2026*
