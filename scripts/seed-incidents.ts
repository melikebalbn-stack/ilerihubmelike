import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ==========================================
// Olay (Incident) Verileri (13 adet)
// ==========================================

interface IncidentSeed {
  incidentNumber: string;
  title: string;
  description: string;
  category: 'CYBER_ATTACK' | 'UNAUTHORIZED_ACCESS' | 'DATA_BREACH' | 'SYSTEM_FAILURE' | 'PHYSICAL_SECURITY' | 'HUMAN_ERROR' | 'POLICY_VIOLATION' | 'SUPPLIER_RELATED';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD';
  detectedAt: string;
  detectionMethod: string;
  reportedByName: string;
  affectedSystems: string;
  impactScope: string;
  immediateActions: string;
  rootCause: string | null;
  resolution: string | null;
  correctiveAction: string | null;
  preventiveAction: string | null;
  lessonsLearned: string | null;
  relatedControls: string;
  relatedRiskIds: string[];
  containmentAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
}

const INCIDENTS: IncidentSeed[] = [
  {
    incidentNumber: 'OY-2025-001',
    title: 'Phishing E-posta Saldırısı',
    description: 'Şirket çalışanlarını hedef alan gelişmiş phishing e-posta saldırısı tespit edildi. Saldırganlar, sahte kurumsal e-posta şablonları kullanarak çalışanların kimlik bilgilerini ele geçirmeye çalıştı.',
    category: 'CYBER_ATTACK',
    severity: 'HIGH',
    status: 'CLOSED',
    detectedAt: '2025-01-15',
    detectionMethod: 'Kullanıcı Bildirimi',
    reportedByName: 'Hasan Engin',
    affectedSystems: 'E-posta Sistemi, Active Directory',
    impactScope: 'Departman',
    immediateActions: 'Şüpheli e-postalar engellendi, etkilenen hesaplar kilitlendi, tüm personele uyarı gönderildi',
    rootCause: 'Gelişmiş sosyal mühendislik teknikleri kullanan hedefli phishing saldırısı',
    resolution: 'E-posta filtreleme kuralları güncellendi, etkilenen hesapların parolaları sıfırlandı',
    correctiveAction: 'E-posta güvenlik gateway yapılandırması güncellendi',
    preventiveAction: 'Tüm personele phishing farkındalık eğitimi verildi',
    lessonsLearned: 'Düzenli phishing simülasyon tatbikatları yapılmalı',
    relatedControls: '5.24,8.7,6.3',
    relatedRiskIds: ['R-001', 'R-005'],
    containmentAt: '2025-01-15',
    resolvedAt: '2025-01-18',
    closedAt: '2025-01-22',
  },
  {
    incidentNumber: 'OY-2025-002',
    title: 'Yetkisiz VPN Erişim Denemesi',
    description: 'Dış kaynaklı IP adreslerinden VPN gateway üzerinde çok sayıda başarısız giriş denemesi tespit edildi. Brute-force saldırısı olarak değerlendirildi.',
    category: 'UNAUTHORIZED_ACCESS',
    severity: 'MEDIUM',
    status: 'CLOSED',
    detectedAt: '2025-02-03',
    detectionMethod: 'İzleme Sistemi',
    reportedByName: 'Melike Balaban',
    affectedSystems: 'VPN Gateway, Güvenlik Duvarı',
    impactScope: 'Bireysel',
    immediateActions: 'Şüpheli IP adresleri engellendi, VPN logları incelendi',
    rootCause: 'Dış kaynaklı brute-force saldırısı',
    resolution: 'IP engelleme listeleri güncellendi, başarısız giriş deneme limiti düşürüldü',
    correctiveAction: 'VPN erişim politikası güncellendi, MFA zorunlu hale getirildi',
    preventiveAction: 'Otomatik IP engelleme mekanizması kuruldu',
    lessonsLearned: 'VPN erişiminde çok faktörlü kimlik doğrulama kritik öneme sahip',
    relatedControls: '8.5,5.15,8.16',
    relatedRiskIds: ['R-003', 'R-007'],
    containmentAt: '2025-02-03',
    resolvedAt: '2025-02-05',
    closedAt: '2025-02-08',
  },
  {
    incidentNumber: 'OY-2025-003',
    title: 'Kişisel Veri Sızıntısı Şüphesi',
    description: 'İç denetim sırasında İK veritabanı ve dosya sunucusunda kişisel verilere yetkisiz erişim izleri tespit edildi. KVKK kapsamında değerlendirme başlatıldı.',
    category: 'DATA_BREACH',
    severity: 'CRITICAL',
    status: 'CLOSED',
    detectedAt: '2025-02-20',
    detectionMethod: 'Denetim',
    reportedByName: 'Melih Dilben',
    affectedSystems: 'İK Veritabanı, Dosya Sunucusu',
    impactScope: 'Şirket Geneli',
    immediateActions: 'Etkilenen sistemler izole edildi, KVKK ekibi bilgilendirildi, adli analiz başlatıldı',
    rootCause: 'Yetersiz erişim kontrolleri nedeniyle aşırı yetkilendirme',
    resolution: 'Erişim kontrolleri yeniden yapılandırıldı, etkilenen kişilere bildirim yapıldı',
    correctiveAction: 'En az yetki prensibi uygulamaya konuldu',
    preventiveAction: 'Düzenli erişim hakları gözden geçirme prosedürü oluşturuldu',
    lessonsLearned: 'Kişisel veri içeren sistemlerde erişim hakları düzenli gözden geçirilmeli',
    relatedControls: '5.10,5.34,8.3',
    relatedRiskIds: ['R-002', 'R-008'],
    containmentAt: '2025-02-20',
    resolvedAt: '2025-02-28',
    closedAt: '2025-03-05',
  },
  {
    incidentNumber: 'OY-2025-004',
    title: 'ERP Sistemi Çökmesi',
    description: 'ERP sistemi veritabanı disk alanının dolması nedeniyle beklenmedik şekilde çöktü. Tüm iş süreçleri etkilendi, yedek sisteme geçiş yapıldı.',
    category: 'SYSTEM_FAILURE',
    severity: 'HIGH',
    status: 'CLOSED',
    detectedAt: '2025-03-10',
    detectionMethod: 'Otomatik Alarm',
    reportedByName: 'Rahim Erol',
    affectedSystems: 'ERP Sistemi, Veritabanı Sunucusu',
    impactScope: 'Şirket Geneli',
    immediateActions: 'Yedek sistem devreye alındı, veritabanı kurtarma prosedürü başlatıldı',
    rootCause: 'Veritabanı disk alanının dolması ve otomatik temizleme mekanizmasının devre dışı olması',
    resolution: 'Disk alanı genişletildi, otomatik temizleme yapılandırıldı, sistem yeniden başlatıldı',
    correctiveAction: 'Disk alanı izleme alertleri yapılandırıldı',
    preventiveAction: 'Kapasite planlama prosedürü oluşturuldu',
    lessonsLearned: 'Kritik sistemlerde kapasite izleme ve proaktif planlama yapılmalı',
    relatedControls: '8.6,8.13,8.14',
    relatedRiskIds: ['R-010', 'R-015'],
    containmentAt: '2025-03-10',
    resolvedAt: '2025-03-11',
    closedAt: '2025-03-14',
  },
  {
    incidentNumber: 'OY-2025-005',
    title: 'Sunucu Odası Kliması Arızası',
    description: 'Sunucu odasındaki ana klima ünitesi arızalandı. Sıcaklık kritik seviyeye yaklaştı, acil önlemler alındı.',
    category: 'PHYSICAL_SECURITY',
    severity: 'MEDIUM',
    status: 'CLOSED',
    detectedAt: '2025-04-05',
    detectionMethod: 'Otomatik Alarm',
    reportedByName: 'Emek Dede',
    affectedSystems: 'Sunucu Odası, Tüm Sunucular',
    impactScope: 'Şirket Geneli',
    immediateActions: 'Taşınabilir soğutma üniteleri devreye alındı, kritik olmayan sistemler kapatıldı',
    rootCause: 'Klima ünitesinin bakım periyodunun aşılması',
    resolution: 'Klima tamiri yapıldı, yedek soğutma sistemi kuruldu',
    correctiveAction: 'Klima bakım sözleşmesi yenilendi',
    preventiveAction: 'Çevresel izleme sistemi kuruldu (sıcaklık, nem alertleri)',
    lessonsLearned: 'Fiziksel altyapı bakımları aksatılmamalı, yedekleme planları hazır olmalı',
    relatedControls: '7.5,7.11,7.12',
    relatedRiskIds: ['R-020', 'R-021'],
    containmentAt: '2025-04-05',
    resolvedAt: '2025-04-07',
    closedAt: '2025-04-10',
  },
  {
    incidentNumber: 'OY-2025-006',
    title: 'Yanlış E-posta Gönderimi',
    description: 'İnsan Kaynakları departmanından bir çalışan, otomatik tamamlama nedeniyle hassas olabilecek bir e-postayı yanlış alıcıya gönderdi.',
    category: 'HUMAN_ERROR',
    severity: 'LOW',
    status: 'CLOSED',
    detectedAt: '2025-04-18',
    detectionMethod: 'Kullanıcı Bildirimi',
    reportedByName: 'Melike Balaban',
    affectedSystems: 'E-posta Sistemi',
    impactScope: 'Bireysel',
    immediateActions: 'Geri çağırma talebi gönderildi, alıcıya silme talebi iletildi',
    rootCause: 'Otomatik tamamlama özelliği nedeniyle yanlış alıcı seçimi',
    resolution: 'E-posta geri çağrıldı, hassas bilgi içermediği doğrulandı',
    correctiveAction: 'E-posta gönderim onay mekanizması değerlendirildi',
    preventiveAction: 'Personele e-posta güvenliği hatırlatması yapıldı',
    lessonsLearned: 'Hassas e-postalarda gönderim öncesi doğrulama yapılmalı',
    relatedControls: '5.14,6.3',
    relatedRiskIds: ['R-006'],
    containmentAt: null,
    resolvedAt: '2025-04-18',
    closedAt: '2025-04-19',
  },
  {
    incidentNumber: 'OY-2025-007',
    title: 'USB Bellek Politikası İhlali',
    description: 'BGYS denetimi sırasında bir personelin kişisel USB bellek kullandığı tespit edildi. Cihaz incelemeye alındı.',
    category: 'POLICY_VIOLATION',
    severity: 'MEDIUM',
    status: 'CLOSED',
    detectedAt: '2025-05-02',
    detectionMethod: 'Denetim',
    reportedByName: 'Hasan Engin',
    affectedSystems: 'Uç Nokta Cihazları',
    impactScope: 'Departman',
    immediateActions: 'USB bellek el konuldu, cihaz taraması yapıldı, personel ile görüşme',
    rootCause: 'Personelin BGYS politikalarından haberdar olmaması',
    resolution: 'USB bellek incelendi (zararlı yazılım bulunamadı), DLP politikaları güncellendi',
    correctiveAction: 'USB port kontrolü aktifleştirildi',
    preventiveAction: 'Tüm personele veri güvenliği politikaları eğitimi verildi',
    lessonsLearned: 'Politika farkındalığı sürekli güncel tutulmalı',
    relatedControls: '5.10,8.12,6.3',
    relatedRiskIds: ['R-004', 'R-009'],
    containmentAt: null,
    resolvedAt: '2025-05-05',
    closedAt: '2025-05-08',
  },
  {
    incidentNumber: 'OY-2025-008',
    title: 'Tedarikçi Sistem Güvenlik Açığı',
    description: 'Tedarikçi portalında yamalanmamış bir güvenlik açığı bildirildi. Tedarikçi bağlantıları geçici olarak kesildi ve risk değerlendirmesi yapıldı.',
    category: 'SUPPLIER_RELATED',
    severity: 'HIGH',
    status: 'CLOSED',
    detectedAt: '2025-05-20',
    detectionMethod: 'Dış Bildirim',
    reportedByName: 'Samet Taşlı',
    affectedSystems: 'Tedarikçi Portalı, API Entegrasyonları',
    impactScope: 'Departman',
    immediateActions: 'Tedarikçi bağlantıları geçici olarak kesildi, risk değerlendirmesi yapıldı',
    rootCause: 'Tedarikçi sistemindeki yamalanmamış güvenlik açığı',
    resolution: 'Tedarikçi güvenlik açığını yamadı, bağlantılar yeniden güvenlik testi ile açıldı',
    correctiveAction: 'Tedarikçi güvenlik değerlendirme çerçevesi oluşturuldu',
    preventiveAction: 'Tedarikçi güvenlik SLA gereksinimleri güncellendi',
    lessonsLearned: 'Tedarikçi güvenlik durumu düzenli olarak değerlendirilmeli',
    relatedControls: '5.19,5.20,5.21',
    relatedRiskIds: ['R-025', 'R-026'],
    containmentAt: '2025-05-20',
    resolvedAt: '2025-05-25',
    closedAt: '2025-05-28',
  },
  {
    incidentNumber: 'OY-2025-009',
    title: 'Ransomware Saldırı Girişimi',
    description: 'Zararlı e-posta eki üzerinden gelen fidye yazılımı dosya sunucusunu ve 3 iş istasyonunu etkiledi. Olay müdahale prosedürü derhal başlatıldı.',
    category: 'CYBER_ATTACK',
    severity: 'CRITICAL',
    status: 'CLOSED',
    detectedAt: '2025-06-15',
    detectionMethod: 'İzleme Sistemi',
    reportedByName: 'Enes Aydınçakır',
    affectedSystems: 'Dosya Sunucusu, 3 İş İstasyonu',
    impactScope: 'Şirket Geneli',
    immediateActions: 'Etkilenen sistemler ağdan izole edildi, yedeklemeler doğrulandı, IR prosedürü başlatıldı',
    rootCause: 'Zararlı e-posta eki üzerinden gelen fidye yazılımı',
    resolution: 'Enfekte sistemler yedeklerden geri yüklendi, zararlı yazılım temizlendi',
    correctiveAction: 'EDR çözümü güncellendi, e-posta ek filtreleme kuralları sıkılaştırıldı',
    preventiveAction: 'Düzenli yedekleme testleri planlandı, ağ segmentasyonu güçlendirildi',
    lessonsLearned: 'Yedekleme stratejisi ve ağ segmentasyonu hayat kurtarıcı, IR planı düzenli test edilmeli',
    relatedControls: '8.7,8.8,8.13',
    relatedRiskIds: ['R-001', 'R-012'],
    containmentAt: '2025-06-15',
    resolvedAt: '2025-06-18',
    closedAt: '2025-06-25',
  },
  {
    incidentNumber: 'OY-2025-010',
    title: 'Zayıf Parola Tespiti',
    description: 'Planlı güvenlik denetimi sırasında Active Directory üzerinde çok sayıda zayıf parola kullanıldığı tespit edildi. Toplam 45 hesap etkilendi.',
    category: 'UNAUTHORIZED_ACCESS',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    detectedAt: '2025-07-08',
    detectionMethod: 'Denetim',
    reportedByName: 'Enes Aydınçakır',
    affectedSystems: 'Active Directory',
    impactScope: 'Şirket Geneli',
    immediateActions: 'Zayıf parolalı hesaplar kilitlenerek parola sıfırlama zorunlu tutuldu',
    rootCause: 'Parola politikası uygulamasının bazı sistemlerde etkin olmaması',
    resolution: 'Parola politikası tüm sistemlerde etkinleştirildi, 45 hesabın parolası sıfırlandı',
    correctiveAction: 'Parola politikası tüm sistemlerde merkezi olarak yönetilecek şekilde yapılandırıldı',
    preventiveAction: 'Düzenli parola denetimi planlandı (3 aylık)',
    lessonsLearned: 'Merkezi kimlik yönetimi ve düzenli denetim kritik',
    relatedControls: '5.15,8.5,5.17',
    relatedRiskIds: ['R-003', 'R-007'],
    containmentAt: '2025-07-08',
    resolvedAt: '2025-07-12',
    closedAt: null,
  },
  {
    incidentNumber: 'OY-2025-011',
    title: 'Yangın Algılama Sistemi Arızası',
    description: 'Sunucu odasındaki yangın algılama sistemi arızalandı. Sensör kalibrasyonunun zamanında yapılmadığı tespit edildi. Manuel gözetim artırıldı.',
    category: 'PHYSICAL_SECURITY',
    severity: 'HIGH',
    status: 'INVESTIGATING',
    detectedAt: '2025-08-01',
    detectionMethod: 'Otomatik Alarm',
    reportedByName: 'Melih Dilben',
    affectedSystems: 'Yangın Algılama Sistemi, Sunucu Odası',
    impactScope: 'Şirket Geneli',
    immediateActions: 'Manuel gözetim artırıldı, taşınabilir yangın söndürücüler kontrol edildi',
    rootCause: 'Sensör kalibrasyonunun zamanında yapılmaması',
    resolution: null,
    correctiveAction: null,
    preventiveAction: null,
    lessonsLearned: null,
    relatedControls: '7.4,7.5',
    relatedRiskIds: ['R-020', 'R-022'],
    containmentAt: '2025-08-01',
    resolvedAt: null,
    closedAt: null,
  },
  {
    incidentNumber: 'OY-2026-001',
    title: 'DDoS Saldırısı',
    description: 'Botnet kaynaklı yüksek hacimli DDoS saldırısı web sunucularını ve DNS hizmetlerini hedef aldı. CDN üzerinden trafik filtreleme ile müdahale edildi.',
    category: 'CYBER_ATTACK',
    severity: 'HIGH',
    status: 'INVESTIGATING',
    detectedAt: '2026-01-10',
    detectionMethod: 'İzleme Sistemi',
    reportedByName: 'Enes Aydınçakır',
    affectedSystems: 'Web Sunucuları, DNS Hizmetleri',
    impactScope: 'Şirket Geneli',
    immediateActions: 'CDN üzerinden trafik filtreleme aktifleştirildi, ISP ile koordinasyon sağlandı',
    rootCause: 'Botnet kaynaklı yüksek hacimli DDoS saldırısı',
    resolution: null,
    correctiveAction: null,
    preventiveAction: null,
    lessonsLearned: null,
    relatedControls: '8.6,8.20,8.22',
    relatedRiskIds: ['R-001', 'R-014'],
    containmentAt: '2026-01-10',
    resolvedAt: null,
    closedAt: null,
  },
  {
    incidentNumber: 'OY-2026-002',
    title: 'Çalışan Cihaz Kaybı',
    description: 'Saha mühendisi, şirket dizüstü bilgisayarını kaybetti. Cihaz uzaktan kilitlendi ve ilgili erişim bilgileri iptal edildi.',
    category: 'HUMAN_ERROR',
    severity: 'MEDIUM',
    status: 'OPEN',
    detectedAt: '2026-02-05',
    detectionMethod: 'Kullanıcı Bildirimi',
    reportedByName: 'Elif Yildirim',
    affectedSystems: 'Dizüstü Bilgisayar, VPN İstemcisi',
    impactScope: 'Bireysel',
    immediateActions: 'Cihaz uzaktan kilitlendi, VPN sertifikası iptal edildi, parola sıfırlama yapıldı',
    rootCause: null,
    resolution: null,
    correctiveAction: null,
    preventiveAction: null,
    lessonsLearned: null,
    relatedControls: '7.9,8.1',
    relatedRiskIds: ['R-006', 'R-009'],
    containmentAt: null,
    resolvedAt: null,
    closedAt: null,
  },
];

