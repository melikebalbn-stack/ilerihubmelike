// Kiosk Faz 2c — tezgah atama ekranı paylaşılan tipleri.

export interface DeptOption {
  id: string
  name: string
}

export interface PersonnelOption {
  id: string
  adSoyad: string
  sicilNo: string | null
  bolum: string
}

export interface Workstation {
  id: string
  kod: string
  ad: string
  ifsWorkCenterKod: string
  departmentId: string
  isActive: boolean
  department: { id: string; name: string } | null
  _count: { personnel: number }
}

/** GET /api/personnel/[id]/workstations döner. */
export interface WorkstationLite {
  id: string
  kod: string
  ad: string
  department: { id: string; name: string } | null
}
