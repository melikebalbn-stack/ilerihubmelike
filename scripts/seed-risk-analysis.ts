import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ==========================================
// Yardımcı fonksiyonlar
// ==========================================

function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 51) return 'CRITICAL';
  if (score >= 31) return 'HIGH';
  if (score >= 13) return 'MEDIUM';
  return 'LOW';
}

// ==========================================
// Tehdit Verileri (28 adet)
// ==========================================

interface ThreatSeed {
  code: string;
  name: string;
  category: 'NATURAL_DISASTER' | 'CYBER_ATTACK' | 'HUMAN' | 'TECHNICAL_FAILURE' | 'PHYSICAL_SECURITY' | 'SUPPLY_CHAIN' | 'COMPLIANCE';
  description: string;
  typicalLikelihood: number;
  typicalImpact: number;
}

const THREATS: ThreatSeed[] = [
  { code: 'T-01', name: 'Deprem', category: 'NATURAL_DISASTER', description: 'Yapısal hasar, sistem odası zarar görebilir', typicalLikelihood: 2, typicalImpact: 5 },
  { code: 'T-02', name: 'Yangın', category: 'NATURAL_DISASTER', description: 'Yangın sonucu veri ve ekipman kaybı', typicalLikelihood: 2, typicalImpact: 5 },
  { code: 'T-03', name: 'Su baskını', category: 'NATURAL_DISASTER', description: 'Alt yapı ve ekipman hasarı', typicalLikelihood: 1, typicalImpact: 4 },
  { code: 'T-04', name: 'Elektrik kesintisi', category: 'NATURAL_DISASTER', description: 'Uzun süreli güç kaybı', typicalLikelihood: 3, typicalImpact: 3 },
  { code: 'T-05', name: 'Fidye yazılımı (Ransomware)', category: 'CYBER_ATTACK', description: 'Dosyaların şifrelenmesi, fidye talebi', typicalLikelihood: 3, typicalImpact: 5 },
  { code: 'T-06', name: 'Oltalama (Phishing)', category: 'CYBER_ATTACK', description: 'E-posta ile kimlik bilgisi çalma', typicalLikelihood: 4, typicalImpact: 3 },
  { code: 'T-07', name: 'DDoS saldırısı', category: 'CYBER_ATTACK', description: 'Hizmet dışı bırakma saldırısı', typicalLikelihood: 2, typicalImpact: 3 },
  { code: 'T-08', name: 'Kötücül yazılım', category: 'CYBER_ATTACK', description: 'Virüs, trojan, worm bulaşması', typicalLikelihood: 3, typicalImpact: 4 },
  { code: 'T-09', name: 'SQL Injection', category: 'CYBER_ATTACK', description: 'Web uygulama zafiyeti istismarı', typicalLikelihood: 2, typicalImpact: 4 },
  { code: 'T-10', name: 'Brute force saldırısı', category: 'CYBER_ATTACK', description: 'Parola kırma denemeleri', typicalLikelihood: 3, typicalImpact: 3 },
  { code: 'T-11', name: 'Zero-day açıklığı', category: 'CYBER_ATTACK', description: 'Bilinmeyen zafiyet istismarı', typicalLikelihood: 2, typicalImpact: 5 },
  { code: 'T-12', name: 'Yetkisiz erişim', category: 'HUMAN', description: 'Yetkisiz kullanıcı erişimi', typicalLikelihood: 3, typicalImpact: 4 },
  { code: 'T-13', name: 'Veri sızıntısı (insider)', category: 'HUMAN', description: 'İç tehdit, kasıtlı veri çalma', typicalLikelihood: 2, typicalImpact: 5 },
  { code: 'T-14', name: 'Kullanıcı hatası', category: 'HUMAN', description: 'Yanlışlıkla silme, yanlış yapılandırma', typicalLikelihood: 4, typicalImpact: 3 },
  { code: 'T-15', name: 'Sosyal mühendislik', category: 'HUMAN', description: 'Manipülasyon ile bilgi edinme', typicalLikelihood: 3, typicalImpact: 4 },
  { code: 'T-16', name: 'Ayrıcalıklı hesap kötüye kullanımı', category: 'HUMAN', description: 'Admin yetkilerinin kötüye kullanımı', typicalLikelihood: 2, typicalImpact: 5 },
  { code: 'T-17', name: 'Donanım arızası', category: 'TECHNICAL_FAILURE', description: 'Sunucu, disk, bellek arızası', typicalLikelihood: 3, typicalImpact: 4 },
  { code: 'T-18', name: 'Yazılım hatası', category: 'TECHNICAL_FAILURE', description: 'Bug, uyumsuzluk, çökme', typicalLikelihood: 3, typicalImpact: 3 },
  { code: 'T-19', name: 'Ağ kesintisi', category: 'TECHNICAL_FAILURE', description: 'Ağ bağlantı problemleri', typicalLikelihood: 3, typicalImpact: 3 },
  { code: 'T-20', name: 'Yedek geri dönüş hatası', category: 'TECHNICAL_FAILURE', description: 'Yedeklerden geri yükleme başarısızlığı', typicalLikelihood: 2, typicalImpact: 5 },
  { code: 'T-21', name: 'Kapasite aşımı', category: 'TECHNICAL_FAILURE', description: 'Disk/bellek/CPU yetersizliği', typicalLikelihood: 3, typicalImpact: 3 },
  { code: 'T-22', name: 'Hırsızlık', category: 'PHYSICAL_SECURITY', description: 'Cihaz veya belge çalınması', typicalLikelihood: 2, typicalImpact: 4 },
  { code: 'T-23', name: 'İzinsiz fiziksel giriş', category: 'PHYSICAL_SECURITY', description: 'Sistem odasına yetkisiz erişim', typicalLikelihood: 2, typicalImpact: 4 },
  { code: 'T-24', name: 'Kablo hasarı', category: 'PHYSICAL_SECURITY', description: 'Veri/güç kablolarının zarar görmesi', typicalLikelihood: 2, typicalImpact: 3 },
  { code: 'T-25', name: 'Tedarikçi hizmet kesintisi', category: 'SUPPLY_CHAIN', description: 'Bulut/ISP/bakım sağlayıcı arızası', typicalLikelihood: 2, typicalImpact: 4 },
  { code: 'T-26', name: 'Tedarikçi veri ihlali', category: 'SUPPLY_CHAIN', description: 'Tedarikçi tarafında güvenlik ihlali', typicalLikelihood: 2, typicalImpact: 4 },
  { code: 'T-27', name: 'KVKK ihlali', category: 'COMPLIANCE', description: 'Kişisel verilerin korunması kanunu ihlali', typicalLikelihood: 2, typicalImpact: 5 },
  { code: 'T-28', name: 'Lisans ihlali', category: 'COMPLIANCE', description: 'Yazılım lisanslarının aşılması', typicalLikelihood: 2, typicalImpact: 3 },
];

