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
 * Akademi dashboard kartlarının ve IFS bandının tek aksiyonu.
 *
 * 27.09.2026 — Envanter modülü de bu deseni kullanıyor; oradaki aksiyonlar
 * gezinme DEĞİL işlem (kaydet/sil/onayla). Bu yüzden `href` artık opsiyonel:
 * `onClick` verilirse <button> (type=button, disabled destekli), `href`
 * verilirse eskisi gibi <Link>/<a download> render edilir. Link yolunun
 * davranışı DEĞİŞMEDİ — Akademi kartları aynı çıktıyı üretir.
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
  /** İşlem aksiyonu (kaydet/sil/onayla…) → <button type="button"> olarak render edilir. */
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
        {/* ↗ "git" demek — yalnız gezinme (href) modunda. onClick modunda rozet
            bir işlem tetikler (kaydet/sil/onayla), gezinme yok → ok gösterilmez. */}
        {!onClick && (
          <span aria-hidden className="ml-0.5 text-[11px]">
            ↗
          </span>
        )}
      </span>
    </>
  );
  const label = ariaLabel ?? `${left} — ${right}`;

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
