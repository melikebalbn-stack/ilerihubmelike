import Link from "next/link";

export type SplitBadgeColor = "red" | "blue" | "green" | "amber";

const BG: Record<SplitBadgeColor, string> = {
  red: "bg-[#dc2626]",
  blue: "bg-[#2563eb]",
  green: "bg-[#16a34a]",
  amber: "bg-[#d97706]",
};

/**
 * İki parçalı aksiyon rozeti (Tremor "Badge 11" deseni): sol durum, sağ eylem + ↗.
 * Akademi dashboard kartlarının ve IFS bandının tek aksiyonu. Tümü link.
 */
export function SplitBadge({
  color,
  left,
  right,
  href,
  className = "",
  ariaLabel,
}: {
  color: SplitBadgeColor;
  left: string;
  right: string;
  href: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? `${left} — ${right}`}
      className={`inline-flex items-stretch overflow-hidden rounded-lg text-[12.5px] font-semibold leading-none text-white ${BG[color]} ${className}`}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap px-[11px] py-2">
        {left}
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap border-l border-white/35 px-[11px] py-2">
        {right}
        <span aria-hidden className="ml-0.5 text-[11px]">
          ↗
        </span>
      </span>
    </Link>
  );
}
