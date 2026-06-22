import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// SoA Veri Yapısı
interface SoAData {
  applicability: boolean // Uygulanabilir mi?
  status: "IMPLEMENTED" | "PARTIALLY" | "NOT_IMPLEMENTED" | "NOT_APPLICABLE"
  implementationNotes: string // Uygulanan Kontrol
  justification: string // Seçilme Nedeni
  documentRef?: string // Doküman/Kayıt referansı
}

// Standart gerekçe
const STANDARD_JUSTIFICATION = "Kuruluşta ISO 27001:2022 BGYS standardı gereği uygulanmaktadır."

// Tüm 93 Kontrol için SoA Verileri
const SOA_DATA: Record<string, SoAData> = {
  // ========================================
  // 5. ORGANİZASYONEL KONTROLLER (37 adet)
  // ========================================
  "5.1": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Bilgi Güvenliği Politikası, İç Denetim Raporları, Yönetimi Gözden Geçirme Toplantısında yılda en az bir defa değerlendirilecektir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "L.11.520 Bilgi Güvenliği Yönetim Sistemi Politikası- YGG"
  },
  "5.2": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Bilgi Güvenliği Politikası, BGYS Temsilcisi ve BG Ekibi görev tanımları mevcuttur.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "BT-T-430 Bilgi Güvenliği Kapsamı"
  },
  "5.3": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Görev tanımları ile çakışan görevler ayrılmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "BT-T-430 Bilgi Güvenliği Kapsamı"
  },
  "5.4": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Yönetim sorumlulukları BG Politikası ve BGYS Elkitabında tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "L.11.520 Bilgi Güvenliği Politikası"
  },
  "5.5": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "İlgili kurumlarla (KVKK, BTK, USOM vb.) iletişim prosedürleri mevcuttur.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "İletişim Listesi"
  },
  "5.6": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Güvenlik forumları ve profesyonel birliklerle iletişim sağlanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "İletişim Listesi"
  },
  "5.7": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Tehdit istihbaratı servisleri ve USOM bildirimleri takip edilmektedir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Tehdit İstihbaratı Prosedürü"
  },
  "5.8": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Proje yönetim süreçlerine bilgi güvenliği gereksinimleri entegre edilmiştir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Proje Yönetim Prosedürü"
  },
  "5.9": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Varlık envanteri oluşturulmuş ve güncel tutulmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Varlık Envanteri"
  },
  "5.10": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Kabul edilebilir kullanım politikası yayınlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Kabul Edilebilir Kullanım Politikası"
  },
  "5.11": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "İşten ayrılma prosedüründe varlık iade kontrolleri mevcuttur.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "İşten Ayrılma Prosedürü"
  },
  "5.12": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Bilgi sınıflandırma politikası (Gizli, Hizmete Özel, Genel) uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Bilgi Sınıflandırma Politikası"
  },
  "5.13": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Bilgi etiketleme prosedürü tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Bilgi Etiketleme Prosedürü"
  },
  "5.14": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Bilgi transfer politikası ve güvenli transfer yöntemleri belirlenmiştir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Bilgi Transfer Politikası"
  },
  "5.15": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Erişim kontrol politikası ve yetkilendirme matrisi mevcuttur.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Erişim Kontrol Politikası"
  },
  "5.16": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Kimlik yönetimi prosedürü (oluşturma, değiştirme, silme) tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Kimlik Yönetimi Prosedürü"
  },
  "5.17": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Parola politikası ve kimlik doğrulama gereksinimleri belirlenmiştir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Parola Politikası"
  },
  "5.18": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Erişim hakları periyodik olarak gözden geçirilmektedir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Erişim Hakları Gözden Geçirme Kayıtları"
  },
  "5.19": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Tedarikçi güvenlik değerlendirmesi ve sözleşme gereksinimleri tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Tedarikçi Güvenlik Politikası"
  },
  "5.20": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Tedarikçi sözleşmelerinde bilgi güvenliği maddeleri yer almaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Tedarikçi Sözleşme Şablonu"
  },
  "5.21": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "BİT tedarik zinciri güvenlik gereksinimleri tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Tedarik Zinciri Güvenlik Politikası"
  },
  "5.22": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Tedarikçi performansı ve güvenlik uyumu periyodik izlenmektedir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Tedarikçi Değerlendirme Kayıtları"
  },
  "5.23": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Bulut hizmetleri güvenlik gereksinimleri ve çıkış stratejisi tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Bulut Güvenlik Politikası"
  },
  "5.24": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Olay yönetimi prosedürü ve sorumlulukları tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Olay Yönetimi Prosedürü"
  },
  "5.25": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Güvenlik olayları değerlendirme kriterleri belirlenmiştir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Olay Sınıflandırma Kriterleri"
  },
  "5.26": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Olay müdahale prosedürleri dokümante edilmiştir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Olay Müdahale Prosedürü"
  },
  "5.27": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Olaylardan öğrenilen dersler kaydedilmekte ve iyileştirme yapılmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Olay Analiz Raporları"
  },
  "5.28": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Dijital kanıt toplama ve koruma prosedürü mevcuttur.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Kanıt Toplama Prosedürü"
  },
  "5.29": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "İş sürekliliği planında bilgi güvenliği gereksinimleri tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "İş Sürekliliği Planı"
  },
  "5.30": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "BİT felaket kurtarma planı hazırlanmış ve test edilmiştir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "BİT Felaket Kurtarma Planı"
  },
  "5.31": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Yasal ve mevzuat gereksinimleri takip edilmekte ve uyum sağlanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Yasal Gereksinimler Listesi"
  },
  "5.32": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Fikri mülkiyet hakları koruma prosedürü uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Fikri Mülkiyet Politikası"
  },
  "5.33": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Kayıt yönetimi prosedürü ve saklama süreleri tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Kayıt Yönetimi Prosedürü"
  },
  "5.34": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "KVKK uyumu sağlanmakta, kişisel veri envanteri tutulmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "KVKK Uyum Dokümanları"
  },
  "5.35": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "BGYS bağımsız iç denetimler ve yönetim gözden geçirmesi yapılmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "İç Denetim Planı"
  },
  "5.36": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Politika ve prosedür uyumu periyodik gözden geçirilmektedir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Uyum Gözden Geçirme Raporları"
  },
  "5.37": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "İşletim prosedürleri dokümante edilmiş ve güncel tutulmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "İşletim Prosedürleri"
  },

  // ========================================
  // 6. İNSAN KONTROLLERİ (8 adet)
  // ========================================
  "6.1": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "İşe alım öncesi güvenlik araştırması (sabıka kaydı, referans kontrolü) yapılmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "İşe Alım Prosedürü"
  },
  "6.2": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "İş sözleşmelerinde bilgi güvenliği sorumlulukları tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "İş Sözleşmesi Şablonu"
  },
  "6.3": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Bilgi güvenliği farkındalık eğitimleri düzenli verilmektedir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Eğitim Planı ve Kayıtları"
  },
  "6.4": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Disiplin prosedürü tanımlanmış ve iletilmiştir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Disiplin Prosedürü"
  },
  "6.5": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "İşten ayrılma sonrası sorumluluklar tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "İşten Ayrılma Prosedürü"
  },
  "6.6": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Gizlilik sözleşmeleri imzalatılmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Gizlilik Sözleşmesi"
  },
  "6.7": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Uzaktan çalışma güvenlik politikası uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Uzaktan Çalışma Politikası"
  },
  "6.8": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Güvenlik olayı raporlama mekanizması tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Olay Raporlama Prosedürü"
  },

  // ========================================
  // 7. FİZİKSEL KONTROLLER (14 adet)
  // ========================================
  "7.1": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Fiziksel güvenlik çevreleri (duvarlar, kapılar, güvenlik noktaları) tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Fiziksel Güvenlik Planı"
  },
  "7.2": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Giriş kontrol sistemleri (kartlı geçiş, biyometrik) uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Giriş Kontrol Prosedürü"
  },
  "7.3": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Ofis ve oda güvenliği sağlanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Fiziksel Güvenlik Kontrol Listesi"
  },
  "7.4": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "CCTV ve alarm sistemleri ile 7/24 fiziksel izleme yapılmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Fiziksel İzleme Prosedürü"
  },
  "7.5": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Yangın, su baskını ve diğer çevresel tehditlere karşı önlemler alınmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Çevresel Tehdit Değerlendirmesi"
  },
  "7.6": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Güvenli alanlarda çalışma kuralları tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Güvenli Alan Çalışma Kuralları"
  },
  "7.7": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Temiz masa ve temiz ekran politikası uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Temiz Masa Temiz Ekran Politikası"
  },
  "7.8": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Ekipman güvenli konumlandırma ve koruma sağlanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Ekipman Yerleşim Planı"
  },
  "7.9": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Tesis dışı ekipman güvenliği prosedürü tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Mobil Cihaz Politikası"
  },
  "7.10": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Depolama ortamı yönetimi (kullanım, taşıma, imha) prosedürü mevcuttur.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Ortam Yönetimi Prosedürü"
  },
  "7.11": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "UPS ve jeneratör ile kesintisiz güç sağlanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Altyapı Yönetimi Prosedürü"
  },
  "7.12": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Kablo güvenliği ve koruma önlemleri alınmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Kablolama Güvenliği Prosedürü"
  },
  "7.13": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Ekipman bakım prosedürleri tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Bakım Planı"
  },
  "7.14": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Ekipman imha/yeniden kullanım öncesi güvenli silme yapılmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Güvenli İmha Prosedürü"
  },

  // ========================================
  // 8. TEKNOLOJİK KONTROLLER (34 adet)
  // ========================================
  "8.1": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Uç nokta cihazları güvenlik yazılımları ve politikalarla korunmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Uç Nokta Güvenlik Politikası"
  },
  "8.2": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Ayrıcalıklı erişim yönetimi (PAM) uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Ayrıcalıklı Erişim Politikası"
  },
  "8.3": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "En az yetki prensibi uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Erişim Kontrol Politikası"
  },
  "8.4": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Kaynak kod erişimi yetkilendirilmiş personelle sınırlandırılmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Kaynak Kod Erişim Prosedürü"
  },
  "8.5": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Çok faktörlü kimlik doğrulama (MFA) kritik sistemlerde zorunludur.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Kimlik Doğrulama Politikası"
  },
  "8.6": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Kapasite yönetimi ve izleme yapılmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Kapasite Yönetimi Prosedürü"
  },
  "8.7": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Antivirüs ve anti-malware çözümleri tüm sistemlerde aktiftir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Zararlı Yazılım Koruma Politikası"
  },
  "8.8": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Zafiyet taramaları ve yama yönetimi düzenli yapılmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Zafiyet Yönetimi Prosedürü"
  },
  "8.9": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Konfigürasyon yönetimi ve sıkılaştırma standartları uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Yapılandırma Yönetimi Prosedürü"
  },
  "8.10": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Veri silme prosedürü (güvenli silme, üzerine yazma) tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Veri Silme Prosedürü"
  },
  "8.11": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Veri maskeleme test ortamlarında uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Veri Maskeleme Prosedürü"
  },
  "8.12": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "DLP (Veri Sızıntısı Önleme) çözümü uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "DLP Politikası"
  },
  "8.13": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Yedekleme politikası ve düzenli yedekleme uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Yedekleme Politikası"
  },
  "8.14": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Kritik sistemler için yedeklilik (HA, clustering) sağlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Yedeklilik Planı"
  },
  "8.15": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Log yönetimi ve merkezi log toplama (SIEM) uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Log Yönetimi Politikası"
  },
  "8.16": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Güvenlik izleme ve anomali tespiti yapılmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Güvenlik İzleme Prosedürü"
  },
  "8.17": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "NTP ile zaman senkronizasyonu sağlanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Zaman Senkronizasyonu Yapılandırması"
  },
  "8.18": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Yardımcı programların kullanımı kısıtlanmış ve kontrol altındadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Yardımcı Program Kullanım Politikası"
  },
  "8.19": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Yazılım kurulum prosedürü ve onay süreci tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Yazılım Yönetimi Prosedürü"
  },
  "8.20": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Ağ güvenliği (firewall, IPS/IDS, segmentasyon) uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Ağ Güvenliği Politikası"
  },
  "8.21": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Ağ hizmetleri güvenlik gereksinimleri SLA'larda tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Ağ Hizmetleri SLA"
  },
  "8.22": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Ağ segmentasyonu ve VLAN yapılandırması uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Ağ Segmentasyon Şeması"
  },
  "8.23": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Web filtreleme ve içerik kontrolü uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Web Filtreleme Politikası"
  },
  "8.24": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Şifreleme politikası ve anahtar yönetimi uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Kriptografi Politikası"
  },
  "8.25": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Güvenli yazılım geliştirme yaşam döngüsü (SSDLC) uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Güvenli Geliştirme Politikası"
  },
  "8.26": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Uygulama güvenlik gereksinimleri tanımlanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Uygulama Güvenlik Gereksinimleri"
  },
  "8.27": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Güvenli mimari prensipleri uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Güvenli Mimari Standartları"
  },
  "8.28": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Güvenli kodlama standartları (OWASP) uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Güvenli Kodlama Rehberi"
  },
  "8.29": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Güvenlik testleri (penetrasyon testi, kod analizi) yapılmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Güvenlik Test Prosedürü"
  },
  "8.30": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Dış kaynaklı geliştirme güvenlik gereksinimleri tanımlanmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Dış Kaynak Geliştirme Politikası"
  },
  "8.31": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Geliştirme, test ve üretim ortamları ayrılmıştır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Ortam Ayrımı Prosedürü"
  },
  "8.32": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Değişiklik yönetimi prosedürü uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Değişiklik Yönetimi Prosedürü"
  },
  "8.33": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Test verisi yönetimi ve anonimleştirme uygulanmaktadır.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Test Verisi Yönetimi Prosedürü"
  },
  "8.34": {
    applicability: true,
    status: "IMPLEMENTED",
    implementationNotes: "Denetim testleri planlanmakta ve koordineli yürütülmektedir.",
    justification: STANDARD_JUSTIFICATION,
    documentRef: "Denetim Test Planı"
  },
}

async function main() {
  console.log("SoA verileri güncelleniyor...")
  console.log("================================")

  let updated = 0
  let errors: string[] = []

  for (const [controlId, data] of Object.entries(SOA_DATA)) {
    try {
      const dbControlId = `A.${controlId}`

      const result = await prisma.iso27001Control.updateMany({
        where: { controlId: dbControlId },
        data: {
          applicability: data.applicability,
          status: data.status,
          implementationNotes: data.implementationNotes,
          justification: data.justification,
        },
      })

      if (result.count > 0) {
        updated++
        console.log(`✓ A.${controlId} güncellendi`)
      } else {
        console.log(`○ A.${controlId} bulunamadı`)
      }
    } catch (error) {
      console.error(`✗ A.${controlId} hata:`, error)
      errors.push(controlId)
    }
  }

  console.log("\n================================")
  console.log(`${updated} kontrol güncellendi`)
  if (errors.length > 0) {
    console.error(`${errors.length} hata oluştu: ${errors.join(", ")}`)
  }

  await prisma.$disconnect()
  await pool.end()
}

main().catch(console.error)