// ==========================================
// Risk Verileri (30 adet)
// ==========================================

interface RiskSeed {
  riskNumber: string;
  control: string;
  assetName: string;
  scenario: string;
  existingControls: string;
  assetValue: number;
  likelihood: number;
  impact: number;
  riskScore: number;
  treatmentOption: 'ACCEPT' | 'MITIGATE' | 'TRANSFER' | 'AVOID';
  residualLikelihood: number;
  residualImpact: number;
  residualRiskScore: number;
  threatCode?: string;
}

const RISKS: RiskSeed[] = [
  {
    riskNumber: 'R-001',
    control: 'A.5.1',
    assetName: 'BGYS Dokümanları',
    scenario: 'BG politikası güncel değil veya uygulanmıyor',
    existingControls: 'L11.520 BG Politikası, YGG toplantıları',
    assetValue: 2,
    likelihood: 2,
    impact: 3,
    riskScore: 12,
    treatmentOption: 'ACCEPT',
    residualLikelihood: 2,
    residualImpact: 2,
    residualRiskScore: 8,
  },
  {
    riskNumber: 'R-002',
    control: 'A.5.7',
    assetName: 'Tüm BT Varlıkları',
    scenario: 'Tehdit istihbaratı eksikliği nedeniyle saldırıya hazırlıksız yakalanma',
    existingControls: 'Sophos Firewall (kısmi izleme)',
    assetValue: 3,
    likelihood: 3,
    impact: 4,
    riskScore: 36,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-11',
  },
  {
    riskNumber: 'R-003',
    control: 'A.5.15-18',
    assetName: 'Sunucular ve Ağ',
    scenario: 'Yetkisiz erişim - zayıf parola/hesap yönetimi',
    existingControls: 'Azure AD MFA, BT-T-753-2',
    assetValue: 3,
    likelihood: 3,
    impact: 4,
    riskScore: 36,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-12',
  },
  {
    riskNumber: 'R-004',
    control: 'A.5.19-22',
    assetName: 'Tedarikçi Verileri',
    scenario: 'Tedarikçi kaynaklı veri ihlali',
    existingControls: 'Gizlilik sözleşmesi (L13.35)',
    assetValue: 3,
    likelihood: 2,
    impact: 4,
    riskScore: 24,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-26',
  },
  {
    riskNumber: 'R-005',
    control: 'A.5.23',
    assetName: 'Bulut Hizmetleri',
    scenario: 'Microsoft 365/Azure hesap ele geçirme',
    existingControls: 'Azure AD MFA, Conditional Access',
    assetValue: 3,
    likelihood: 3,
    impact: 5,
    riskScore: 45,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-06',
  },
  {
    riskNumber: 'R-006',
    control: 'A.5.24-28',
    assetName: 'Tüm Sistemler',
    scenario: 'BG olayına yetersiz/geç müdahale',
    existingControls: 'BT-P-1002 Olay İhlal Prosedürü',
    assetValue: 3,
    likelihood: 2,
    impact: 4,
    riskScore: 24,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-08',
  },
  {
    riskNumber: 'R-007',
    control: 'A.5.29-30',
    assetName: 'İş Süreçleri',
    scenario: 'Uzun süreli iş kesintisi (felaket senaryosu)',
    existingControls: 'Yedekleme (BT-T-753), UPS/Jeneratör',
    assetValue: 3,
    likelihood: 2,
    impact: 5,
    riskScore: 30,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 1,
    residualImpact: 4,
    residualRiskScore: 12,
    threatCode: 'T-04',
  },
  {
    riskNumber: 'R-008',
    control: 'A.5.34',
    assetName: 'Personel Verileri',
    scenario: 'KVKK ihlali - kişisel verilerin ifşası',
    existingControls: 'S13.712 KVKK Politikası',
    assetValue: 3,
    likelihood: 2,
    impact: 5,
    riskScore: 30,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 1,
    residualImpact: 4,
    residualRiskScore: 12,
    threatCode: 'T-27',
  },
  {
    riskNumber: 'R-009',
    control: 'A.6.1-3',
    assetName: 'Personel',
    scenario: 'Farkındalık eksikliği nedeniyle güvenlik ihlali',
    existingControls: 'BG Farkındalık Eğitimi, IK-T-740.02',
    assetValue: 2,
    likelihood: 3,
    impact: 3,
    riskScore: 18,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 2,
    residualRiskScore: 8,
    threatCode: 'T-14',
  },
  {
    riskNumber: 'R-010',
    control: 'A.6.7',
    assetName: 'Dizüstü Bilgisayarlar',
    scenario: 'Uzaktan çalışmada veri sızıntısı',
    existingControls: 'SSL VPN, L11.520 BG Politikası',
    assetValue: 3,
    likelihood: 3,
    impact: 4,
    riskScore: 36,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-13',
  },
  {
    riskNumber: 'R-011',
    control: 'A.7.1-3',
    assetName: 'Sistem Odası',
    scenario: 'Fiziksel güvenlik ihlali - yetkisiz giriş',
    existingControls: 'CCTV, kart geçiş, 7/24 güvenlik',
    assetValue: 3,
    likelihood: 2,
    impact: 4,
    riskScore: 24,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 1,
    residualImpact: 3,
    residualRiskScore: 9,
    threatCode: 'T-23',
  },
  {
    riskNumber: 'R-012',
    control: 'A.7.4',
    assetName: 'Tesis',
    scenario: 'Fiziksel izleme yetersizliği - olay tespitinde gecikme',
    existingControls: 'CCTV kameralar, güvenlik personeli',
    assetValue: 3,
    likelihood: 2,
    impact: 3,
    riskScore: 18,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 2,
    residualRiskScore: 12,
    threatCode: 'T-23',
  },
  {
    riskNumber: 'R-013',
    control: 'A.7.5',
    assetName: 'Sistem Odası',
    scenario: 'Çevresel tehdit (yangın, su baskını)',
    existingControls: 'Yangın söndürme sistemi, QR takip',
    assetValue: 3,
    likelihood: 2,
    impact: 5,
    riskScore: 30,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 1,
    residualImpact: 4,
    residualRiskScore: 12,
    threatCode: 'T-02',
  },
  {
    riskNumber: 'R-014',
    control: 'A.8.1',
    assetName: 'Uç Nokta Cihazları',
    scenario: 'Cihaz kaybı/çalınması ile veri sızıntısı',
    existingControls: 'Sophos Endpoint, disk şifreleme',
    assetValue: 3,
    likelihood: 3,
    impact: 4,
    riskScore: 36,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-22',
  },
  {
    riskNumber: 'R-015',
    control: 'A.8.5',
    assetName: 'Azure AD',
    scenario: 'MFA bypass veya hesap ele geçirme',
    existingControls: 'Azure AD MFA, Conditional Access',
    assetValue: 3,
    likelihood: 2,
    impact: 5,
    riskScore: 30,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 1,
    residualImpact: 4,
    residualRiskScore: 12,
    threatCode: 'T-10',
  },
  {
    riskNumber: 'R-016',
    control: 'A.8.7',
    assetName: 'Tüm Cihazlar',
    scenario: 'Kötücül yazılım bulaşması (fidye yazılımı dahil)',
    existingControls: 'Sophos Endpoint + Firewall',
    assetValue: 3,
    likelihood: 3,
    impact: 5,
    riskScore: 45,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 4,
    residualRiskScore: 24,
    threatCode: 'T-05',
  },
  {
    riskNumber: 'R-017',
    control: 'A.8.8',
    assetName: 'Sunucular ve Yazılım',
    scenario: 'Bilinen zafiyetin istismar edilmesi',
    existingControls: 'Sızma testi, yama yönetimi',
    assetValue: 3,
    likelihood: 3,
    impact: 5,
    riskScore: 45,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 4,
    residualRiskScore: 24,
    threatCode: 'T-11',
  },
  {
    riskNumber: 'R-018',
    control: 'A.8.9',
    assetName: 'Sunucular ve Ağ',
    scenario: 'Hatalı konfigürasyon nedeniyle güvenlik açığı',
    existingControls: 'Kısmi konfigürasyon kontrolü',
    assetValue: 3,
    likelihood: 3,
    impact: 4,
    riskScore: 36,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-18',
  },
  {
    riskNumber: 'R-019',
    control: 'A.8.12',
    assetName: 'Tüm Veriler',
    scenario: 'Hassas verinin kurumdan dışarı sızması (DLP)',
    existingControls: 'Sophos Firewall DLP modülü',
    assetValue: 3,
    likelihood: 2,
    impact: 5,
    riskScore: 30,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 4,
    residualRiskScore: 24,
    threatCode: 'T-13',
  },
  {
    riskNumber: 'R-020',
    control: 'A.8.13',
    assetName: 'Yedek Verileri',
    scenario: 'Yedeklerin bozulması veya geri dönüş başarısızlığı',
    existingControls: 'BT-T-753 Yedekleme Talimatı, Veeam',
    assetValue: 3,
    likelihood: 2,
    impact: 5,
    riskScore: 30,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 1,
    residualImpact: 4,
    residualRiskScore: 12,
    threatCode: 'T-20',
  },
  {
    riskNumber: 'R-021',
    control: 'A.8.15-16',
    assetName: 'Tüm Sistemler',
    scenario: 'Log kayıtlarının yetersiz olması, izleme eksikliği',
    existingControls: 'Kısmi log toplama',
    assetValue: 2,
    likelihood: 3,
    impact: 4,
    riskScore: 24,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 12,
    threatCode: 'T-12',
  },
  {
    riskNumber: 'R-022',
    control: 'A.8.20-22',
    assetName: 'Ağ Altyapısı',
    scenario: 'Ağ segmentasyonu yetersizliği, yatay hareket riski',
    existingControls: 'Sophos Firewall, VLAN',
    assetValue: 3,
    likelihood: 3,
    impact: 4,
    riskScore: 36,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-12',
  },
  {
    riskNumber: 'R-023',
    control: 'A.8.23',
    assetName: 'İnternet Erişimi',
    scenario: 'Zararlı web sitesi erişimi ile enfeksiyon',
    existingControls: 'Sophos Web Filtreleme',
    assetValue: 2,
    likelihood: 3,
    impact: 3,
    riskScore: 18,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 2,
    residualRiskScore: 8,
    threatCode: 'T-08',
  },
  {
    riskNumber: 'R-024',
    control: 'A.8.25-28',
    assetName: 'ILERIHub Portal',
    scenario: 'Güvenli kodlama yapılmaması nedeniyle zafiyet',
    existingControls: 'Kısmi kod incelemesi',
    assetValue: 3,
    likelihood: 3,
    impact: 4,
    riskScore: 36,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-09',
  },
  {
    riskNumber: 'R-025',
    control: 'A.8.32',
    assetName: 'Tüm Sistemler',
    scenario: 'Kontrolsüz değişiklik sonucu sistem arızası',
    existingControls: 'Kısmi değişiklik izleme',
    assetValue: 3,
    likelihood: 3,
    impact: 4,
    riskScore: 36,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-18',
  },
  {
    riskNumber: 'R-026',
    control: 'A.5.9-13',
    assetName: 'Bilgi Varlıkları',
    scenario: 'Varlık envanterinin güncel olmaması',
    existingControls: 'L11.711 Varlık Grupları Listesi, ILERIHub',
    assetValue: 2,
    likelihood: 3,
    impact: 3,
    riskScore: 18,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 2,
    residualRiskScore: 8,
    threatCode: 'T-14',
  },
  {
    riskNumber: 'R-027',
    control: 'A.7.11',
    assetName: 'UPS ve Jeneratör',
    scenario: 'Güç kaynağı arızası ile sistem kaybı',
    existingControls: 'UPS, jeneratör, bakım sözleşmeleri',
    assetValue: 2,
    likelihood: 2,
    impact: 4,
    riskScore: 16,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 1,
    residualImpact: 3,
    residualRiskScore: 6,
    threatCode: 'T-04',
  },
  {
    riskNumber: 'R-028',
    control: 'A.8.17',
    assetName: 'Tüm Sistemler',
    scenario: 'Saat senkronizasyon bozukluğu - log tutarsızlığı',
    existingControls: 'NTP sunucu senkronizasyonu',
    assetValue: 1,
    likelihood: 2,
    impact: 2,
    riskScore: 4,
    treatmentOption: 'ACCEPT',
    residualLikelihood: 1,
    residualImpact: 1,
    residualRiskScore: 1,
  },
  {
    riskNumber: 'R-029',
    control: 'A.6.4-5',
    assetName: 'Personel',
    scenario: 'İşten ayrılan personelin hesaplarının açık kalması',
    existingControls: 'BT-T-753-2, İK işten çıkış süreci',
    assetValue: 3,
    likelihood: 3,
    impact: 4,
    riskScore: 36,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 2,
    residualImpact: 3,
    residualRiskScore: 18,
    threatCode: 'T-12',
  },
  {
    riskNumber: 'R-030',
    control: 'A.5.31-32',
    assetName: 'Tüm Organizasyon',
    scenario: 'Yasal gereksinimlere (KVKK, ISO) uyumsuzluk',
    existingControls: 'BGYS sistemi, KVKK politikası, iç denetim',
    assetValue: 2,
    likelihood: 2,
    impact: 5,
    riskScore: 20,
    treatmentOption: 'MITIGATE',
    residualLikelihood: 1,
    residualImpact: 4,
    residualRiskScore: 8,
    threatCode: 'T-27',
  },
];

