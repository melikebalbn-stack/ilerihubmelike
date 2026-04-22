"use client";

import { AnimatedNumber } from "@/components/akademi/shared/AnimatedNumber";
import {
  BookOpen,
  Award,
  Clock,
  TrendingUp,
  Trophy,
  Users,
  Flame,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  bookOpen: BookOpen,
  award: Award,
  clock: Clock,
  trendingUp: TrendingUp,
  trophy: Trophy,
  users: Users,
  flame: Flame,
};

export type StatCardIcon = keyof typeof ICON_MAP;

interface Props {
  icon: StatCardIcon;
  label: string;
  value: number;
  suffix?: string;
  color: "accent" | "green" | "orange" | "purple" | "teal" | "red";
  delayIndex?: number;
}

export function StatCard({
  icon,
  label,
  value,
  suffix,
  color,
  delayIndex = 1,
}: Props) {
  const Icon = ICON_MAP[icon];

  return (
    <div className={`ak-card-static p-5 ak-animate-in ak-delay-${delayIndex}`}>
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `var(--ak-${color}-glow)` }}
        >
          <Icon className="w-5 h-5" style={{ color: `var(--ak-${color})` }} />
        </div>
      </div>
      <div
        className="text-2xl font-bold mb-1"
        style={{ color: "var(--ak-text-primary)" }}
      >
        <AnimatedNumber value={value} suffix={suffix} />
      </div>
      <div className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
        {label}
      </div>
    </div>
  );
}
