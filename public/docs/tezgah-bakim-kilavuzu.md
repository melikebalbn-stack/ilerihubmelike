# Tezgah Bakım Yönetimi Modülü
## Kullanım Kılavuzu

---

## İçindekiler

1. [Giriş](#giriş)
2. [Modüle Erişim](#modüle-erişim)
3. [Ana Ekran ve KPI'lar](#ana-ekran-ve-kpılar)
4. [Makineler](#makineler)
5. [Bakım Planları](#bakım-planları)
6. [İş Emirleri](#iş-emirleri)
7. [KPI Dashboard](#kpi-dashboard)
8. [Sık Sorulan Sorular](#sık-sorulan-sorular)

---

## Giriş

Tezgah Bakım Yönetimi modülü, fabrikadaki tüm makine ve tezgahların bakım süreçlerini dijital ortamda yönetmenizi sağlar. Bu modül ile:

- Makine envanterinizi takip edebilir
- Periyodik bakım planları oluşturabilir
- Arıza bildirimlerini kayıt altına alabilir
- İş emirlerini yönetebilir
- Bakım performansınızı KPI'larla ölçebilirsiniz

### Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| **Makine** | Üretimde kullanılan tezgah, ekipman veya cihaz |
| **Bakım Planı** | Periyodik olarak yapılması gereken bakım tanımı |
| **İş Emri** | Tek seferlik bakım veya arıza onarım görevi |
| **OEE** | Genel Ekipman Verimliliği (Overall Equipment Effectiveness) |
| **MTBF** | Arızalar Arası Ortalama Süre (Mean Time Between Failures) |
| **MTTR** | Ortalama Onarım Süresi (Mean Time To Repair) |

---

## Modüle Erişim

### Yetkili Roller
- **Quality Manager** (Kalite Yöneticisi)
- **Admin** (Yönetici)
- **Super Admin** (Süper Yönetici)

### Menüden Erişim
1. Sol menüden **"ILERI Teknik"** bölümünü açın
2. **"Tezgah Bakım"** seçeneğine tıklayın

---

## Ana Ekran ve KPI'lar

Modüle girdiğinizde üst kısımda 5 adet KPI kartı görürsünüz:

### KPI Kartları

| KPI | Açıklama | İyi Değer |
|-----|----------|-----------|
| **Toplam Makine** | Sistemde tanımlı aktif makine sayısı | - |
| **Arızalı** | Şu an arızalı durumda olan makine sayısı | 0'a yakın |
| **MTBF** | Arızalar arası ortalama süre (saat) | Yüksek olması iyi |
| **MTTR** | Ortalama onarım süresi (dakika) | Düşük olması iyi |
| **OEE** | Genel ekipman verimliliği (%) | %85+ World Class |

---

## Makineler

### Yeni Makine Ekleme

1. Sağ üst köşedeki **"+ Yeni Makine"** butonuna tıklayın
2. Açılan formda gerekli alanları doldurun:

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| Makine Adı | ✓ | Makinenin tanımlayıcı adı |
| Makine Tipi | | CNC, Torna, Freze, Pres vb. |
| Üretici | | Marka/üretici firma |
| Model | | Model numarası |
| Seri No | | Seri numarası |
| Kritiklik | | A (Kritik), B (Önemli), C (Normal) |
| Lokasyon | | Fabrika, bina, alan |
| Alan/Hat | | Üretim hattı |
| Açıklama | | Ek notlar |

3. **"Kaydet"** butonuna tıklayın

> **Not:** Makine kodu otomatik olarak oluşturulur (örn: TZG-001, TZG-002)

### Kritiklik Seviyeleri (ABC Analizi)

| Seviye | Renk | Anlamı |
|--------|------|--------|
| **A - Kritik** | Kırmızı | Arızalanırsa üretim tamamen durur |
| **B - Önemli** | Sarı | Arızalanırsa üretim kapasitesi azalır |
| **C - Normal** | Yeşil | Alternatif makine mevcut |

### Makine Durumları

| Durum | Renk | Anlamı |
|-------|------|--------|
| Çalışıyor | Yeşil | Aktif üretimde |
| Boşta | Gri | Beklemede |
| Bakımda | Mavi | Planlı bakım yapılıyor |
| Arızalı | Kırmızı | Arıza nedeniyle duruş |
| Ayar/Hazırlık | Sarı | Setup yapılıyor |
| Hurdaya Ayrılmış | Koyu Gri | Kullanım dışı |

### Filtreleme ve Arama

- **Arama kutusu:** Makine adı, kodu, üretici veya model ile arama
- **Durum filtresi:** Belirli durumdaki makineleri listeleme
- **Tip filtresi:** Belirli tipteki makineleri listeleme

---

## Bakım Planları

Bakım Planları sekmesi, periyodik bakımları tanımlamanızı sağlar.

### Yeni Bakım Planı Oluşturma

1. **"Bakım Planları"** sekmesine geçin
2. **"+ Yeni Plan"** butonuna tıklayın
3. Formu doldurun:

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| Makine | ✓ | Hangi makine için |
| Plan Adı | ✓ | Örn: "Haftalık Yağ Kontrolü" |
| Bakım Tipi | | Koruyucu, Kestirimci, Düzeltici |
| Periyot | | Kaç günde/haftada/ayda bir |
| Tahmini Süre | | Dakika cinsinden |
| Atanan Ekip | | Sorumlu bakım ekibi |
| Talimatlar | | Yapılacak işlem adımları |
| Güvenlik Notları | | İSG kuralları |

### Bakım Tipleri

| Tip | Açıklama | Örnek |
|-----|----------|-------|
| **Koruyucu** | Planlı periyodik bakım | Yağ değişimi, filtre temizliği |
| **Kestirimci** | Durum izleme bazlı | Titreşim analizi sonrası |
| **Düzeltici** | Arıza sonrası onarım | Motor değişimi |
| **Acil** | Kritik arıza | Ani duruş |
| **Denetim** | Kontrol/muayene | Yıllık genel kontrol |

### Periyot Seçenekleri

- **Gün:** Her X günde bir (örn: 7 gün = haftalık)
- **Hafta:** Her X haftada bir
- **Ay:** Her X ayda bir
- **Saat:** Her X çalışma saatinde bir
- **Çevrim:** Her X üretim çevriminde bir

### Plan Çalıştırma

Bakım zamanı geldiğinde:
1. İlgili planın kartında **"Çalıştır"** butonuna tıklayın
2. Sistem otomatik olarak bir iş emri oluşturur
3. Sonraki bakım tarihi otomatik güncellenir

> **Dikkat:** Kırmızı kenarlı kartlar vadesi geçmiş bakımları gösterir!

---

## İş Emirleri

İş Emirleri sekmesi, tüm bakım ve arıza işlerini takip etmenizi sağlar.

### Arıza Bildirimi / Yeni İş Emri

1. **"İş Emirleri"** sekmesine geçin
2. **"Arıza Bildir"** butonuna tıklayın (kırmızı buton)
3. Formu doldurun:

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| Makine | ✓ | Arızalanan makine |
| İş Emri Tipi | | Arıza, Koruyucu Bakım, İyileştirme |
| Başlık | ✓ | Kısa açıklama |
| Öncelik | | Kritik, Yüksek, Normal, Düşük |
| Arıza Belirtisi | | Gözlemlenen semptomlar |
| Atanan Ekip | | Sorumlu ekip |
| Açıklama | | Detaylı bilgi |

> **Not:** "Arıza" tipinde iş emri oluşturulduğunda makine durumu otomatik olarak "Arızalı" yapılır.

### Öncelik Seviyeleri

| Öncelik | Renk | Müdahale Süresi |
|---------|------|-----------------|
| **Kritik** | Kırmızı | Hemen |
| **Yüksek** | Turuncu | 4 saat içinde |
| **Normal** | Mavi | 24 saat içinde |
| **Düşük** | Gri | 1 hafta içinde |

### İş Emri Durumları ve Akışı

```
AÇIK → DEVAM EDİYOR → TAMAMLANDI → KAPANDI
         ↓
      BEKLEMEDE
```

| Durum | Açıklama |
|-------|----------|
| **Açık** | Yeni oluşturuldu, henüz başlanmadı |
| **Devam Ediyor** | Bakım ekibi çalışıyor |
| **Beklemede** | Yedek parça, onay vb. bekleniyor |
| **Tamamlandı** | İş bitti, onay bekliyor |
| **Kapandı** | Tamamen tamamlandı |
| **İptal** | İptal edildi |

### İş Emri Yönetimi

Her iş emri kartında:
- **"Başla"** butonu: İşe başlandığını kaydetmek için
- **"Tamamla"** butonu: İşi bitirmek için
- **"Detay"** butonu: Tüm bilgileri görüntülemek için

### Filtreleme

- **Durum filtresi:** Açık, Devam Eden vb.
- **Öncelik filtresi:** Kritik, Yüksek vb.

---

## KPI Dashboard

KPI Dashboard sekmesi, bakım performansınızı görselleştirir.

### OEE Bileşenleri

**OEE = Kullanılabilirlik × Performans × Kalite**

| Bileşen | Hesaplama | Hedef |
|---------|-----------|-------|
| **Kullanılabilirlik (A)** | Çalışma Süresi / Planlanan Süre | %90+ |
| **Performans (P)** | Gerçek Üretim / Teorik Üretim | %95+ |
| **Kalite (Q)** | İyi Ürün / Toplam Ürün | %99+ |
| **OEE** | A × P × Q | %85+ |

### OEE Değerlendirmesi

| OEE Değeri | Değerlendirme |
|------------|---------------|
| %85+ | World Class (Dünya Sınıfı) |
| %60-85 | İyi |
| %40-60 | Orta - İyileştirme Gerekli |
| %40'ın altı | Düşük - Acil Eylem Gerekli |

### MTBF ve MTTR

| Metrik | Formül | İyileştirme Yönü |
|--------|--------|-----------------|
| **MTBF** | Toplam Çalışma Süresi / Arıza Sayısı | Artırılmalı |
| **MTTR** | Toplam Onarım Süresi / Onarım Sayısı | Azaltılmalı |

### PM Uyumu (Planlı Bakım Uyumu)

**PM Uyumu = (Tamamlanan Planlı Bakımlar / Planlanan Bakımlar) × 100**

| PM Uyumu | Değerlendirme |
|----------|---------------|
| %95+ | Mükemmel |
| %85-95 | İyi |
| %70-85 | Geliştirilmeli |
| %70'in altı | Zayıf |

---

## En İyi Uygulamalar

### Makine Yönetimi
1. Tüm kritik makineleri sisteme tanımlayın
2. ABC analizini doğru yapın
3. Makine bilgilerini güncel tutun

### Bakım Planlaması
1. Üretici önerilerine göre bakım periyotları belirleyin
2. Kritik makineler için daha sık bakım planlayın
3. Kontrol listelerini detaylı hazırlayın

### İş Emri Yönetimi
1. Arızaları hemen bildirin
2. Önceliklendirmeyi doğru yapın
3. İşleri zamanında kapatın

### KPI Takibi
1. Haftalık KPI toplantıları yapın
2. Trend analizlerini takip edin
3. Kök neden analizleri yapın

---

## Sık Sorulan Sorular

**S: Makine kodu nasıl oluşturuluyor?**
C: Sistem otomatik olarak TZG-001, TZG-002 şeklinde sıralı kod atar.

**S: Bir bakım planını geçici olarak durdurmak istersem?**
C: Plan detayında durumu "Pasif" yapabilirsiniz.

**S: Arıza bildirimi yaptığımda makine durumu otomatik değişiyor mu?**
C: Evet, "Arıza" tipinde iş emri oluşturulduğunda makine durumu "Arızalı" olur.

**S: İş emri tamamlandığında makine durumu değişiyor mu?**
C: Evet, iş emri tamamlandığında makine durumu "Aktif" olarak güncellenir.

**S: OEE verilerini nereden giriyorum?**
C: OEE kayıtları şu an manuel olarak yönetilmektedir. İlerleyen versiyonlarda otomatik entegrasyon eklenecektir.

**S: Vadesi geçmiş bakımları nasıl görürüm?**
C: Bakım Planları sekmesinde kırmızı kenarlı kartlar vadesi geçmiş bakımları gösterir.

---

## İletişim ve Destek

Sorularınız için:
- **IT Destek:** ILERIHub üzerinden ticket açabilirsiniz
- **Sistem Yöneticisi:** Yetkili personele başvurun

---

*Bu kılavuz ILERIHub Tezgah Bakım Yönetimi modülü için hazırlanmıştır.*
*Versiyon: 1.0 | Tarih: Ocak 2026*