// ==========================================
// Tedavi Planları (23 adet)
// ==========================================

interface TreatmentSeed {
  riskNumber: string;
  control: string;
  description: string;
  treatmentOption: 'ACCEPT' | 'MITIGATE' | 'TRANSFER' | 'AVOID';
  responsibleName: string;
  targetDate: string | null; // ISO date string veya null
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'MONITORING' | 'CANCELLED';
}

const TREATMENTS: TreatmentSeed[] = [
  {
    riskNumber: 'R-002',
    control: 'A.5.7',
    description: 'Tehdit istihbaratı prosedürü oluştur, Sophos tehdit feed\'leri aktifleştir',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-06-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-003',
    control: 'A.5.15-18',
    description: 'Ayrıcalıklı erişim yönetimi (PAM) prosedürü oluştur, erişim gözden geçirme periyodu belirle',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-04-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-004',
    control: 'A.5.19-22',
    description: 'Tedarikçi BG prosedürü oluştur, sözleşmelere BG maddeleri ekle',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT + Satınalma',
    targetDate: '2026-06-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-005',
    control: 'A.5.23',
    description: 'Bulut güvenliği prosedürü oluştur, Conditional Access politikaları güçlendir',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-04-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-006',
    control: 'A.5.24-28',
    description: 'Olay müdahale tatbikatı yap, iletişim matrisi güncelle',
    treatmentOption: 'MITIGATE',
    responsibleName: 'BGYS Ekibi',
    targetDate: '2026-06-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-007',
    control: 'A.5.29-30',
    description: 'İş Sürekliliği Planı (BCP) ve DRP oluştur, yılda 1 tatbikat yap',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT + Üst Yönetim',
    targetDate: '2026-09-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-008',
    control: 'A.5.34',
    description: 'KVKK uyum denetimi yap, veri envanteri güncelle, VERBİS kaydını kontrol et',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT + Hukuk',
    targetDate: '2026-04-30',
    status: 'IN_PROGRESS',
  },
  {
    riskNumber: 'R-010',
    control: 'A.6.7',
    description: 'Uzaktan çalışma politikası güncelle, cihaz şifreleme zorunlu kıl',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-04-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-011',
    control: 'A.7.1-3',
    description: 'Mevcut CCTV + kart geçiş sistemi yeterli, izleme devam',
    treatmentOption: 'ACCEPT',
    responsibleName: 'Tesis Yönetimi',
    targetDate: null,
    status: 'MONITORING',
  },
  {
    riskNumber: 'R-013',
    control: 'A.7.5',
    description: 'Yangın tüpü QR kontrol sistemi devam, yangın algılama sistemi bakımı',
    treatmentOption: 'MITIGATE',
    responsibleName: 'Tesis Yönetimi',
    targetDate: '2026-06-30',
    status: 'IN_PROGRESS',
  },
  {
    riskNumber: 'R-014',
    control: 'A.8.1',
    description: 'BitLocker disk şifreleme tüm notebook\'lara uygula, uzaktan silme aktifleştir',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-04-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-015',
    control: 'A.8.5',
    description: 'Phishing-resistant MFA\'ya geçiş (FIDO2/passkey), eski yöntemleri kaldır',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-09-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-016',
    control: 'A.8.7',
    description: 'Sophos MDR aktifleştir, 3-2-1 yedekleme kuralı uygula, tatbikat yap',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-06-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-017',
    control: 'A.8.8',
    description: 'Aylık zafiyet taraması otomatikleştir, kritik yamaları 72 saat içinde uygula',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-04-30',
    status: 'IN_PROGRESS',
  },
  {
    riskNumber: 'R-018',
    control: 'A.8.9',
    description: 'Konfigürasyon yönetimi prosedürü oluştur, baseline tanımla',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-06-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-019',
    control: 'A.8.12',
    description: 'Sophos DLP kurallarını genişlet, USB kısıtlama politikası uygula',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-06-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-020',
    control: 'A.8.13',
    description: 'Aylık yedek geri yükleme testi yap, test sonuçlarını dokümante et',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-04-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-021',
    control: 'A.8.15-16',
    description: 'İzleme prosedürü oluştur, merkezi log toplama (SIEM) değerlendir',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-09-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-022',
    control: 'A.8.20-22',
    description: 'Mikro segmentasyon planla, OT/IT ağ ayrımını güçlendir',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-09-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-024',
    control: 'A.8.25-28',
    description: 'Güvenli geliştirme ve kodlama prosedürü oluştur (OWASP Top 10)',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-06-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-025',
    control: 'A.8.32',
    description: 'Değişiklik yönetimi prosedürü oluştur, CAB süreci tanımla',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT Departmanı',
    targetDate: '2026-04-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-029',
    control: 'A.6.4-5',
    description: 'İK-IT otomatik bildirim sistemi kur, 24 saat içinde hesap kapatma SLA\'sı',
    treatmentOption: 'MITIGATE',
    responsibleName: 'IT + İK',
    targetDate: '2026-04-30',
    status: 'PLANNED',
  },
  {
    riskNumber: 'R-030',
    control: 'A.5.31-32',
    description: 'Yasal gereksinim takip listesi oluştur, 6 aylık uyum denetimi planla',
    treatmentOption: 'MITIGATE',
    responsibleName: 'BGYS Ekibi',
    targetDate: '2026-06-30',
    status: 'PLANNED',
  },
];

