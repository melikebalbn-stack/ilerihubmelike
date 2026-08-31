/**
 * Sistem genelinde tanımlı tüm yetki anahtarları.
 * Yeni modül eklerken buraya yetki eklenir, ardından `npm run seed:permissions` çalıştırılır.
 *
 * Format: <modül>.<aksiyon> veya <modül>.<nesne>.<aksiyon>
 */
export const PERMISSION_KEYS = {
  // === ADMIN / SİSTEM ===
  ADMIN_USERS_MANAGE: 'admin.users.manage',
  ADMIN_ROLES_MANAGE: 'admin.roles.manage',
  ADMIN_SYSTEM_MANAGE: 'admin.system.manage',
  ADMIN_BACKUP_MANAGE: 'admin.backup.manage',
  ADMIN_AUDIT_VIEW: 'admin.audit.view',

  // === AKADEMİ ===
  AKADEMI_VIEW: 'akademi.view',
  AKADEMI_ADMIN: 'akademi.admin',
  AKADEMI_KURS_CREATE: 'akademi.kurs.create',
  AKADEMI_KURS_EDIT: 'akademi.kurs.edit',
  AKADEMI_KURS_DELETE: 'akademi.kurs.delete',
  AKADEMI_REPORT_VIEW: 'akademi.report.view',
  AKADEMI_CERT_MANAGE: 'akademi.cert.manage',
  AKADEMI_GRADE_MANUAL: 'akademi.grade.manual',
  AKADEMI_IFS_EVALUATE: 'akademi.ifs.evaluate',
  AKADEMI_IFS_KEYUSER: 'akademi.ifs.keyuser',

  // ── IFS ayrımı (FAZ 1) ────────────────────────────────────────────────
  // IFS eğitim modülü akademiden ayrılıyor; bu beş anahtar akademi.* karşılık-
  // larının yerini ALACAK. Geçiş süresince İKİSİ de duruyor: guard'lar önce
  // OR'a çevrilecek (['ifs.x','akademi.x']), oturumlar yenilendikten sonra
  // eski anahtarlar kaldırılacak. Bu turda YALNIZ tanım eklendi — hiçbir
  // guard değişmedi.
  IFS_VIEW: 'ifs.view',
  IFS_RAPOR_VIEW: 'ifs.rapor.view',
  IFS_ADMIN: 'ifs.admin',
  IFS_EVALUATE: 'ifs.evaluate',
  IFS_KEYUSER: 'ifs.keyuser',

  // === ARŞİV ===
  // Y14: Arşiv modülü RBAC kapsam dışı — departman-bazlı resource-level
  // access (arsiv-auth.ts: kullanıcı kendi bolumId'sine erişir) RBAC
  // role-based ile uyumsuz. Sadece sidebar visibility için arsiv.view kalır.
  // Koli/evrak CRUD permission'ları seed'den kaldırıldı (kullanılmıyordu,
  // mevcut helper EMPLOYEE+ + bolüm match ile yetkilendiriyor).
  ARSIV_VIEW: 'arsiv.view',

  // === BGYS / ISO 27001 ===
  BGYS_DOCUMENT_VIEW: 'bgys.document.view',
  BGYS_DOCUMENT_CREATE: 'bgys.document.create',
  BGYS_DOCUMENT_EDIT: 'bgys.document.edit',
  BGYS_DOCUMENT_APPROVE: 'bgys.document.approve',
  BGYS_RISK_MANAGE: 'bgys.risk.manage',
  BGYS_AUDIT_MANAGE: 'bgys.audit.manage',

  // === ÇALIŞAN REHBERİ ===
  CALISAN_REHBERI_VIEW: 'calisanrehberi.view',
  CALISAN_REHBERI_ADMIN: 'calisanrehberi.admin',

  // === İZİN YÖNETİMİ ===
  IZIN_CREATE: 'izin.create',
  IZIN_APPROVE: 'izin.approve',
  IZIN_ADMIN: 'izin.admin',

  // === KALİBRASYON ===
  KALIBRASYON_VIEW: 'kalibrasyon.view',
  KALIBRASYON_ADMIN: 'kalibrasyon.admin',

  // === KALİTE / ÖLÇÜM RAPORLARI (KALITE-1) ===
  QUALITY_SYMBOL_MANAGE: 'quality.symbol.manage',
  QUALITY_TEMPLATE_MANAGE: 'quality.template.manage',
  QUALITY_REPORT_CREATE: 'quality.report.create',
  QUALITY_REPORT_FILL: 'quality.report.fill',
  QUALITY_REPORT_READ: 'quality.report.read',

  // === ZİMMET İADE / İLİŞİK KESME (OFFB-1) ===
  OFFBOARDING_VIEW: 'offboarding.view',
  OFFBOARDING_CREATE: 'offboarding.create',
  OFFBOARDING_EDIT: 'offboarding.edit',
  OFFBOARDING_APPROVE: 'offboarding.approve',
  OFFBOARDING_DELETE: 'offboarding.delete',

  // === ZİMMET TESLİM FORMU ===
  // NOT: offboarding.* ("Zimmet İade / İlişik Kesme") ve Elif'in envanter
  // zimmetinden AYRI bir modül — bu yüzden anahtar 'zimmet.*' değil
  // 'zimmet-formu.*'. Cihaz teslim tutanağı + onay/imza akışı.
  ZIMMET_FORMU_VIEW: 'zimmet-formu.view',
  ZIMMET_FORMU_CREATE: 'zimmet-formu.create',
  ZIMMET_FORMU_APPROVE: 'zimmet-formu.approve',

  // === YANGIN TÜPÜ ===
  YANGIN_VIEW: 'yangin.view',
  YANGIN_QR_SCAN: 'yangin.qr.scan',
  YANGIN_ADMIN: 'yangin.admin',

  // === HELPDESK / IT ===
  HELPDESK_TICKET_CREATE: 'helpdesk.ticket.create',
  HELPDESK_TICKET_VIEW: 'helpdesk.ticket.view',
  HELPDESK_TICKET_ASSIGN: 'helpdesk.ticket.assign',
  HELPDESK_TICKET_RESOLVE: 'helpdesk.ticket.resolve',
  HELPDESK_ADMIN: 'helpdesk.admin',

  // === MALİYET ANALİZİ ===
  COSTANALYSIS_VIEW: 'costanalysis.view',
  COSTANALYSIS_CREATE: 'costanalysis.create',
  COSTANALYSIS_EDIT: 'costanalysis.edit',
  COSTANALYSIS_ADMIN: 'costanalysis.admin',

  // === DUYURU ===
  DUYURU_VIEW: 'duyuru.view',
  DUYURU_CREATE: 'duyuru.create',
  DUYURU_ADMIN: 'duyuru.admin',

  // === FORMS (visit-reports, overtime, project-bar) ===
  FORMS_ADMIN: 'forms.admin',
  FORMS_APPROVE: 'forms.approve',
  OVERTIME_REPORT: 'overtime.report',
  OVERTIME_REPORT_ALL: 'overtime.report.all',
  OVERTIME_VIEW_ALL: 'overtime.view.all',
  OVERTIME_VIEW_DEPT: 'overtime.view.dept',

  // === RECRUITMENT (strategic-hr/recruitment) ===
  RECRUITMENT_ADMIN: 'recruitment.admin',
  RECRUITMENT_VIEW: 'recruitment.view',
  RECRUITMENT_CREATE: 'recruitment.create',
  RECRUITMENT_CANDIDATE_VIEW: 'recruitment.candidate.view',

  // === ENVANTER (zimmet/stok/satınalma/sezon) ===
  ENVANTER_VIEW:  'envanter.view',
  ENVANTER_ADMIN: 'envanter.admin',

  // === ÜRETİM (IFS shop-floor terminali) ===
  URETIM_BILDIRIM: 'uretim.bildirim',
  // === ÜRETİM / TEZGAH ===
  URETIM_TEZGAH_MANAGE: 'uretim.tezgah.manage',

  // === DEPO (El terminali) ===
  DEPO_TERMINAL_USE: 'depo.terminal.use',

  // === IPRO (MAS üretim takip — tanım ve kiosk yönetimi) ===
  IPRO_VIEW: 'ipro.view',
  IPRO_ADMIN: 'ipro.admin',
  IPRO_TAKVIM_YONET: 'ipro.takvim.yonet',

  // === QDMS (Kalite Yönetim Sistemi) ===
  QDMS_VIEW: 'qdms.view',
  QDMS_MANAGE: 'qdms.manage',

  // === RMA/SMA İade Formu (KAL-KYT-16) ===
  RMA_MANAGE: 'rma.manage',

  // === Kalite Hata Kodları (KAL-KYT-15 Bölüm 1) ===
  QUALITY_HATAKODU_MANAGE: 'quality.hatakodu.manage',

  // === Kalite Uygunsuzluk (KAL-KYT-15 Bölüm 2) ===
  UYGUNSUZLUK_MANAGE: 'uygunsuzluk.manage',

  // === SERVİS YÖNETİMİ ===
  SERVIS_VIEW: 'servis.view',
  SERVIS_TANIM_MANAGE: 'servis.tanim.manage',

  // === YILLIK ÇALIŞMA TAKVİMİ ===
  YILLIK_TAKVIM_VIEW: 'yilliktakvim.view',
  YILLIK_TAKVIM_CREATE: 'yilliktakvim.create',
  YILLIK_TAKVIM_EDIT: 'yilliktakvim.edit',
  YILLIK_TAKVIM_CANCEL: 'yilliktakvim.cancel',
  YILLIK_TAKVIM_COMPLETE: 'yilliktakvim.complete',
  YILLIK_TAKVIM_APPROVE: 'yilliktakvim.approve',
  YILLIK_TAKVIM_ATTACHMENT_MANAGE: 'yilliktakvim.attachment.manage',
  YILLIK_TAKVIM_NOTIFICATION_MANAGE: 'yilliktakvim.notification.manage',
  YILLIK_TAKVIM_ADMIN: 'yilliktakvim.admin',
} as const;

