"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Users,
  UserCheck,
  LayoutDashboard,
  Package,
  FileQuestion,
  ClipboardCheck,
  Award,
  Palette,
  BarChart3,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

const TABS: {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}[] = [
  { href: "/akademi/admin", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/akademi/admin/courses", label: "Kurslar", icon: BookOpen },
  { href: "/akademi/admin/packages", label: "Paketler", icon: Package },
  { href: "/akademi/admin/ifs-training", label: "IFS Eğitimleri", icon: GraduationCap },
  { href: "/akademi/admin/exams", label: "Sınavlar", icon: FileQuestion },
  { href: "/akademi/admin/grading", label: "Değerlendirme", icon: ClipboardCheck },
  { href: "/akademi/admin/certificates", label: "Sertifikalar", icon: Award },
  { href: "/akademi/admin/certificate-templates", label: "Şablonlar", icon: Palette },
  { href: "/akademi/admin/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/akademi/admin/assignments", label: "Atamalar", icon: UserCheck },
  { href: "/akademi/admin/users", label: "Kullanıcılar", icon: Users },
];

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-1 mb-6 overflow-x-auto border-b ak-animate-in"
      style={{ borderColor: "var(--ak-border-divider)" }}
    >
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className="px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap"
            style={{
              borderColor: active ? "var(--ak-accent)" : "transparent",
              color: active ? "var(--ak-accent)" : "var(--ak-text-secondary)",
            }}
          >
            <Icon className="w-4 h-4" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
