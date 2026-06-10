"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  BookOpen,
  GraduationCap,
  ClipboardList,
  Award,
  User,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { useAkademiAuth } from "@/lib/akademi-auth";

interface TabItem {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const tabs: TabItem[] = [
  { label: "Ana Sayfa", href: "/akademi", icon: Home },
  { label: "Eğitimler", href: "/akademi/courses", icon: BookOpen },
  { label: "IFS Eğitimleri", href: "/akademi/ifs", icon: GraduationCap },
  { label: "Sınavlar", href: "/akademi/exams", icon: ClipboardList },
  { label: "Sertifikalarım", href: "/akademi/certificates", icon: Award },
  { label: "Profilim", href: "/akademi/profile", icon: User },
  { label: "Yönetim", href: "/akademi/admin", icon: Shield, adminOnly: true },
];

export function AkademiTopBar() {
  const pathname = usePathname();
  const { user } = useAkademiAuth();
  const visibleTabs = tabs.filter((t) => !t.adminOnly || user?.role === "admin");

  return (
    <nav
      className="sticky top-0 z-10 border-b backdrop-blur px-6"
      style={{
        background: "var(--ak-bg-topbar)",
        borderColor: "var(--ak-border-divider)",
      }}
    >
      <div className="flex items-center gap-1 overflow-x-auto">
        {visibleTabs.map((tab) => {
          const isActive =
            tab.href === "/akademi"
              ? pathname === "/akademi"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                color: isActive
                  ? "var(--ak-accent)"
                  : "var(--ak-text-secondary)",
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="akademi-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: "var(--ak-accent)" }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