// ==========================================
// Ana fonksiyon
// ==========================================

async function main() {
  console.log('==============================================');
  console.log('ISO 27001 Olay Yönetimi Seed Script');
  console.log('==============================================\n');

  // ---- 1. Mevcut verileri sil ----
  console.log('1. Mevcut olay verileri siliniyor...');

  const deletedTimeline = await prisma.iso27001IncidentTimeline.deleteMany({});
  console.log(`   - ${deletedTimeline.count} zaman çizelgesi kaydı silindi`);

  const deletedActions = await prisma.iso27001IncidentAction.deleteMany({});
  console.log(`   - ${deletedActions.count} aksiyon kaydı silindi`);

  const deletedAttachments = await prisma.iso27001IncidentAttachment.deleteMany({});
  console.log(`   - ${deletedAttachments.count} ek dosya kaydı silindi`);

  const deletedIncidents = await prisma.iso27001Incident.deleteMany({});
  console.log(`   - ${deletedIncidents.count} olay kaydı silindi`);

  console.log('');

  // ---- 2. Olayları oluştur ----
  console.log('2. Olaylar oluşturuluyor...');
  let incidentCount = 0;
  let timelineCount = 0;

  for (const inc of INCIDENTS) {
    const reportedAt = new Date(inc.detectedAt);

    const created = await prisma.iso27001Incident.create({
      data: {
        incidentNumber: inc.incidentNumber,
        title: inc.title,
        description: inc.description,
        category: inc.category,
        severity: inc.severity,
        status: inc.status,
        detectedAt: new Date(inc.detectedAt),
        detectionMethod: inc.detectionMethod,
        reportedAt,
        reportedByName: inc.reportedByName,
        affectedSystems: inc.affectedSystems,
        impactScope: inc.impactScope,
        immediateActions: inc.immediateActions,
        containmentAt: inc.containmentAt ? new Date(inc.containmentAt) : null,
        rootCause: inc.rootCause,
        rootCauseAnalyzedAt: inc.rootCause ? new Date(inc.detectedAt) : null,
        resolution: inc.resolution,
        correctiveAction: inc.correctiveAction,
        preventiveAction: inc.preventiveAction,
        resolvedAt: inc.resolvedAt ? new Date(inc.resolvedAt) : null,
        closedAt: inc.closedAt ? new Date(inc.closedAt) : null,
        lessonsLearned: inc.lessonsLearned,
        relatedControls: inc.relatedControls,
        relatedRiskIds: inc.relatedRiskIds,
      },
    });

    incidentCount++;
    console.log(`   + ${inc.incidentNumber} - ${inc.title} [${inc.severity}/${inc.status}]`);

    // ---- 3. Zaman çizelgesi kayıtları oluştur ----

    // 3a. "Olay raporlandı" kaydı (tüm olaylar için)
    await prisma.iso27001IncidentTimeline.create({
      data: {
        incidentId: created.id,
        action: 'Olay raporlandı',
        description: `${inc.reportedByName} tarafından olay raporlandı. Tespit yöntemi: ${inc.detectionMethod}`,
        performedByName: inc.reportedByName,
        performedAt: reportedAt,
      },
    });
    timelineCount++;

    // 3b. "Kök neden analizi tamamlandı" (kapalı olaylar için, rootCause varsa)
    if (inc.status === 'CLOSED' && inc.rootCause) {
      const rootCauseDate = inc.containmentAt
        ? new Date(new Date(inc.containmentAt).getTime() + 2 * 24 * 60 * 60 * 1000) // containment + 2 gün
        : new Date(new Date(inc.detectedAt).getTime() + 3 * 24 * 60 * 60 * 1000); // detect + 3 gün

      await prisma.iso27001IncidentTimeline.create({
        data: {
          incidentId: created.id,
          action: 'Kök neden analizi tamamlandı',
          description: `Kök neden: ${inc.rootCause}`,
          performedByName: inc.reportedByName,
          performedAt: rootCauseDate,
        },
      });
      timelineCount++;
    }

    // 3c. "Olay çözüldü" (resolved veya closed olaylar için)
    if ((inc.status === 'RESOLVED' || inc.status === 'CLOSED') && inc.resolvedAt) {
      await prisma.iso27001IncidentTimeline.create({
        data: {
          incidentId: created.id,
          action: 'Olay çözüldü',
          description: inc.resolution || 'Olay çözüme kavuşturuldu',
          performedByName: inc.reportedByName,
          performedAt: new Date(inc.resolvedAt),
        },
      });
      timelineCount++;
    }

    // 3d. "Olay kapatıldı" (closed olaylar için)
    if (inc.status === 'CLOSED' && inc.closedAt) {
      await prisma.iso27001IncidentTimeline.create({
        data: {
          incidentId: created.id,
          action: 'Olay kapatıldı',
          description: inc.lessonsLearned
            ? `Öğrenilen dersler: ${inc.lessonsLearned}`
            : 'Olay kapatıldı',
          performedByName: inc.reportedByName,
          performedAt: new Date(inc.closedAt),
        },
      });
      timelineCount++;
    }
  }

  console.log(`\n   Toplam: ${incidentCount} olay oluşturuldu`);
  console.log(`   Toplam: ${timelineCount} zaman çizelgesi kaydı oluşturuldu\n`);

  // ---- 4. Özet ----
  console.log('==============================================');
  console.log('ÖZET');
  console.log('==============================================');
  console.log(`  Olaylar         : ${incidentCount} oluşturuldu`);
  console.log(`  Zaman Çizelgesi : ${timelineCount} oluşturuldu`);
  console.log('');

  // Kategori dağılımı
  const categories = INCIDENTS.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Kategori Dağılımı:');
  for (const [cat, count] of Object.entries(categories)) {
    console.log(`  ${cat.padEnd(22)}: ${count}`);
  }
  console.log('');

  // Ciddiyet dağılımı
  const severities = INCIDENTS.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Ciddiyet Dağılımı:');
  console.log(`  CRITICAL : ${severities['CRITICAL'] || 0}`);
  console.log(`  HIGH     : ${severities['HIGH'] || 0}`);
  console.log(`  MEDIUM   : ${severities['MEDIUM'] || 0}`);
  console.log(`  LOW      : ${severities['LOW'] || 0}`);
  console.log('');

  // Durum dağılımı
  const statuses = INCIDENTS.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Durum Dağılımı:');
  console.log(`  CLOSED        : ${statuses['CLOSED'] || 0}`);
  console.log(`  RESOLVED      : ${statuses['RESOLVED'] || 0}`);
  console.log(`  INVESTIGATING : ${statuses['INVESTIGATING'] || 0}`);
  console.log(`  OPEN          : ${statuses['OPEN'] || 0}`);
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
