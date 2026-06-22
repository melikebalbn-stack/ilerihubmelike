export const SERVIS_GUZERGAHLARI = [
  "BELEDİYE", "BATTI ÇIKTI", "ADEM YAVUZ KAPALI PAZAR (TRAFO)",
  "GEBZE", "DARICA", "DİLOVASI"
]

export const MESAI_TURLERI = [
  { value: "SATURDAY" as const, label: "Cumartesi Mesaisi", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "SUNDAY" as const, label: "Pazar Mesaisi", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "WEEKDAY_EXTRA" as const, label: "Hafta İçi Fazla Mesai", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "HOLIDAY" as const, label: "Resmi Tatil Mesaisi", color: "bg-red-100 text-red-800 border-red-200" },
]

export const OVERTIME_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  PENDING: "Onay Bekliyor",
  IN_PROGRESS: "Onay Sürecinde",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal Edildi",
}

export const OVERTIME_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
}
