"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  UserCheck,
  Users,
  Upload,
  Package,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  bookOpen: BookOpen,
  userCheck: UserCheck,
  users: Users,
  upload: Upload,
  package: Package,
};

export type AdminActionIcon = keyof typeof ICON_MAP;

interface Props {
  href: string;
  title: string;
  description: string;
  icon: AdminActionIcon;
  color: "accent" | "green" | "orange" | "purple" | "teal";
  delayIndex?: number;
  disabled?: boolean;
}

export function AdminActionCard({
  href,
  title,
  description,
  icon,
  color,
  delayIndex = 1,
  disabled = false,
}: Props) {
  const Icon = ICON_MAP[icon];

  const content = (
    <>
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: `var(--ak-${color}-glow)` }}
      >
        <Icon className="w-6 h-6" style={{ color: `var(--ak-${color})` }} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-base font-bold mb-1 flex items-center gap-2"
          style={{ color: "var(--ak-text-primary)" }}
        >
          {title}
          {!disabled && (
            <ArrowRight
              className="w-4 h-4 transition-transform group-hover:translate-x-1"
              style={{ color: "var(--ak-text-tertiary)" }}
            />
          )}
        </div>
        <div
          className="text-sm"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          {description}
        </div>
      </div>
    </>
  );

  if (disabled) {
    return (
      <div
        className={`ak-card-static p-5 flex items-start gap-4 opacity-60 cursor-not-allowed ak-animate-in ak-delay-${delayIndex}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`ak-card p-5 flex items-start gap-4 group ak-animate-in ak-delay-${delayIndex}`}
    >
      {content}
    </Link>
  );
}
