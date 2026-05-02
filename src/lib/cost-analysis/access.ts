// Maliyet Analizi modülüne erişim yetkisi kontrolü
// Sadece belirli kullanıcılar + SUPER_ADMIN erişebilir

const COST_ANALYSIS_ALLOWED_EMAILS = [
  'kadir.kocakoglu@ilerigroup.com',
  'hilmi.ileri@ilerigroup.com',
  'halit.ileri@ilerigroup.com',
  'eren.ileri@ilerigroup.com',
  'koray.ileri@ilerigroup.com',
  'gurhan.horbay@ilerigroup.com',
]

export function hasCostAnalysisAccess(userRole: string, userEmail?: string | null): boolean {
  if (userRole === 'SUPER_ADMIN') return true
  if (userEmail && COST_ANALYSIS_ALLOWED_EMAILS.includes(userEmail.toLowerCase())) return true
  return false
}
