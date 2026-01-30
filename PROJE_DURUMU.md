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

```
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
```

### 3.2 API Yapısı

```
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
```

### 3.3 Kimlik Doğrulama Akışı

```
1. Kullanıcı giriş yapar
2. NextAuth LDAP provider'a bağlanır
3. Active Directory'de doğrulama yapılır
4. Kullanıcı bilgileri veritabanına senkronize edilir
5. JWT token oluşturulur
6. Session başlatılır
```

### 3.4 Sunucu Yapılandırması

```
Sunucu: Ubuntu Linux (172.16.16.33)
├── Nginx (Reverse Proxy, Port 80)
├── PM2 (Process Manager)
│   └── ilerihub (Next.js, Port 3000)
├── PostgreSQL (Veritabanı)
└── Cloudflare (CDN, SSL, DDoS koruması)
```

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

```bash
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
```

### Rollback Prosedürü

```bash
# Önceki commit'e dön
git revert HEAD
npm run build
pm2 restart ilerihub
```

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

---

*Bu doküman otomatik olarak oluşturulmuştur. Son güncelleme: 30 Ocak 2026*
