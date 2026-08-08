"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { canAccessPersonnel } from "@/lib/auth/personnel-access"
import { canAccessKalite } from "@/lib/auth/kalite-access"
import {
  Home,
  Users,
  Bell,
  FileText,
  Wrench,
  Flame,
  Clock,
  Headphones,
  Settings,
  GraduationCap,
  CalendarCheck,
  Lightbulb,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  Cog,
  Megaphone,
  MessageSquare,
  BarChart3,
  Activity,
  Radio,
  Factory,
  Map,
  MonitorSmartphone,
  Link2,
  Shield,
  FileCheck,
  AlertTriangle,
  ClipboardCheck,
  Scale,
  Truck,
  BookOpen,
  GitBranch,
  FileWarning,
  MessageCircle,
  HardDrive,
  Target,
  UserCheck,
  Briefcase,
  Network,
  ClipboardList,
  LogIn,
  X,
  Package,
  Boxes,
  Server,
  Calendar,
  Calculator,
  HelpCircle,
  ShieldAlert,
  UserCog,
  FlaskConical,
  Archive,
  ShieldCheck,
  ServerCog,
  ArrowRightLeft,
  UserMinus,
  Shapes,
  Search,
  Pin,
  PinOff,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect, createContext, useContext } from "react"

/* ───────── Sidebar collapse/pin durumu (masaüstü) ─────────
 * Sidebar + (dashboard)/layout içerik ofseti bu context'i paylaşır.
 *  - collapsed: dar (yalnız ikon) mod   [localStorage: sidebar:collapsed]
 *  - pinned:    sabit açık; pinsizken hover ile geçici açılır [localStorage: sidebar:pinned]
 * Hidrasyon uyumsuzluğunu önlemek için varsayılanlarla başlar, localStorage useEffect'te okunur. */
type SidebarCtx = {
  collapsed: boolean
  pinned: boolean
  hovering: boolean
  hydrated: boolean
  setCollapsed: (v: boolean) => void
  setPinned: (v: boolean) => void
  setHovering: (v: boolean) => void
}
const SidebarStateContext = createContext<SidebarCtx | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false)
  const [pinned, setPinnedState] = useState(true)
  const [hovering, setHovering] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const c = localStorage.getItem("sidebar:collapsed")
      const p = localStorage.getItem("sidebar:pinned")
      if (c !== null) setCollapsedState(c === "true")
      if (p !== null) setPinnedState(p === "true")
    } catch {
      /* localStorage erişilemezse varsayılanlar */
    }
    setHydrated(true)
  }, [])

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v)
    try { localStorage.setItem("sidebar:collapsed", String(v)) } catch {}
  }
  const setPinned = (v: boolean) => {
    setPinnedState(v)
    try { localStorage.setItem("sidebar:pinned", String(v)) } catch {}
  }

  return (
    <SidebarStateContext.Provider
      value={{ collapsed, pinned, hovering, hydrated, setCollapsed, setPinned, setHovering }}
    >
      {children}
    </SidebarStateContext.Provider>
  )
}

export function useSidebar(): SidebarCtx {
  const ctx = useContext(SidebarStateContext)
  if (!ctx) throw new Error("useSidebar SidebarProvider içinde kullanılmalı")
  return ctx
}

