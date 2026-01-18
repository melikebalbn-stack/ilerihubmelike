"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  Home,
  Users,
  Building2,
  Bell,
  FileText,
  Wrench,
  Flame,
  Clock,
  Headphones,
  Settings,
  FolderSync,
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

// Ana menü öğeleri
const mainMenuItems = [
  { name: "Dashboard", icon: Home, href: "/dashboard", roles: ["*"] },
  { name: "Mesajlar", icon: MessageSquare, href: "/messages", roles: ["*"] },
  { name: "Duyurular", icon: Megaphone, href: "/announcements", roles: ["*"] },
  { name: "Öneri Sistemi", icon: Lightbulb, href: "/suggestions", roles: ["*"] },
  { name: "Planlı Görevler", icon: CalendarCheck, href: "/tasks", roles: ["*"] },
  { name: "Anketler", icon: ClipboardList, href: "/surveys", roles: ["HR_MANAGER", "IT_MANAGER", "ADMIN", "SUPER_ADMIN"], departments: ["Insan Varliklari", "İnsan Varlıkları", "Human Resources", "HR", "IK"] },
]

// ILERI Teknik alt menüsü
const teknikMenuItems = [
  { name: "Kalibrasyon", icon: Wrench, href: "/calibration", roles: ["*"] },
  { name: "Yangın Güvenliği", icon: Flame, href: "/fire-safety", roles: ["QUALITY_MANAGER", "ADMIN"] },
  { name: "Tezgah Bakım", icon: Factory, href: "/maintenance", roles: ["*"] },
  { name: "IT Raporları", icon: BarChart3, href: "/it-reports", roles: ["IT_MANAGER", "ADMIN"] },
  { name: "Login Aktiviteleri", icon: LogIn, href: "/login-logs", roles: ["IT_MANAGER", "ADMIN", "SUPER_ADMIN"] },
  { name: "Yedekleme", icon: HardDrive, href: "/backups", roles: ["IT_MANAGER", "ADMIN", "SUPER_ADMIN"] },
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

// Alt menü öğeleri
const bottomMenuItems = [
  { name: "ILERI Dosya Transferi", icon: FolderSync, href: "http://transfer.ilerigroup.com", roles: ["*"], external: true },
  { name: "ILERI Akademi", icon: GraduationCap, href: "/api/sso/akademi", roles: ["*"], external: true, highlight: "Akademi" },
  { name: "IT Destek", icon: Headphones, href: "/it-support", roles: ["*"] },
  { name: "Ayarlar", icon: Settings, href: "/settings", roles: ["ADMIN", "SUPER_ADMIN"] },
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
  const [strategicHrOpen, setStrategicHrOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)

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
  const filteredStrategicHrItems = filterStrategicHrItems(strategicHrMenuItems)
  const filteredBottomItems = filterItems(bottomMenuItems)

  // Teknik menüsünde aktif sayfa var mı kontrol et (IT Raporları, Login Aktiviteleri ve Yedekleme dahil)
  const isTeknikActive = teknikMenuItems.some(item =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname === '/it-reports' || pathname.startsWith('/it-reports/')
    || pathname === '/login-logs' || pathname.startsWith('/login-logs/')
    || pathname === '/backups' || pathname.startsWith('/backups/')

  // QDMS menüsünde aktif sayfa var mı kontrol et
  const isQdmsActive = qdmsMenuItems.some(item =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname.startsWith('/qdms/')

  // Stratejik IK menüsünde aktif sayfa var mı kontrol et
  const isStrategicHrActive = strategicHrMenuItems.some(item =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  ) || pathname.startsWith('/talent-management/')

  // Menü öğesi render fonksiyonu
  const renderMenuItem = (item: typeof mainMenuItems[0], indent = false) => {
    const Icon = item.icon
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
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
            "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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
        onClick={handleClick}
        className={cn(
          "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          indent && "ml-4"
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="flex-1">{item.name}</span>
        {showBadge && (
          <span className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
            isActive
              ? "bg-white text-primary"
              : "bg-primary text-white"
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
        "fixed inset-y-0 left-0 z-50 w-64 flex-col border-r bg-card transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:flex",
        isOpen ? "translate-x-0 flex" : "-translate-x-full hidden lg:flex"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-6">
        <Link href="/dashboard" className="flex items-center space-x-2" onClick={onClose}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">
            ILERI<span className="text-primary">Hub</span>
          </span>
        </Link>
        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {/* Ana Menü Öğeleri */}
        {filteredMainItems.map(item => renderMenuItem(item))}

        {/* Kalite Yönetim Sistemi */}
        {filteredQdmsItems.length > 0 && (
          <>
            <button
              onClick={() => setQdmsOpen(!qdmsOpen)}
              className={cn(
                "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isQdmsActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Shield className="h-5 w-5" />
              <span className="flex-1 text-left">Kalite Yönetim</span>
              {qdmsOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {qdmsOpen && (
              <div className="space-y-1 ml-4">
                {filteredQdmsItems.map(item => renderMenuItem(item))}
              </div>
            )}
          </>
        )}

        {/* Stratejik IK */}
        {filteredStrategicHrItems.length > 0 && (
          <>
            <button
              onClick={() => setStrategicHrOpen(!strategicHrOpen)}
              className={cn(
                "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isStrategicHrActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Users className="h-5 w-5" />
              <span className="flex-1 text-left">Stratejik IK</span>
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

        {/* ILERI Teknik Grubu */}
        {filteredTeknikItems.length > 0 && (
          <>
            <button
              onClick={() => setTeknikOpen(!teknikOpen)}
              className={cn(
                "flex items-center w-full space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isTeknikActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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

        {/* Diğer Menü Öğeleri */}
        {filteredBottomItems.map(item => renderMenuItem(item))}
      </nav>

      {/* User Info & Logout */}
      {session?.user && (
        <div className="border-t p-4 space-y-3">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{session.user.department || session.user.role}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cikis Yap
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="border-t p-4">
        <div className="text-[10px] text-muted-foreground">
          System Development Team ILERI<span className="text-primary">Hub</span> V.1.1
        </div>
      </div>
    </div>
  )
}
