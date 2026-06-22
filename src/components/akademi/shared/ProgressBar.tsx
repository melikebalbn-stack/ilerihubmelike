"use client";

import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  value: number;                // 0-100
  showLabel?: boolean;
  color?: "accent" | "green" | "orange" | "teal" | "purple" | "red";
  size?: "sm" | "md";
  className?: string;
}

/**
 * Akademi progress bar — CSS variable bazlı, animated fill.
 * .akademi-scope içinde kullanılmalı.
 */
export function ProgressBar({
  value,
  showLabel = false,
  color = "accent",
  size = "md",
  className,
}: Props) {
  const h = size === "sm" ? "h-1.5" : "h-2";
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <div
        className={`w-full ${h} rounded-full overflow-hidden`}
        style={{ background: "var(--ak-progress-bg)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `var(--ak-${color})`,
          }}
        />
      </div>
      {showLabel && (
        <div
          className="text-xs font-medium"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          %<AnimatedNumber value={Math.round(pct)} />
        </div>
      )}
    </div>
  );
}