export type PermissionKey = typeof PERMISSION_KEYS[keyof typeof PERMISSION_KEYS];

/**
 * UI gruplama ve seed için modül başlıkları.
 */
export const MODULE_LABELS: Record<string, string> = {
  admin: 'Sistem Yönetimi',
  akademi: 'Akademi',
  arsiv: 'Arşiv',
  bgys: 'BGYS / ISO 27001',
  calisanrehberi: 'Çalışan Rehberi',
  izin: 'İzin Yönetimi',
  kalibrasyon: 'Kalibrasyon',
  offboarding: 'Zimmet İade / İlişik Kesme',
  'zimmet-formu': 'Zimmet Teslim Formu',
  yangin: 'Yangın Tüpü',
  helpdesk: 'IT Destek',
  costanalysis: 'Maliyet Analizi',
  duyuru: 'Duyuru',
  forms: 'Form Modülleri',
  recruitment: 'İşe Alım',
  uretim: 'Üretim',
  depo: 'Depo',
  ipro: 'IPRO Üretim Takip',
  qdms: 'Kalite Yönetim Sistemi',
  rma: 'RMA/SMA İade Formu',
  servis: 'Servis Yönetimi',
  yilliktakvim: 'Yıllık Çalışma Takvimi',
};

/**
 * Permission açıklamaları (UI ve seed için).
 */
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'admin.users.manage': 'Kullanıcı yönetimi (ekle/düzenle/sil)',
  'admin.roles.manage': 'Rol ve yetki yönetimi',
  'admin.system.manage': 'Sistem ayarları',
  'admin.backup.manage': 'Yedekleme yönetimi',
  'admin.audit.view': 'Denetim kayıtlarını görüntüleme',

  'akademi.view': 'Akademi modülünü görüntüleme',
  'akademi.admin': 'Akademi tam yönetim',
  'akademi.kurs.create': 'Yeni kurs oluşturma',
  'akademi.kurs.edit': 'Kurs düzenleme',
  'akademi.kurs.delete': 'Kurs silme',
  'akademi.report.view': 'Akademi raporları',
  'akademi.cert.manage': 'Sertifika yönetimi',
  'akademi.grade.manual': 'Manuel notlandırma (açık uçlu sorular)',
  'akademi.ifs.evaluate': 'IFS canlı değerlendirme',
  'akademi.ifs.keyuser': 'IFS key user değerlendirmesi girme',
  'ifs.view': 'IFS eğitim modülünü görüntüleme',
  'ifs.rapor.view': 'IFS raporlarını görüntüleme',
  'ifs.admin': 'IFS eğitim yapısı ve key user atamalarını yönetme',
  'ifs.evaluate': 'IFS görev/ders değerlendirmesi girme (eğitmen)',
  'ifs.keyuser': 'IFS key user değerlendirmesi girme',

  'arsiv.view': 'Arşiv görüntüleme',

  'bgys.document.view': 'BGYS doküman görüntüleme',
  'bgys.document.create': 'BGYS doküman oluşturma',
  'bgys.document.edit': 'BGYS doküman düzenleme',
  'bgys.document.approve': 'BGYS doküman onaylama',
  'bgys.risk.manage': 'Risk değerlendirmesi yönetimi',
  'bgys.audit.manage': 'İç denetim yönetimi',

  'calisanrehberi.view': 'Çalışan rehberi görüntüleme',
  'calisanrehberi.admin': 'Personel yönetimi (ekle/düzenle/sil)',

  'izin.create': 'İzin talebi oluşturma',
  'izin.approve': 'İzin onaylama (kapsam: kendi departmanı)',
  'izin.admin': 'İzin modülü tam yönetim',

  'kalibrasyon.view': 'Kalibrasyon görüntüleme',
  'kalibrasyon.admin': 'Kalibrasyon yönetimi',

  'quality.symbol.manage': 'GD&T sembol yönetimi',
  'quality.template.manage': 'Ölçüm şablon yönetimi',
  'quality.report.create': 'Ölçüm raporu açma',
  'quality.report.fill': 'Ölçüm raporu doldurma',
  'quality.report.read': 'Ölçüm raporu görüntüleme',

  'offboarding.view': 'Zimmet iade / ilişik kesme formlarını görüntüleme',
  'offboarding.create': 'Zimmet iade / ilişik kesme formu oluşturma',
  'offboarding.edit': 'Zimmet iade / ilişik kesme formu düzenleme',
  'offboarding.approve': 'Zimmet iade / ilişik kesme formu onaylama',
  'offboarding.delete': 'Zimmet iade / ilişik kesme formu silme',

  'zimmet-formu.view': 'Zimmet teslim formlarını görüntüleme (liste, tutanak, belge)',
  'zimmet-formu.create': 'Zimmet teslim formu oluşturma',
  'zimmet-formu.approve': 'Zimmet teslim formu onaylama ve ıslak imzalı belge yükleme',

  'yangin.view': 'Yangın tüpü görüntüleme',
  'yangin.qr.scan': 'QR ile periyodik kontrol kaydı',
  'yangin.admin': 'Yangın tüpü yönetimi',

  'helpdesk.ticket.create': 'IT talep oluşturma',
  'helpdesk.ticket.view': 'IT talep görüntüleme',
  'helpdesk.ticket.assign': 'Talep atama',
  'helpdesk.ticket.resolve': 'Talep çözümleme',
  'helpdesk.admin': 'Helpdesk tam yönetim',

  'costanalysis.view': 'Maliyet analizi görüntüleme',
  'costanalysis.create': 'Maliyet analizi oluşturma',
  'costanalysis.edit': 'Maliyet analizi düzenleme',
  'costanalysis.admin': 'Maliyet analizi yönetimi',

  'duyuru.view': 'Duyuru görüntüleme',
  'duyuru.create': 'Duyuru oluşturma',
  'duyuru.admin': 'Duyuru yönetimi',

  'forms.admin': 'Form modüllerini yönet (visit-reports, overtime, project-bar)',
  'forms.approve': 'Form başvurularını onayla (departman müdürü dahil)',
  'overtime.report': 'Mesai üretim performans raporunu görüntüle',
  'overtime.report.all': 'Mesai performans raporunda TÜM bölümleri gör (kapsam sınırsız)',
  'overtime.view.all': 'Mesai/vardiya formlarını salt-okuma görüntüle (TÜM formlar)',
  'overtime.view.dept': 'Mesai/vardiya formlarını salt-okuma görüntüle (yalnız kendi bölüm(ler)i)',

  'recruitment.admin': 'İşe alım tam yönetim (pozisyon/aday/talep)',
  'recruitment.view': 'İşe alım kendi departmanı görünürlük',
  'recruitment.create': 'Pozisyon/personel talebi oluşturma',
  'recruitment.candidate.view': 'Aday detay görme (CV ve değerlendirme)',

  'envanter.view':  'Envanter görüntüleme (ürün/stok/zimmet/sezon/satınalma)',
  'envanter.admin': 'Envanter tam yönetim (ürün/zimmet/stok/satınalma/tanım)',

  'ipro.view': 'IPRO tanımlarını görüntüleme (tezgah/operatör/sebep/kiosk/IFS eşleme)',
  'ipro.admin': 'IPRO tam yönetim — tanım düzenleme + kiosk cihazı oluşturma (KIOSK rollü kullanıcı hesabı üretir)',
  'ipro.takvim.yonet': 'IPRO çalışma takvimi yönetimi — İK tatil/yarım gün/mesai günü girişi (IPRO tamamı olmadan)',

  'uretim.bildirim': 'Üretim terminali — iş emri operasyonu bildirimi (IFS shop-floor)',
  'uretim.tezgah.manage': 'Tezgah tanımı ve personel atama',
  'depo.terminal.use': 'Depo el terminali erişimi',

  'qdms.view': 'Kalite Yönetim Sistemi görüntüleme (doküman/CAPA/denetim/risk/tedarikçi/eğitim/değişiklik/uygunsuzluk/şikayet)',
  'qdms.manage': 'Kalite Yönetim Sistemi yönetim — oluşturma/düzenleme/doküman onayı',
  'rma.manage': 'RMA/SMA iade formu yönetim — oluştur/düzenle/sil',
  'quality.hatakodu.manage': 'Kalite hata kodları (KAL-KYT-15) yönetim — oluştur/düzenle/pasifleştir',
  'uygunsuzluk.manage': 'Kalite uygunsuzluk formu (KAL-KYT-15) yönetim — oluştur/düzenle/sil',

  'servis.view': 'Servis yönetimi modülünü görüntüleme',
  'servis.tanim.manage': 'Servis yönetimi tanım verisi (firma/yerleşke/güzergâh) yönetimi — oluştur/düzenle/pasifleştir/geri al',

  'yilliktakvim.view': 'Yıllık çalışma takvimini görüntüleme',
  'yilliktakvim.create': 'Yıllık çalışma takvimi kaydı oluşturma',
  'yilliktakvim.edit': 'Yıllık çalışma takvimi kaydı ve checklist düzenleme',
  'yilliktakvim.cancel': 'Yıllık çalışma takvimi kaydını iptal etme',
  'yilliktakvim.complete': 'Yıllık çalışma takvimi kaydını tamamlamaya gönderme',
  'yilliktakvim.approve': 'Yıllık çalışma takvimi kaydını onaylama veya revizyon isteme',
  'yilliktakvim.attachment.manage': 'Yıllık çalışma takvimi ek ve kanıtlarını yönetme',
  'yilliktakvim.notification.manage': 'Yıllık çalışma takvimi bildirim kurallarını yönetme ve çalıştırma',
  'yilliktakvim.admin': 'Yıllık çalışma takvimi tam yönetim',
};
