import Link from "next/link";

export type SplitBadgeColor = "red" | "blue" | "green" | "amber" | "gray" | "cyan";

const BG: Record<SplitBadgeColor, string> = {
  red: "bg-[#dc2626]",
  blue: "bg-[#2563eb]",
  green: "bg-[#16a34a]",
  amber: "bg-[#d97706]",
  gray: "bg-[#64748b]",
  cyan: "bg-[#0891b2]",
};

/**
 * İki parçalı aksiyon rozeti (Tremor "Badge 11" deseni): sol durum, sağ eylem + ↗.
 * Akademi dashboard kartlarının ve IFS bandının tek aksiyonu.
 *
 * 27.09.2026 — Envanter + Duyurular modülleri de bu deseni kullanıyor; oradaki
 * aksiyonlar gezinme DEĞİL işlem (kaydet/sil/onayla/kapat). Bu yüzden `href`
 * opsiyonel: `onClick` verilirse <button> (type=button, disabled destekli),
 * `href` verilirse eskisi gibi <Link>/<a download>, ikisi de yoksa tıklanamaz
 * <span> render edilir. ↗ oku yalnız gezinme (href/Link) modunda gösterilir;
 * onClick modunda işlem tetiklendiği için ok yoktur. Link yolu DEĞİŞMEDİ.
 */
export function SplitBadge({
  color,
  left,
  right,
  href,
  className = "",
  ariaLabel,
  download = false,
  onClick,
  disabled = false,
  title,
}: {
  color: SplitBadgeColor;
  left: string;
  right: string;
  /** Gezinme aksiyonu. onClick ile BİRLİKTE verilmez — biri seçilir. */
  href?: string;
  className?: string;
  ariaLabel?: string;
  /** true → next/link yerine düz <a download> (PDF indirme; prefetch/soft-nav yok). */
  download?: boolean;
  /** İşlem aksiyonu (kaydet/sil/onayla/kapat…) → <button type="button">. */
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const cls = `inline-flex items-stretch overflow-hidden rounded-lg text-[12.5px] font-semibold leading-none text-white ${BG[color]} ${className}${
    onClick ? " disabled:cursor-not-allowed disabled:opacity-60" : ""
  }`;
  const inner = (
    <>
      <span className="flex items-center gap-1.5 whitespace-nowrap px-[11px] py-2">
        {left}
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap border-l border-white/35 px-[11px] py-2">
        {right}
        {/* ↗ yalnız gezinme (href) modunda; onClick işlem tetikler, ok yok. */}
        {!onClick && (
          <span aria-hidden className="ml-0.5 text-[11px]">
            ↗
          </span>
        )}
      </span>
    </>
  );
  const label = ariaLabel ?? `${left} — ${right}`;

  // İşlem aksiyonu (kaydet/sil/onayla/kapat) → gezinme yok.
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={title} className={cls}>
        {inner}
      </button>
    );
  }

  if (!href) {
    // Ne href ne onClick → tıklanamaz rozet (ör. kapalı kayıtta "Kapalı" durumu).
    return (
      <span aria-label={label} title={title} className={`${cls} opacity-60`}>
        {inner}
      </span>
    );
  }

  if (download) {
    // PDF indirme: DAİMA yeni sekme. target'sız düz <a href download> tıklamada
    // MEVCUT sekmede gezinme başlatır; tarayıcı PDF'i yeni sekmeye/indirmeye
    // yönlendirince özgün Hub sekmesi gezinme ortasında donar ve sayfa ilk
    // `loading` render'ında (Yükleniyor…) asılı kalırdı. target=_blank +
    // rel=noopener ile tıklama mevcut sekmeye HİÇ dokunmaz, loading/transition
    // state tetiklenmez.
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" download aria-label={label} title={title} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} aria-label={label} title={title} className={cls}>
      {inner}
    </Link>
  );
}
