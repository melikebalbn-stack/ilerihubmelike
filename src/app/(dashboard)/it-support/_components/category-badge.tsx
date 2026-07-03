"use client"

import {
  Code, Wifi, Key, Monitor, HelpCircle, Bug, Settings, Mail, Server,
  Smartphone, Printer, Database, Shield, Cloud, Cpu, HardDrive,
  type LucideIcon,
} from "lucide-react"

// Server→client sınırında component ref geçmemek için: string key → ICON_MAP.
const ICON_MAP: Record<string, LucideIcon> = {
  Code, Wifi, Key, Monitor, HelpCircle, Bug, Settings, Mail, Server,
  Smartphone, Printer, Database, Shield, Cloud, Cpu, HardDrive,
}

export interface CategoryLike {
  name: string
  color: string | null
  icon: string | null
}

/**
 * Kategori rozeti — renkli açık arka plan + lucide ikon + ad.
 * category yoksa gri "Kategorisiz". compact=true → yalnız ikon (dar alan).
 */
export function CategoryBadge({ category, compact = false }: { category: CategoryLike | null; compact?: boolean }) {
  if (!category) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
        <HelpCircle className="h-3 w-3" />
        {!compact && "Kategorisiz"}
      </span>
    )
  }
  const Icon = (category.icon && ICON_MAP[category.icon]) || HelpCircle
  const color = category.color || "#6b7280"
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
      title={category.name}
    >
      <Icon className="h-3 w-3" />
      {!compact && category.name}
    </span>
  )
}
