"use client";

interface Props {
  value: number;
  label?: string;
  size?: "xs" | "sm" | "md";
  color?: "accent" | "green" | "orange" | "red";
}

export function AdminUserProgressBar({
  value,
  label,
  size = "sm",
  color,
}: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const heights = { xs: "h-1", sm: "h-1.5", md: "h-2" };

  const autoColor =
    clamped >= 80 ? "green" : clamped >= 40 ? "accent" : "orange";
  const finalColor = color ?? autoColor;

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div
        className={`flex-1 rounded-full overflow-hidden ${heights[size]}`}
        style={{ background: "var(--ak-progress-bg)" }}
      >
        <div
          className="h-full transition-all duration-300 rounded-full"
          style={{
            width: `${clamped}%`,
            background: `var(--ak-${finalColor})`,
          }}
        />
      </div>
      {label && (
        <div
          className="text-xs font-semibold shrink-0 min-w-[32px] text-right"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
