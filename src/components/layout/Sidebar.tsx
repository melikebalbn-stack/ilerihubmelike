"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
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
  Factory,
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

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
  { name: "Mesai Performansı", icon: BarChart3, href: "/forms/overtime/performans", roles: ["*"] },
  // { name: "Proje Bar", icon: BarChart3, href: "/forms/project-bar", roles: ["*"] }, // Şimdilik gizli
]

// ILERI Teknik alt menüsü
const teknikMenuItems = [
  { name: "Yangın Güvenliği", icon: Flame, href: "/fire-safety", roles: ["QUALITY_MANAGER", "ADMIN"] },
  { name: "Tezgah Bakım", icon: Factory, href: "/maintenance", roles: ["*"] },
  { name: "Arşiv", icon: Archive, href: "/arsiv/koli", roles: ["*"] },
  { name: "IT Raporları", icon: BarChart3, href: "/it-reports", roles: ["IT_MANAGER", "ADMIN"] },
]

// Stratejik IK alt menüsü
// Erişim: İnsan Varlıkları departmanı (tam erişim) + Departman müdürleri (kendi departmanları)
const strategicHrMenuItems = [
  { name: "Yetenek Yönetimi", icon: Target, href: "/talent-management", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
  { name: "Yedekleme Planlaması", icon: UserCheck, href: "/strategic-hr/succession-planning", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
  { name: "Performans Yönetimi", icon: Target, href: "/strategic-hr/performance", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
  { name: "İşe Alım", icon: Briefcase, href: "/strategic-hr/recruitment", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
  { name: "Organizasyon Şeması", icon: Network, href: "/strategic-hr/org-chart", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN", "DEPT_HEAD"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR"] },
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

// Kalite Yönetim Sistemi (KYS) alt menüsü
const qdmsMenuItems = [
  { name: "Doküman Kontrolü", icon: FileCheck, href: "/qdms/documents", roles: ["*"] },
  { name: "CAPA", icon: AlertTriangle, href: "/qdms/capa", roles: ["*"] },
  { name: "İç Denetim", icon: ClipboardCheck, href: "/qdms/audits", roles: ["*"] },
  { name: "Risk Yönetimi", icon: Scale, href: "/qdms/risks", roles: ["*"] },
  { name: "Tedarikçi Yönetimi", icon: Truck, href: "/qdms/suppliers", roles: ["*"] },
  { name: "Eğitim Yönetimi", icon: BookOpen, href: "/qdms/training", roles: ["*"] },
  { name: "Değişiklik Yönetimi", icon: GitBranch, href: "/qdms/changes", roles: ["*"] },
  { name: "Uygunsuzluk", icon: FileWarning, href: "/qdms/ncr", roles: ["*"] },
  { name: "Müşteri Şikayetleri", icon: MessageCircle, href: "/qdms/complaints", roles: ["*"] },
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

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [teknikOpen, setTeknikOpen] = useState(false)
  const [qdmsOpen, setQdmsOpen] = useState(false)
  const [kaliteYonetimOpen, setKaliteYonetimOpen] = useState(false)
  const [ikOpen, setIkOpen] = useState(false)
  const [strategicHrOpen, setStrategicHrOpen] = useState(false)
  const [auditsOpen, setAuditsOpen] = useState(false)
  const [iso27001Open, setIso27001Open] = useState(false)
  const [formsOpen, setFormsOpen] = useState(false)
  const [sistemGelistirmeOpen, setSistemGelistirmeOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)

  // Pathname değiştiğinde ilgili menüyü otomatik aç
  useEffect(() => {
    if (pathname.startsWith('/iso27001')) {
      setQdmsOpen(true)
      setKaliteYonetimOpen(true)
      setAuditsOpen(true)
      setIso27001Open(true)
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

  // Kullanıcı rolüne göre menü filtreleme
  const userRole = session?.user?.role || 'USER'
  const userDepartment = session?.user?.department || ''

  const filterItems = (items: typeof mainMenuItems) => items.filter(item => {
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
  const filteredQdmsItems = filterItems(qdmsMenuItems)
  const filteredKaliteItems = filterItems(kaliteMenuItems)
  const filteredAuditsItems = filterItems(auditsMenuItems)
  const filteredIso27001Items = filterItems(iso27001MenuItems)
  const filteredStrategicHrItems = filterStrategicHrItems(strategicHrMenuItems)
  const filteredOffboardingItems = filterItems(offboardingMenuItems)
  const filteredFormsItems = filterItems(formsMenuItems)
  const filteredSistemGelistirmeItems = filterItems(sistemGelistirmeMenuItems)
  const filteredBottomItems = filterItems(bottomMenuItems)

  // Sandbox: SUPER_ADMIN tümünü görür, diğerleri sadece kendi sandbox'ını
  const filteredSandboxItems = sandboxMenuItems.filter(item => {
    if (userRole === 'SUPER_ADMIN') return true
    if (item.ownerEmail && session?.user?.email?.toLowerCase() === item.ownerEmail.toLowerCase()) return true
    return false
  })

  // Teknik menüsünde aktif sayfa var mı kontrol et (IT Raporları dahil)
  const isTeknikActive = teknikMenuItems.some(item =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname === '/it-reports' || pathname.startsWith('/it-reports/')

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

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        onClick={handleClick}
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
      className={cn(
        "w-64 flex-col border-r border-white/[0.07] bg-slate-900 flex h-full",
        // Masaüstü: sabit sidebar
        "max-lg:hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30",
        // Sheet içindeyse (isOpen=true) her zaman göster, fixed kullanma
        isOpen && "!flex !max-lg:flex !relative !inset-auto !z-auto"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-white/[0.07] px-6">
        <Link href="/dashboard" prefetch={false} className="flex items-center" onClick={onClose}>
          <Image
            src="/ilerihublogo.png"
            alt="ILERIHub"
            width={192}
            height={48}
            className="h-11 w-auto brightness-0 invert"
            priority
          />
        </Link>
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

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4 sidebar-dark-nav">
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

        {/* Kalite Yönetim Sistemi */}
        {filteredQdmsItems.length > 0 && (
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

                {/* Kalite Yönetim alt-grubu */}
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
              </div>
            )}
          </>
        )}

        {/* İK */}
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
        {ikOpen && (
          <div className="space-y-1 ml-4">
            {renderMenuItem({ name: "Personel Yönetimi", icon: UserCog, href: "/personnel", roles: ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR", "IK"] })}
            {renderMenuItem({ name: "İK Raporları", icon: BarChart3, href: "/personnel/reports", roles: ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR", "IK"] })}
            {renderMenuItem({ name: "Bölüm Değişiklikleri", icon: ArrowRightLeft, href: "/personnel/department-transfers", roles: ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR", "IK"] })}
            {renderMenuItem({ name: "Ayrılan Personel", icon: UserMinus, href: "/personnel/leavers", roles: ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR", "IK"] })}
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
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-white/[0.07] p-4 space-y-3">
        {session?.user && (
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white text-xs font-bold flex-shrink-0">
              {session.user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || <User className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-white truncate leading-tight">{session.user.name}</p>
              <p className="text-[10.5px] text-white/40 truncate">{session.user.department || session.user.role}</p>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 bg-transparent"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Çıkış Yap
        </Button>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.07] p-4">
        <div className="text-[10px] text-white/20">
          System Development Team ILERI<span className="text-teal-300">Hub</span> V.1.1
        </div>
      </div>
    </div>
  )
}