// Ana menü öğeleri
const mainMenuItems = [
  { name: "Dashboard", icon: Home, href: "/dashboard", roles: ["*"] },
  { name: "Mesajlar", icon: MessageSquare, href: "/messages", roles: ["*"] },
  { name: "Duyurular", icon: Megaphone, href: "/announcements", roles: ["*"] },
  { name: "Çalışan Rehberi", icon: Users, href: "/employees", roles: ["*"] },
  { name: "Öneri Sistemi", icon: Lightbulb, href: "/suggestions", roles: ["*"] },
  { name: "Maliyet Analizi", icon: Calculator, href: "/cost-analysis", roles: ["SUPER_ADMIN"], emails: ["kadir.kocakoglu@ilerigroup.com", "hilmi.ileri@ilerigroup.com", "halit.ileri@ilerigroup.com", "eren.ileri@ilerigroup.com", "koray.ileri@ilerigroup.com", "gurhan.horbay@ilerigroup.com"] },
  { name: "Planlı Görevler", icon: CalendarCheck, href: "/tasks", roles: ["*"] },
  // { name: "SSS", icon: HelpCircle, href: "/faq", roles: ["*"] }, // Şimdilik gizli
  // { name: "Takvim", icon: Calendar, href: "/calendar", roles: ["*"] }, // Şimdilik gizli
  { name: "Akademi", icon: GraduationCap, href: "/akademi", roles: ["*"] },
  { name: "Anketler", icon: ClipboardList, href: "/surveys", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR", "IK"] },
]

// Formlar alt menüsü
const formsMenuItems = [
  { name: "Ziyaret Raporları", icon: FileText, href: "/forms/visit-reports", roles: ["*"] },
  { name: "Toplantı Raporu", icon: Calendar, href: "/meetings", roles: ["*"] },
  { name: "Mesai Formu", icon: Clock, href: "/forms/overtime", roles: ["*"] },
  { name: "Vardiya Formu", icon: Clock, href: "/forms/vardiya", roles: ["*"] },
  { name: "Mesai Performansı", icon: BarChart3, href: "/forms/overtime/performans", roles: ["*"] },
  // Görünürlük diğer form kalemleriyle aynı desende (roles: "*"); asıl erişim
  // layout guard + API'de (getBulkCardScanAccess). Statik dept filtresi GRI
  // yaka kullanıcıları yanlış gizleyeceğinden burada rol/dept ile daraltılmaz.
  { name: "Toplu Kart Okutamama", icon: ClipboardList, href: "/forms/toplu-kart-okutamama", roles: ["*"] },
  // İş Analizi Formu: oturumu olan herkes kendi formunu doldurur (roles: "*").
  { name: "İş Analizi Formu", icon: ClipboardList, href: "/strategic-hr/is-analizi", roles: ["*"] },
  // RMA/SMA İade Formu (KAL-KYT-16): herkes görür; yazma yetkisi sayfa/API'de (canManageRma).
  { name: "RMA/SMA İade Formu", icon: Package, href: "/kalite/rma", roles: ["*"] },
  // { name: "Proje Bar", icon: BarChart3, href: "/forms/project-bar", roles: ["*"] }, // Şimdilik gizli
]

// ILERI Teknik alt menüsü
const teknikMenuItems = [
  { name: "Yangın Güvenliği", icon: Flame, href: "/fire-safety", roles: ["QUALITY_MANAGER", "ADMIN"] },
  { name: "Tezgah Bakım", icon: Factory, href: "/maintenance", roles: ["*"] },
  { name: "Arşiv", icon: Archive, href: "/arsiv/koli", roles: ["*"] },
  { name: "IT Raporları", icon: BarChart3, href: "/it-reports", roles: ["IT_MANAGER", "ADMIN"] },
]

// IPRO — MAS üretim takip modülü yönetimi (tanımlar + kiosk cihazları)
// Sidebar rol tabanlı; permission (ipro.view/ipro.admin) sayfa ve API guard'larında.
// Roller ipro.view eşlemesiyle hizalı: super-admin/admin/it-admin/departman-muduru.
const iproMenuItems = [
  { name: "İzleme Panosu", icon: Activity, href: "/ipro/izleme", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER", "DEPT_HEAD"] },
  { name: "Fabrika Haritası", icon: Map, href: "/ipro/harita", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER", "DEPT_HEAD"], note: "canlı" },
  { name: "Tezgahlar", icon: Factory, href: "/ipro/tezgahlar", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER", "DEPT_HEAD"] },
  { name: "Operatör Eşlemeleri", icon: Users, href: "/ipro/operator-eslemeleri", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER", "DEPT_HEAD"] },
  { name: "Hurda / Duruş Sebepleri", icon: ClipboardList, href: "/ipro/sebepler", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER", "DEPT_HEAD"] },
  { name: "Vardiya & Takvim", icon: CalendarDays, href: "/ipro/takvim", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER", "HR_MANAGER"] },
  { name: "Kiosk Cihazları", icon: MonitorSmartphone, href: "/ipro/kiosklar", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER"] },
  { name: "IFS Eşlemeleri", icon: Link2, href: "/ipro/ifs-eslemeleri", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER"] },
  { name: "Sinyal Takibi", icon: Radio, href: "/ipro/sinyal", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER"] },
]

// Stratejik IK alt menüsü
// Erişim: İnsan Varlıkları departmanı (tam erişim) + Departman müdürleri (kendi departmanları)
const strategicHrMenuItems = [
  { name: "Yetenek Yönetimi", icon: Target, href: "/talent-management", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
  { name: "Yedekleme Planlaması", icon: UserCheck, href: "/strategic-hr/succession-planning", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
  { name: "Performans Yönetimi", icon: Target, href: "/strategic-hr/performance", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
  { name: "İşe Alım", icon: Briefcase, href: "/strategic-hr/recruitment", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
  { name: "Envanter", icon: Boxes, href: "/envanter", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
  { name: "Organizasyon Şeması", icon: Network, href: "/strategic-hr/org-chart", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
  { name: "Yıllık Çalışma Takvimi", icon: CalendarDays, href: "/strategic-hr/yillik-calisma-takvimi", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
]

// OFFB-3: İlişik Kesme / Zimmet İade — İK grubu girişi.
// Görünür rol kümesi == offboarding.view izninin rol kümesi (OFFB-1 seed:
// super-admin, hr-yoneticisi, it-admin, departman-muduru). UserRoleEnum
// eşlemesi migrate-user-roles.ts'ten: super-admin→SUPER_ADMIN,
// hr-yoneticisi→HR_MANAGER, it-admin→IT_MANAGER, departman-muduru→DEPT_HEAD
// VE SUPERVISOR (ikisi de departman-muduru'ya maplenir → view erişimi var).
// ADMIN dahil DEĞİL (admin slug'ı offboarding.view'a sahip değil).
// departments[] clause'u YOK: filterItems OR değerlendirir; İK-dept'teki
// view-yetkisiz roller (EMPLOYEE vb.) görmesin diye salt rol-bazlı gating.
const offboardingMenuItems = [
  { name: "İlişik Kesme", icon: LogOut, href: "/offboarding", roles: ["SUPER_ADMIN", "HR_MANAGER", "IT_MANAGER", "DEPT_HEAD", "SUPERVISOR"] },
]

// Personel yönetimi öğeleri — hepsi canSeeIk kapısıyla gösterilir. Önceden JSX
// içinde satır satır gömülüydü; menü aramasında da çıkabilmeleri için diziye
// alındı (render davranışı birebir aynı: aynı sırada, aynı canSeeIk koşuluyla).
const personnelMenuItems = [
  { name: "Personel Yönetimi", icon: UserCog, href: "/personnel", roles: ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR", "IK"] },
  { name: "İK Raporları", icon: BarChart3, href: "/personnel/reports", roles: ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR", "IK"] },
  { name: "Bölüm Değişiklikleri", icon: ArrowRightLeft, href: "/personnel/department-transfers", roles: ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR", "IK"] },
  { name: "Ayrılan Personel", icon: UserMinus, href: "/personnel/leavers", roles: ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR", "IK"] },
]

// Kalite Yönetim Sistemi (KYS) alt menüsü
const qdmsMenuItems = [
  { name: "Doküman Kontrolü", icon: FileCheck, href: "/qdms/documents", roles: [] },
  { name: "CAPA", icon: AlertTriangle, href: "/qdms/capa", roles: [] },
  { name: "İç Denetim", icon: ClipboardCheck, href: "/qdms/audits", roles: [] },
  { name: "Risk Yönetimi", icon: Scale, href: "/qdms/risks", roles: [] },
  { name: "Tedarikçi Yönetimi", icon: Truck, href: "/qdms/suppliers", roles: [] },
  { name: "Eğitim Yönetimi", icon: BookOpen, href: "/qdms/training", roles: [] },
  { name: "Değişiklik Yönetimi", icon: GitBranch, href: "/qdms/changes", roles: [] },
  { name: "Uygunsuzluk", icon: FileWarning, href: "/qdms/ncr", roles: [] },
  { name: "Müşteri Şikayetleri", icon: MessageCircle, href: "/qdms/complaints", roles: [] },
]

// Kalite — ölçüm/kalibrasyon modülleri (İleri Teknik'ten taşındı, "Kalite" üst grubunun doğrudan altında)
const kaliteMenuItems = [
  { name: "Kalibrasyon", icon: Wrench, href: "/calibration", roles: ["*"] },
  { name: "Ölçüm Şablonları", icon: ClipboardList, href: "/kalite/sablonlar", roles: ["QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"] },
  { name: "Ölçüm Raporları", icon: ClipboardCheck, href: "/kalite/raporlar", roles: ["QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"] },
  { name: "Semboller", icon: Shapes, href: "/kalite/semboller", roles: ["QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"] },
]

// Denetimler alt menüsü (ISO 27001 dahil)
// Kalite Sistem Departmanı tüm ISO 27001 modülünü görebilir (Sızma Testleri hariç)
const ISO27001_DEPTS = ["Kalite Sistem Departmanı", "Kalite", "Quality"]

const auditsMenuItems = [
  { name: "ISO 27001", icon: Shield, href: "/iso27001", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS, isSubmenu: true },
]

// ISO 27001 Bilgi Güvenliği Yönetim Sistemi alt menüsü
const iso27001MenuItems = [
  { name: "Dashboard", icon: Home, href: "/iso27001", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "SoA (Uygulanabilirlik)", icon: FileCheck, href: "/iso27001/soa", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Dokümanlar", icon: FileText, href: "/iso27001/documents", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Kontroller", icon: ClipboardCheck, href: "/iso27001/controls", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Risk Analizi", icon: Scale, href: "/iso27001/risks", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Olay Yönetimi", icon: AlertTriangle, href: "/iso27001/incidents", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Varlık Envanteri", icon: Server, href: "/iso27001/assets", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Eğitimler", icon: GraduationCap, href: "/iso27001/trainings", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Tedarikçi Değerlendirme", icon: Truck, href: "/iso27001/suppliers", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "İç Denetim", icon: ClipboardList, href: "/iso27001/audits", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Denetim Programı", icon: Calendar, href: "/iso27001/audit-program", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Yönetim Gözden Geçirme", icon: Target, href: "/iso27001/management-review", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Envanter Gözden Geçirme", icon: ClipboardCheck, href: "/iso27001/envanter-gozden-gecirme", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
  { name: "Sızma Testleri", icon: ShieldAlert, href: "/iso27001/penetration-tests", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"] },
  { name: "Denetçi Paketi", icon: Package, href: "/iso27001/audit-package", roles: ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ISO27001_DEPTS },
]

// Sandbox modülleri (sadece SUPER_ADMIN)
const sandboxMenuItems = [
  { name: "Elif Sandbox", icon: FlaskConical, href: "/sandbox/elif", roles: ["SUPER_ADMIN"], ownerEmail: "elif.yildirim@ilerigroup.com" },
  { name: "Melike Sandbox", icon: FlaskConical, href: "/sandbox/melike", roles: ["SUPER_ADMIN"], ownerEmail: "melike.balaban@ilerigroup.com" },
  { name: "Nurgül Sandbox", icon: FlaskConical, href: "/sandbox/nurgul", roles: ["SUPER_ADMIN"], ownerEmail: "nurgul.tastan@ilerigroup.com" },
]

// Sistem Geliştirme alt menüsü (admin yetkilendirme + AD)
// AD Eşleşme ve AD Grup Mapping: admin.system.manage permission'a uygun roller (super-admin + admin + it-admin)
const sistemGelistirmeMenuItems = [
  { name: "Yetkilendirme", icon: ShieldCheck, href: "/settings/roller", roles: ["SUPER_ADMIN"] },
  { name: "AD Eşleşme", icon: ShieldCheck, href: "/settings/personnel-ad-reconcile", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER"] },
  { name: "AD Grup Mapping", icon: ShieldCheck, href: "/settings/azure-ad-mapping", roles: ["SUPER_ADMIN", "ADMIN", "IT_MANAGER"] },
  { name: "Login Aktiviteleri", icon: LogIn, href: "/login-logs", roles: ["IT_MANAGER", "ADMIN", "SUPER_ADMIN"] },
  { name: "Yedekleme", icon: HardDrive, href: "/backups", roles: ["IT_MANAGER", "ADMIN", "SUPER_ADMIN"] },
]

// Alt menü öğeleri
const bottomMenuItems = [
  { name: "IT Destek", icon: Headphones, href: "/it-support", roles: ["*"] },
  { name: "Ayarlar", icon: Settings, href: "/settings", roles: ["ADMIN", "SUPER_ADMIN", "QUALITY_MANAGER"], departments: ["Kalite", "Laboratuvar"] },
]

// ── Menü araması ────────────────────────────────────────────────────────────
// Saf yardımcılar: bileşene bağımlı değil, ileride ⌘K komut paletine olduğu gibi
// taşınabilsin diye modül seviyesinde ve export edilebilir halde tutuldu.

/** Türkçe-duyarlı normalize: "İş Analizi" ↔ "is analizi", "Ölçüm" ↔ "olcum",
 *  "Çalışan" ↔ "calisan".
 *  1) toLocaleLowerCase('tr-TR') — İ→i, I→ı eşlemesini doğru yapar.
 *  2) ı→i — DİKKAT: noktasız ı (U+0131) AYRI bir harftir, NFD ile AYRIŞMAZ,
 *     dolayısıyla (3)'teki diakritik strip ona dokunmaz. Bu satır olmadan
 *     "calisan"/"sizma"/"yangin" aramaları "Çalışan"/"Sızma"/"Yangın" ile
 *     eşleşmiyordu (gerçek menü etiketleriyle test edildi).
 *  3) NFD + combining-mark strip — ç/ğ/ü/ş/ö diakritiğini düşürür. */
export function normalizeTr(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/\u0131/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

type SearchableItem = {
  name: string
  icon: typeof Home
  href: string
  /** Sonuç satırında gösterilen küçük grup etiketi ("Formlar", "IPRO" …) */
  group: string
}

/** Yetki filtresinden GEÇMİŞ listeleri düz tek listeye indirger.
 *  href'e göre tekilleştirir (ör. /iso27001 hem "Denetimler" hem "ISO 27001"
 *  altında geçiyor); ilk görülen grup etiketi kazanır. */
function flattenForSearch(
  groups: { group: string; items: { name: string; icon: typeof Home; href: string }[] }[]
): SearchableItem[] {
  const seen = new Set<string>()
  const out: SearchableItem[] = []
  for (const g of groups) {
    for (const it of g.items) {
      if (seen.has(it.href)) continue
      seen.add(it.href)
      out.push({ name: it.name, icon: it.icon, href: it.href, group: g.group })
    }
  }
  return out
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [teknikOpen, setTeknikOpen] = useState(false)
  const [iproOpen, setIproOpen] = useState(false)
  const [qdmsOpen, setQdmsOpen] = useState(false)
  const [kaliteYonetimOpen, setKaliteYonetimOpen] = useState(false)
  const [ikOpen, setIkOpen] = useState(false)
  const [strategicHrOpen, setStrategicHrOpen] = useState(false)
  const [auditsOpen, setAuditsOpen] = useState(false)
  const [iso27001Open, setIso27001Open] = useState(false)
  const [formsOpen, setFormsOpen] = useState(false)
  const [sistemGelistirmeOpen, setSistemGelistirmeOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  // Menü araması. Boşken normal grup ağacı render edilir (hiçbir şey değişmez);
  // doluyken ağaç gizlenip düz sonuç listesi gösterilir. Grupların açık/kapalı
  // durumu bu yüzden korunur — ağaca dokunulmuyor, sadece gösterilmiyor.
  const [searchQuery, setSearchQuery] = useState("")
  // İş Analizi menü bayrakları — SUNUCUDAN (amir DB sorgusu + ik OR mantığı iaRolCozumle'de).
  const [iaFlags, setIaFlags] = useState<{ amir: boolean; ik: boolean }>({ amir: false, ik: false })
  const [kadroTalepAcabilir, setKadroTalepAcabilir] = useState(false)

  // Collapse/pin (yalnız masaüstü; mobil sheet'te isOpen=true → her zaman geniş)
  const { collapsed, pinned, hovering, setCollapsed, setPinned, setHovering } = useSidebar()
  const isMobile = !!isOpen
  // expanded = etiketlerin görüneceği geniş mod. Pinliyse collapsed'e bağlı; pinsizken hover ile.
  const expanded = isMobile ? true : pinned ? !collapsed : hovering

  // Pathname değiştiğinde ilgili menüyü otomatik aç
  useEffect(() => {
    if (pathname.startsWith('/iso27001')) {
      setQdmsOpen(true)
      setKaliteYonetimOpen(true)
      setAuditsOpen(true)
      setIso27001Open(true)
    }
    if (pathname.startsWith('/ipro')) {
      setIproOpen(true)
    }
    if (pathname.startsWith('/qdms')) {
      setQdmsOpen(true)
      setKaliteYonetimOpen(true)
    }
    if (pathname.startsWith('/calibration') || pathname.startsWith('/kalite')) {
      setQdmsOpen(true)
    }
    if (pathname.startsWith('/strategic-hr') || pathname.startsWith('/talent-management') || pathname.startsWith('/organization') || pathname.startsWith('/personnel')) {
      setIkOpen(true)
      if (pathname.startsWith('/strategic-hr') || pathname.startsWith('/talent-management') || pathname.startsWith('/organization')) {
        setStrategicHrOpen(true)
      }
    }
    if (pathname.startsWith('/fire-safety') ||
        pathname.startsWith('/maintenance') || pathname.startsWith('/it-reports') ||
        pathname.startsWith('/arsiv')) {
      setTeknikOpen(true)
    }
    if (pathname.startsWith('/forms') || pathname.startsWith('/meetings')) {
      setFormsOpen(true)
    }
    if (
      pathname.startsWith('/settings/roller') ||
      pathname.startsWith('/settings/personnel-ad-reconcile') ||
      pathname.startsWith('/settings/azure-ad-mapping') ||
      pathname.startsWith('/settings/kullanici-rolleri') ||
      pathname.startsWith('/settings/permissions') ||
      pathname.startsWith('/login-logs') ||
      pathname.startsWith('/backups')
    ) {
      setSistemGelistirmeOpen(true)
    }
  }, [pathname])

  // Okunmamis mesaj sayisini al
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await fetch('/api/messages/unread-count')
        if (res.ok) {
          const data = await res.json()
          setUnreadMessages(data.unreadCount || 0)
        }
      } catch (error) {
        console.error('Okunmamis mesaj sayisi alinamadi:', error)
      }
    }

    if (session?.user) {
      fetchUnreadCount()
      // Her 30 saniyede bir kontrol et
      const interval = setInterval(fetchUnreadCount, 30000)
      return () => clearInterval(interval)
    }
  }, [session])

  // İş Analizi menü bayraklarını sunucudan çek (amir/ik). Client'ta yetki HESAPLANMAZ.
  useEffect(() => {
    if (!session?.user) return
    fetch('/api/strategic-hr/is-analizi/menu-bayrak')
      .then(async (r) => {
        if (!r.ok) return
        const d = await r.json()
        setIaFlags({ amir: !!d.amir, ik: !!d.ik })
      })
      .catch(() => {})
  }, [session])

  // Kadro talep menü bayrağını sunucudan çek (müdür/müdür-yrd/İK). Client'ta yetki HESAPLANMAZ.
  useEffect(() => {
    if (!session?.user) return
    fetch('/api/kadro-talep/menu-bayrak')
      .then(async (r) => {
        if (!r.ok) return
        const d = await r.json()
        setKadroTalepAcabilir(!!d.talepAcabilir)
      })
      .catch(() => {})
  }, [session])

  // Kullanıcı rolüne göre menü filtreleme
  const userRole = session?.user?.role || 'USER'
  const userDepartment = session?.user?.department || ''
  // İV (Personel) menü görünürlüğü — sayfa guard'ıyla AYNI helper (personnel-access.ts):
  // admin rol VEYA İnsan Varlıkları departmanı. "Görünüyorsa girebilir" tutarlılığı.
  const canSeeIk = canAccessPersonnel(userRole, userDepartment)
  const userPermissions = session?.user?.permissions || []
  const userOu = session?.user?.ou || ''
  // QDMS (Kalite Yönetim) menü görünürlüğü — layout + API guard'ıyla AYNI koşul:
  // kalite ekibi/admin (canAccessKalite) VEYA qdms.view permission.
  const canSeeQdms = canAccessKalite(userRole, userDepartment, userOu) || userPermissions.includes('qdms.view')

  const filterItems = (items: typeof mainMenuItems) => items.filter(item => {
    // Permission tabanlı erişim: item'da `permission` varsa TEK belirleyici
    // odur (rol/departman/e-posta clause'ları değerlendirilmez). Menü
    // görünürlüğü kozmetiktir; asıl zorlama sayfa ve API guard'larındadır.
    const itemPermission = (item as { permission?: string }).permission
    if (itemPermission) return userPermissions.includes(itemPermission)

    if (item.roles.includes('*')) return true
    if (item.roles.includes('SUPER_ADMIN') && userRole === 'SUPER_ADMIN') return true
    if (item.roles.includes(userRole)) return true

    // E-posta bazlı erişim kontrolü
    const itemEmails = (item as { emails?: string[] }).emails || []
    if (itemEmails.length > 0 && session?.user?.email &&
      itemEmails.some(e => e.toLowerCase() === session.user.email!.toLowerCase())
    ) return true

    // Departman bazlı erişim kontrolü
    const itemDepartments = (item as { departments?: string[] }).departments || []
    if (itemDepartments.length > 0 && itemDepartments.some(dept =>
      userDepartment.toLowerCase().includes(dept.toLowerCase())
    )) return true

    return false
  })

  // Stratejik IK için özel filtreleme
  // İnsan Varlıkları departmanı veya yetkili roller tam erişim
  // Departman müdürleri (DEPT_HEAD) de erişebilir (API'de departman filtresi uygulanacak)
  const filterStrategicHrItems = (items: typeof strategicHrMenuItems) => items.filter(item => {
    // Admin roller her zaman görebilir
    if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'IT_MANAGER'].includes(userRole)) return true

    // İnsan Varlıkları departmanındaki herkes görebilir
    const hrDepartments = item.departments || []
    if (hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept.toLowerCase()))) return true

    // Departman müdürleri (DEPT_HEAD) kendi departmanları için görebilir
    if (userRole === 'DEPT_HEAD') return true

    return false
  })

  const filteredMainItems = filterItems(mainMenuItems)
  const filteredTeknikItems = filterItems(teknikMenuItems)
  const filteredIproItems = filterItems(iproMenuItems)
  // QDMS öğeleri artık filterItems (roles) ile değil, canSeeQdms ile gate'lenir
  // (koşul layout/API guard'ıyla birebir). roles alanı vestigial.
  const filteredQdmsItems = canSeeQdms ? qdmsMenuItems : []
  const filteredKaliteItems = filterItems(kaliteMenuItems)
  const filteredAuditsItems = filterItems(auditsMenuItems)
  const filteredIso27001Items = filterItems(iso27001MenuItems)
  // İş Analizi koşullu öğeler — SUNUCU bayrağı (iaFlags) ile; client'ta yetki hesaplanmaz.
  const iaAmirItem = { name: "Onayımdaki İş Analizleri", icon: UserCheck, href: "/strategic-hr/is-analizi/onaylarim", roles: ["*"] }
  const iaIkItem = { name: "İş Analizi Onayları", icon: ClipboardCheck, href: "/strategic-hr/is-analizi/ik-onay", roles: ["*"] }

  const filteredStrategicHrItems = [
    ...filterStrategicHrItems(strategicHrMenuItems),
    ...(iaFlags.ik ? [iaIkItem] : []),
  ]
  const filteredOffboardingItems = filterItems(offboardingMenuItems)
  // İV grubu görünürlüğü: en az bir alt öğe görünüyorsa başlık gösterilir
  // (4 personnel öğesi canSeeIk ile; offboarding + strategicHr kendi kitleleriyle).
  const showIkGroup =
    canSeeIk || filteredOffboardingItems.length > 0 || filteredStrategicHrItems.length > 0
  // Kadro talep — SUNUCU bayrağı (kadroTalepAcabilir) ile; client'ta yetki hesaplanmaz.
  // Link recruitment sayfasına (varsayılan "requests"/kadro talep sekmesine düşer).
  const kadroTalepItem = { name: "Personel Talep Formu", icon: FileText, href: "/strategic-hr/kadro-talep", roles: ["*"] }
  const filteredFormsItems = [
    ...filterItems(formsMenuItems),
    ...(iaFlags.amir ? [iaAmirItem] : []),
    ...(kadroTalepAcabilir ? [kadroTalepItem] : []),
  ]
  const filteredSistemGelistirmeItems = filterItems(sistemGelistirmeMenuItems)
  const filteredBottomItems = filterItems(bottomMenuItems)

  // Sandbox: SUPER_ADMIN tümünü görür, diğerleri sadece kendi sandbox'ını
  const filteredSandboxItems = sandboxMenuItems.filter(item => {
    if (userRole === 'SUPER_ADMIN') return true
    if (item.ownerEmail && session?.user?.email?.toLowerCase() === item.ownerEmail.toLowerCase()) return true
    return false
  })

  // Personel öğeleri — tümü canSeeIk kapısında (JSX'teki eski satır-satır
  // `canSeeIk && renderMenuItem(...)` ile birebir aynı sonuç).
  const filteredPersonnelItems = canSeeIk ? personnelMenuItems : []

  // ── Menü araması ──────────────────────────────────────────────────────────
  // KAYNAK: yalnızca YETKİ FİLTRESİNDEN GEÇMİŞ listeler. Böylece kullanıcının
  // ağaçta göremediği bir öğe aramada da çıkmaz. QDMS (canSeeQdms), Stratejik İK
  // (filterStrategicHrItems), Sandbox (ownerEmail) ve İK (canSeeIk) özel
  // kapılarının çıktıları olduğu gibi kullanılıyor — kural burada TEKRARLANMIYOR.
  const searchableItems = flattenForSearch([
    { group: "Ana Menü", items: filteredMainItems },
    { group: "Formlar", items: filteredFormsItems },
    { group: "İnsan Varlıkları", items: filteredPersonnelItems },
    { group: "İnsan Varlıkları", items: filteredOffboardingItems },
    { group: "Stratejik İK", items: filteredStrategicHrItems },
    { group: "Kalite", items: filteredKaliteItems },
    { group: "Kalite Yönetim Sistemi", items: filteredQdmsItems },
    { group: "Denetimler", items: filteredAuditsItems },
    { group: "ISO 27001", items: filteredIso27001Items },
    { group: "İleri Teknik", items: filteredTeknikItems },
    { group: "IPRO", items: filteredIproItems },
    { group: "Sistem Geliştirme", items: filteredSistemGelistirmeItems },
    { group: "Diğer", items: filteredBottomItems },
    { group: "Sandbox", items: filteredSandboxItems },
  ])

  const normalizedQuery = normalizeTr(searchQuery.trim())
  // `expanded` şartı: dar modda arama kutusu render edilmiyor. O şart olmasaydı
  // kullanıcı arama yapıp sidebar'ı daraltınca input kaybolur, arama aktif kalır
  // ve ağaç gizli olduğu için menü kilitlenirdi. Dar mod = her zaman normal ağaç.
  const isSearching = expanded && normalizedQuery.length > 0
  const searchResults = isSearching
    ? searchableItems.filter(item => normalizeTr(item.name).includes(normalizedQuery))
    : []

  // Teknik menüsünde aktif sayfa var mı kontrol et (IT Raporları dahil)
  const isTeknikActive = teknikMenuItems.some(item =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname === '/it-reports' || pathname.startsWith('/it-reports/')

  // IPRO menüsünde aktif sayfa var mı
  const isIproActive = pathname === '/ipro' || pathname.startsWith('/ipro/')

  // "Kalite Yönetim" alt-grubu (KYS + Denetimler/ISO 27001) aktif mi
  const isKaliteYonetimActive = qdmsMenuItems.some(item =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname.startsWith('/qdms/') || pathname.startsWith('/iso27001/')
  // "Kalite" üst grubu: alt-grup + ölçüm/kalibrasyon modülleri
  const isQdmsActive = isKaliteYonetimActive ||
    pathname.startsWith('/calibration') || pathname.startsWith('/kalite')

  // Denetimler menüsünde aktif sayfa var mı kontrol et
  const isAuditsActive = pathname.startsWith('/iso27001/')

  // İK menüsünde aktif sayfa var mı kontrol et
  const isIkActive = pathname === '/strategic-hr/bluecollar-users' || pathname.startsWith('/strategic-hr/bluecollar-users/') ||
    strategicHrMenuItems.some(item =>
      pathname === item.href || pathname.startsWith(item.href + "/")
    ) || pathname.startsWith('/talent-management/')

  // Stratejik IK menüsünde aktif sayfa var mı kontrol et
  const isStrategicHrActive = strategicHrMenuItems.some(item =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname.startsWith('/talent-management/')

  // ISO 27001 menüsünde aktif sayfa var mı kontrol et
  const isIso27001Active = iso27001MenuItems.some(item =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname.startsWith('/iso27001/')

  // Formlar menüsünde aktif sayfa var mı kontrol et
  const isFormsActive = formsMenuItems.some(item =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname.startsWith('/forms/') || pathname.startsWith('/meetings/')

  // Sistem Geliştirme menüsünde aktif sayfa var mı kontrol et (Login Aktiviteleri + Yedekleme dahil)
  const isSistemGelistirmeActive = sistemGelistirmeMenuItems.some(item =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  ) ||
    pathname.startsWith('/settings/kullanici-rolleri') ||
    pathname.startsWith('/settings/permissions') ||
    pathname.startsWith('/login-logs') ||
    pathname.startsWith('/backups')

  // Menü öğesi render fonksiyonu
  const renderMenuItem = (item: typeof mainMenuItems[0], indent = false) => {
    const Icon = item.icon
    // Dashboard için özel kontrol: sadece tam eşleşme, diğer /dashboard ile başlayan yolları hariç tut
    // Örn: /iso27001 altındaki Dashboard değil, sadece ana /dashboard aktif olmalı
    let isActive = false
    if (item.href === "/dashboard") {
      // Ana dashboard sadece tam eşleşmede aktif
      isActive = pathname === "/dashboard"
    } else if (item.href === "/iso27001") {
      // ISO 27001 Dashboard sadece tam eşleşmede aktif (alt sayfalar için değil)
      isActive = pathname === "/iso27001"
    } else if (item.href === "/personnel") {
      // Personel Yönetimi: sadece tam eşleşme, /personnel/reports gibi alt sayfalar hariç
      isActive = pathname === "/personnel"
    } else {
      // Diğer menüler normal davranış
      isActive = pathname === item.href || pathname.startsWith(item.href + "/")
    }
    const isExternal = 'external' in item && (item as { external?: boolean }).external
    const highlight = 'highlight' in item ? (item as { highlight?: string }).highlight : null

    if (isExternal) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          title={item.name}
          className={cn(
            "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
            "text-white/50 hover:text-white/90 hover:bg-white/[0.07]",
            indent && "ml-4"
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="flex-1">
            {highlight ? (
              <>
                {item.name.replace(highlight, '')}<span className="text-primary">{highlight}</span>
              </>
            ) : (
              item.name
            )}
          </span>
        </a>
      )
    }

    const handleClick = (e: React.MouseEvent) => {
      // Mobilde menü öğesine tıklandığında sidebar'ı kapat
      if (onClose) {
        onClose()
      }
      if (pathname.startsWith(item.href)) {
        e.preventDefault()
        window.location.href = item.href
      }
    }

    // Mesajlar icin badge goster
    const showBadge = item.href === "/messages" && unreadMessages > 0
    // Kesif/temsili sayfalar icin kucuk not etiketi (or. "temsili veri")
    const note = 'note' in item ? (item as { note?: string }).note : null

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        onClick={handleClick}
        title={item.name}
        className={cn(
          "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-teal-600 text-white shadow-[0_2px_8px_rgba(13,148,136,0.4)]"
            : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]",
          indent && "ml-4"
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="flex-1">{item.name}</span>
        {note && (
          <span className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-300/80 bg-emerald-400/10">
            {note}
          </span>
        )}
        {showBadge && (
          <span className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
            isActive
              ? "bg-white text-teal-600"
              : "bg-rose-500 text-white"
          )}>
            {unreadMessages > 99 ? "99+" : unreadMessages}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div
      onMouseEnter={!isMobile && !pinned ? () => setHovering(true) : undefined}
      onMouseLeave={!isMobile && !pinned ? () => setHovering(false) : undefined}
      className={cn(
        "flex-col border-r border-white/[0.07] bg-slate-900 flex h-full transition-[width] duration-200",
        // Masaüstü: sabit sidebar; genişlik collapse/pin durumuna göre
        "max-lg:hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 w-64",
        !isMobile && (expanded ? "lg:w-64" : "lg:w-16"),
        // Dar mod: etiketleri gizle, ikonları ortala, grup chevron'larını gizle
        // Dar mod: YALNIZ nav içi link/buton etiketlerini gizle (nav'ın kendi flex-1'ini
        // DEĞİL — aksi halde nav gizlenip dikey akış bozulur), ikonları ortala, chevron gizle
        !isMobile && !expanded && "[&_nav_a_.flex-1]:hidden [&_nav_button_.flex-1]:hidden [&_nav_a]:justify-center [&_nav_button]:justify-center [&_nav_button>svg:last-child]:hidden",
        // Sheet içindeyse (isOpen=true) her zaman göster, fixed kullanma
        isOpen && "!flex !max-lg:flex !relative !inset-auto !z-auto !w-64"
      )}
    >
      {/* Logo + masaüstü collapse/pin kontrolleri */}
      <div className={cn("flex h-16 items-center justify-between border-b border-white/[0.07]", expanded ? "px-6" : "px-2")}>
        {expanded && (
          <Link href="/dashboard" prefetch={false} className="flex items-center min-w-0" onClick={onClose}>
            <Image
              src="/ilerihublogo.png"
              alt="ILERIHub"
              width={192}
              height={48}
              className="h-11 w-auto brightness-0 invert"
              priority
            />
          </Link>
        )}
        <div className={cn("flex items-center gap-1", !expanded && "w-full justify-center")}>
          {/* Masaüstü: pin + collapse/expand */}
          {!isMobile && (
            expanded ? (
              <>
                <button
                  type="button"
                  title={pinned ? "Sabitlemeyi kaldır (hover ile açılır)" : "Sabitle (açık kalır)"}
                  onClick={() => { setPinned(!pinned); if (!pinned) setCollapsed(false) }}
                  className="rounded p-1.5 text-white/60 hover:text-white hover:bg-white/10"
                >
                  {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                </button>
                {pinned && (
                  <button
                    type="button"
                    title="Menüyü daralt"
                    onClick={() => setCollapsed(true)}
                    className="rounded p-1.5 text-white/60 hover:text-white hover:bg-white/10"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                title="Menüyü genişlet"
                onClick={() => { setCollapsed(false); setPinned(true) }}
                className="rounded p-1.5 text-white/60 hover:text-white hover:bg-white/10"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            )
          )}
          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white/70 hover:text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Menü araması — <nav>'ın DIŞINDA: liste kayarken sabit kalır.
          Yalnız geniş modda; dar moda (ikon-only) sığmaz. */}
      {expanded && (
        <div className="px-4 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Menüde ara..."
              aria-label="Menüde ara"
              className="w-full rounded-lg border border-white/10 bg-white/[0.06] py-2 pl-8 pr-8 text-sm text-white placeholder:text-white/30 focus:border-teal-400/40 focus:bg-white/[0.09] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                title="Aramayı temizle"
                aria-label="Aramayı temizle"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/40 hover:text-white hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4 sidebar-dark-nav">
        {isSearching ? (
          /* Arama modu: gruplama/collapse mantığına DOKUNULMAZ — ağaç yalnızca
             gizlenir, eşleşenler düz liste olarak gösterilir. */
          searchResults.length > 0 ? (
            searchResults.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-teal-500/15 text-teal-300"
                      : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{item.name}</span>
                  <span className="flex-shrink-0 text-[9px] uppercase tracking-wider text-white/25">
                    {item.group}
                  </span>
                </Link>
              )
            })
          ) : (
            <p className="px-3 py-6 text-center text-sm text-white/30">Sonuç bulunamadı</p>
          )
        ) : (
        <>
        {/* Ana Menü Öğeleri */}
        {filteredMainItems.map(item => renderMenuItem(item))}

        {/* Formlar */}
        {filteredFormsItems.length > 0 && (
          <>
            <button
              onClick={() => setFormsOpen(!formsOpen)}
              className={cn(
                "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                isFormsActive
                  ? "text-teal-300"
                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
              )}
            >
              <FileText className="h-5 w-5" />
              <span className="flex-1 text-left">Formlar</span>
              {formsOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {formsOpen && (
              <div className="space-y-1 ml-4">
                {filteredFormsItems.map(item => renderMenuItem(item))}
              </div>
            )}
          </>
        )}

        {/* Kalite Yönetim Sistemi — dış grup: kalibrasyon (herkes) / KYS / ISO'dan biri görünüyorsa */}
        {(filteredKaliteItems.length > 0 || filteredQdmsItems.length > 0 || filteredAuditsItems.length > 0) && (
          <>
            <button
              onClick={() => setQdmsOpen(!qdmsOpen)}
              className={cn(
                "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                isQdmsActive
                  ? "text-teal-300"
                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
              )}
            >
              <Shield className="h-5 w-5" />
              <span className="flex-1 text-left">Kalite</span>
              {qdmsOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {qdmsOpen && (
              <div className="space-y-1 ml-4">
                {/* Ölçüm/kalibrasyon modülleri (İleri Teknik'ten taşındı) */}
                {filteredKaliteItems.map(item => renderMenuItem(item))}

                {/* Kalite Yönetim alt-grubu — başlık: KYS öğeleri (canSeeQdms) VEYA Denetimler görünüyorsa */}
                {(filteredQdmsItems.length > 0 || filteredAuditsItems.length > 0) && (
                <>
                <button
                  onClick={() => setKaliteYonetimOpen(!kaliteYonetimOpen)}
                  className={cn(
                    "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                    isKaliteYonetimActive
                      ? "text-teal-300"
                      : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
                  )}
                >
                  <ClipboardCheck className="h-5 w-5" />
                  <span className="flex-1 text-left">Kalite Yönetim</span>
                  {kaliteYonetimOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {kaliteYonetimOpen && (
                  <div className="space-y-1 ml-4">
                {filteredQdmsItems.map(item => renderMenuItem(item))}

                {/* Denetimler Alt Menüsü */}
                {filteredAuditsItems.length > 0 && (
                  <>
                    <button
                      onClick={() => setAuditsOpen(!auditsOpen)}
                      className={cn(
                        "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                        isAuditsActive
                          ? "text-teal-300"
                          : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
                      )}
                    >
                      <ClipboardList className="h-5 w-5" />
                      <span className="flex-1 text-left">Denetimler</span>
                      {auditsOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {auditsOpen && (
                      <div className="space-y-1 ml-4">
                        {/* ISO 27001 Alt Menüsü */}
                        {filteredIso27001Items.length > 0 && (
                          <>
                            <button
                              onClick={() => setIso27001Open(!iso27001Open)}
                              className={cn(
                                "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                                isIso27001Active
                                  ? "text-teal-300"
                                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
                              )}
                            >
                              <Shield className="h-5 w-5" />
                              <span className="flex-1 text-left">ISO 27001</span>
                              {iso27001Open ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            {iso27001Open && (
                              <div className="space-y-1 ml-4">
                                {filteredIso27001Items.map(item => renderMenuItem(item))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
                  </div>
                )}
                </>
                )}
              </div>
            )}
          </>
        )}

        {/* İK */}
        {showIkGroup && (
        <button
          onClick={() => setIkOpen(!ikOpen)}
          className={cn(
            "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
            isIkActive
              ? "text-teal-300"
              : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
          )}
        >
          <Users className="h-5 w-5" />
          <span className="flex-1 text-left">İV</span>
          {ikOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        )}
        {showIkGroup && ikOpen && (
          <div className="space-y-1 ml-4">
            {filteredPersonnelItems.map(item => renderMenuItem(item))}
            {filteredOffboardingItems.map(item => renderMenuItem(item))}
            {/* {renderMenuItem({ name: "Mavi Yaka Kullanıcılar", icon: Users, href: "/strategic-hr/bluecollar-users", roles: ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"] })} */}

            {/* Stratejik IK */}
            {filteredStrategicHrItems.length > 0 && (
              <>
                <button
                  onClick={() => setStrategicHrOpen(!strategicHrOpen)}
                  className={cn(
                    "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                    isStrategicHrActive
                      ? "text-teal-300"
                      : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
                  )}
                >
                  <Briefcase className="h-5 w-5" />
                  <span className="flex-1 text-left">Stratejik İK</span>
                  {strategicHrOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {strategicHrOpen && (
                  <div className="space-y-1 ml-4">
                    {filteredStrategicHrItems.map(item => renderMenuItem(item))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ILERI Teknik Grubu */}
        {filteredTeknikItems.length > 0 && (
          <>
            <button
              onClick={() => setTeknikOpen(!teknikOpen)}
              className={cn(
                "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                isTeknikActive
                  ? "text-teal-300"
                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
              )}
            >
              <Cog className="h-5 w-5" />
              <span className="flex-1 text-left">ILERI Teknik</span>
              {teknikOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {teknikOpen && (
              <div className="space-y-1 ml-4">
                {filteredTeknikItems.map(item => renderMenuItem(item))}
              </div>
            )}
          </>
        )}

        {/* IPRO — Üretim Takip Yönetimi */}
        {filteredIproItems.length > 0 && (
          <>
            <button
              onClick={() => setIproOpen(!iproOpen)}
              className={cn(
                "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                isIproActive
                  ? "text-teal-300"
                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
              )}
            >
              <Factory className="h-5 w-5" />
              <span className="flex-1 text-left">IPRO Üretim Takip</span>
              {iproOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {iproOpen && (
              <div className="space-y-1 ml-4">
                {filteredIproItems.map(item => renderMenuItem(item))}
              </div>
            )}
          </>
        )}

        {/* Sistem Geliştirme */}
        {filteredSistemGelistirmeItems.length > 0 && (
          <>
            <button
              onClick={() => setSistemGelistirmeOpen(!sistemGelistirmeOpen)}
              className={cn(
                "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                isSistemGelistirmeActive
                  ? "text-teal-300"
                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.07]"
              )}
            >
              <ServerCog className="h-5 w-5" />
              <span className="flex-1 text-left">Sistem Geliştirme</span>
              {sistemGelistirmeOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {sistemGelistirmeOpen && (
              <div className="space-y-1 ml-4">
                {filteredSistemGelistirmeItems.map(item => renderMenuItem(item))}
              </div>
            )}
          </>
        )}

        {/* Diğer Menü Öğeleri */}
        {filteredBottomItems.map(item => renderMenuItem(item))}

        {/* Sandbox Modülleri */}
        {filteredSandboxItems.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/[0.07]">
            <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-white/20">Sandbox</p>
            {filteredSandboxItems.map(item => renderMenuItem(item))}
          </div>
        )}
        </>
        )}
      </nav>

      {/* User Info & Logout — dar modda yalnız avatar + çıkış ikonu (metin sarmasın) */}
      <div className={cn("border-t border-white/[0.07] overflow-hidden", expanded ? "p-4 space-y-3" : "p-2 space-y-2")}>
        {session?.user && (
          expanded ? (
            <div className="flex items-center space-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white text-xs font-bold flex-shrink-0">
                {session.user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || <User className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-white truncate leading-tight">{session.user.name}</p>
                <p className="text-[10.5px] text-white/40 truncate">{session.user.department || session.user.role}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title={session.user.name ?? undefined}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white text-xs font-bold flex-shrink-0">
                {session.user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || <User className="h-5 w-5" />}
              </div>
            </div>
          )
        )}
        {expanded ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 bg-transparent"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Çıkış Yap
          </Button>
        ) : (
          <button
            type="button"
            title="Çıkış Yap"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center justify-center rounded-md border border-white/10 p-2 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Footer — sürüm/takım metni YALNIZ geniş modda render edilir (dar modda hiç yok) */}
      {expanded && (
        <div className="border-t border-white/[0.07] p-4">
          <div className="text-[10px] text-white/20 whitespace-nowrap overflow-hidden">
            System Development Team ILERI<span className="text-teal-300">Hub</span> V.1.1
          </div>
        </div>
      )}
    </div>
  )
}
