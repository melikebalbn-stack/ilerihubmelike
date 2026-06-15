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

  // === RECRUITMENT (strategic-hr/recruitment) ===
  RECRUITMENT_ADMIN: 'recruitment.admin',
  RECRUITMENT_VIEW: 'recruitment.view',
  RECRUITMENT_CREATE: 'recruitment.create',
  RECRUITMENT_CANDIDATE_VIEW: 'recruitment.candidate.view',
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
  yangin: 'Yangın Tüpü',
  helpdesk: 'IT Destek',
  costanalysis: 'Maliyet Analizi',
  duyuru: 'Duyuru',
  forms: 'Form Modülleri',
  recruitment: 'İşe Alım',
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

  'recruitment.admin': 'İşe alım tam yönetim (pozisyon/aday/talep)',
  'recruitment.view': 'İşe alım kendi departmanı görünürlük',
  'recruitment.create': 'Pozisyon/personel talebi oluşturma',
  'recruitment.candidate.view': 'Aday detay görme (CV ve değerlendirme)',
};