// ==========================================
// Ana fonksiyon
// ==========================================

async function main() {
  console.log('==============================================');
  console.log('ISO 27001 Risk Analizi Seed Script');
  console.log('==============================================\n');

  // ---- 1. Mevcut verileri sil ----
  console.log('1. Mevcut risk analizi verileri siliniyor...');

  const deletedTreatments = await prisma.iso27001RiskTreatmentPlan.deleteMany({});
  console.log(`   - ${deletedTreatments.count} tedavi planı silindi`);

  const deletedRisks = await prisma.iso27001Risk.deleteMany({});
  console.log(`   - ${deletedRisks.count} risk silindi`);

  const deletedThreats = await prisma.iso27001Threat.deleteMany({});
  console.log(`   - ${deletedThreats.count} tehdit silindi`);

  console.log('');

  // ---- 2. Tehditleri oluştur ----
  console.log('2. Tehditler oluşturuluyor...');
  let threatCount = 0;

  const threatMap = new Map<string, string>(); // code -> id

  for (const t of THREATS) {
    const created = await prisma.iso27001Threat.create({
      data: {
        code: t.code,
        name: t.name,
        category: t.category,
        description: t.description,
        typicalLikelihood: t.typicalLikelihood,
        typicalImpact: t.typicalImpact,
      },
    });
    threatMap.set(t.code, created.id);
    threatCount++;
    console.log(`   + ${t.code} - ${t.name} [${t.category}]`);
  }

  console.log(`   Toplam: ${threatCount} tehdit oluşturuldu\n`);

  // ---- 3. Varlıkları getir (mevcut olanları eşleştirmek için) ----
  console.log('3. Mevcut varlıklar kontrol ediliyor...');
  const existingAssets = await prisma.iso27001Asset.findMany({
    select: { id: true, name: true },
  });
  const assetMap = new Map<string, string>(); // name -> id
  for (const a of existingAssets) {
    assetMap.set(a.name, a.id);
  }
  console.log(`   ${existingAssets.length} mevcut varlık bulundu\n`);

  // ---- 4. Riskleri oluştur ----
  console.log('4. Riskler oluşturuluyor...');
  let riskCount = 0;

  const riskMap = new Map<string, string>(); // riskNumber -> id

  // Varlık adı eşleştirme tablosu: risk assetName -> mevcut varlık adı
  const assetNameMapping: Record<string, string> = {
    'Sistem Odası': 'Sunucu Odasi',
    'Tesis': 'Ana Bina',
    'UPS ve Jeneratör': 'Kesintisiz Guc Kaynagi (UPS)',
    'Bulut Hizmetleri': 'Bulut Yedekleme Hizmeti',
    'Yedek Verileri': 'Sistem Yedekleri',
    'Ağ Altyapısı': 'Ana Guvenlik Duvari (Firewall)',
    'İnternet Erişimi': 'Internet Hizmeti',
  };

  for (const r of RISKS) {
    // Varlık eşleştirmesi: Önce doğrudan isim ile, sonra mapping ile
    let assetId: string | null = null;
    const mappedName = assetNameMapping[r.assetName];
    if (assetMap.has(r.assetName)) {
      assetId = assetMap.get(r.assetName)!;
    } else if (mappedName && assetMap.has(mappedName)) {
      assetId = assetMap.get(mappedName)!;
    }

    // Tehdit eşleştirmesi
    let threatId: string | null = null;
    let threatName = r.scenario;
    if (r.threatCode && threatMap.has(r.threatCode)) {
      threatId = threatMap.get(r.threatCode)!;
      const matchingThreat = THREATS.find(t => t.code === r.threatCode);
      if (matchingThreat) {
        threatName = matchingThreat.name;
      }
    }

    const riskLevel = getRiskLevel(r.riskScore);
    const residualRiskLevel = getRiskLevel(r.residualRiskScore);

    // Risk durumu: ACCEPT -> MONITORING, MITIGATE -> IN_TREATMENT
    const status = r.treatmentOption === 'ACCEPT' ? 'MONITORING' : 'IN_TREATMENT';

    const created = await prisma.iso27001Risk.create({
      data: {
        riskNumber: r.riskNumber,
        assetId,
        assetName: r.assetName,
        assetValue: r.assetValue,
        threatId,
        threatName,
        scenario: r.scenario,
        title: `${r.control}: ${r.scenario}`,
        description: `ISO 27001:2022 Kontrol ${r.control} kapsamında tanımlanan risk. Varlık: ${r.assetName}. Senaryo: ${r.scenario}`,
        existingControls: r.existingControls,
        likelihood: r.likelihood,
        impact: r.impact,
        riskScore: r.riskScore,
        riskLevel,
        treatmentOption: r.treatmentOption,
        treatmentSummary: r.treatmentOption === 'ACCEPT'
          ? 'Risk kabul edildi, mevcut kontroller yeterli görülmektedir.'
          : 'Risk azaltma tedbirleri planlanmıştır.',
        residualLikelihood: r.residualLikelihood,
        residualImpact: r.residualImpact,
        residualRiskScore: r.residualRiskScore,
        residualRiskLevel: residualRiskLevel,
        relatedControls: [r.control],
        ownerId: '',
        ownerName: 'IT Departmanı',
        ownerEmail: 'bilgi.islem@ilerigroup.com',
        identifiedDate: new Date('2026-01-15'),
        reviewDate: new Date('2026-01-15'),
        nextReviewDate: new Date('2026-07-15'),
        status,
      },
    });

    riskMap.set(r.riskNumber, created.id);
    riskCount++;
    console.log(`   + ${r.riskNumber} - ${r.control}: ${r.assetName} [${riskLevel}] (Skor: ${r.riskScore})`);
  }

  console.log(`   Toplam: ${riskCount} risk oluşturuldu\n`);

  // ---- 5. Tedavi planlarını oluştur ----
  console.log('5. Tedavi planları oluşturuluyor...');
  let treatmentCount = 0;

  for (const tp of TREATMENTS) {
    const riskId = riskMap.get(tp.riskNumber);
    if (!riskId) {
      console.log(`   ! UYARI: ${tp.riskNumber} risk bulunamadı, tedavi planı atlanıyor`);
      continue;
    }

    await prisma.iso27001RiskTreatmentPlan.create({
      data: {
        riskId,
        treatmentOption: tp.treatmentOption,
        description: tp.description,
        responsibleName: tp.responsibleName,
        responsibleEmail: 'bilgi.islem@ilerigroup.com',
        targetDate: tp.targetDate ? new Date(tp.targetDate) : null,
        status: tp.status,
        notes: `Kontrol: ${tp.control}`,
      },
    });

    treatmentCount++;
    console.log(`   + ${tp.riskNumber} (${tp.control}): ${tp.description.substring(0, 60)}...`);
  }

  console.log(`   Toplam: ${treatmentCount} tedavi planı oluşturuldu\n`);

  // ---- 6. Özet ----
  console.log('==============================================');
  console.log('ÖZET');
  console.log('==============================================');
  console.log(`  Tehditler  : ${threatCount} oluşturuldu`);
  console.log(`  Riskler    : ${riskCount} oluşturuldu`);
  console.log(`  Tedaviler  : ${treatmentCount} oluşturuldu`);
  console.log('');

  // Risk seviyesi dağılımı
  const riskLevels = RISKS.reduce((acc, r) => {
    const level = getRiskLevel(r.riskScore);
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Risk Seviyesi Dağılımı:');
  console.log(`  CRITICAL : ${riskLevels['CRITICAL'] || 0}`);
  console.log(`  HIGH     : ${riskLevels['HIGH'] || 0}`);
  console.log(`  MEDIUM   : ${riskLevels['MEDIUM'] || 0}`);
  console.log(`  LOW      : ${riskLevels['LOW'] || 0}`);
  console.log('');

  // Tedavi dağılımı
  const treatmentOptions = RISKS.reduce((acc, r) => {
    acc[r.treatmentOption] = (acc[r.treatmentOption] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Risk İşleme Dağılımı:');
  console.log(`  MITIGATE : ${treatmentOptions['MITIGATE'] || 0}`);
  console.log(`  ACCEPT   : ${treatmentOptions['ACCEPT'] || 0}`);
  console.log(`  TRANSFER : ${treatmentOptions['TRANSFER'] || 0}`);
  console.log(`  AVOID    : ${treatmentOptions['AVOID'] || 0}`);
  console.log('');
  console.log('Seed işlemi başarıyla tamamlandı!');
}

main()
  .catch((e) => {
    console.error('HATA:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
