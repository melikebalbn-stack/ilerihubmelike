import Link from "next/link";

export type SplitBadgeColor = "red" | "blue" | "green" | "amber" | "gray";

const BG: Record<SplitBadgeColor, string> = {
  red: "bg-[#dc2626]",
  blue: "bg-[#2563eb]",
  green: "bg-[#16a34a]",
  amber: "bg-[#d97706]",
  gray: "bg-[#64748b]",
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
  download = false,
}: {
  color: SplitBadgeColor;
  left: string;
  right: string;
  href: string;
  className?: string;
  ariaLabel?: string;
  /** true → next/link yerine düz <a download> (PDF indirme; prefetch/soft-nav yok). */
  download?: boolean;
}) {
  const cls = `inline-flex items-stretch overflow-hidden rounded-lg text-[12.5px] font-semibold leading-none text-white ${BG[color]} ${className}`;
  const inner = (
    <>
      <span className="flex items-center gap-1.5 whitespace-nowrap px-[11px] py-2">
        {left}
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap border-l border-white/35 px-[11px] py-2">
        {right}
        <span aria-hidden className="ml-0.5 text-[11px]">
          ↗
        </span>
      </span>
    </>
  );
  const label = ariaLabel ?? `${left} — ${right}`;

  if (download) {
    // PDF indirme: DAİMA yeni sekme. target'sız düz <a href download> tıklamada
    // MEVCUT sekmede gezinme başlatır; tarayıcı PDF'i yeni sekmeye/indirmeye
    // yönlendirince özgün Hub sekmesi gezinme ortasında donar ve sayfa ilk
    // `loading` render'ında (Yükleniyor…) asılı kalırdı. target=_blank +
    // rel=noopener ile tıklama mevcut sekmeye HİÇ dokunmaz, loading/transition
    // state tetiklenmez.
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        download
        aria-label={label}
        className={cls}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cls}>
      {inner}
    </Link>
  );
}
