import { renderEmailHtml, type EmailLayoutInput } from "../layout";

export { p, quote, type EmailInfoRow } from "../layout";

export type EmailContent = {
  subject: string;
  htmlForUser: string;
  htmlForManager: string;
  textForUser: string;
  textForManager: string;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDateTR(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function ileriHubUrl(path: string): string {
  const base =
    process.env.ILERIHUB_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
}

/**
 * Akademi maili — kurumsal yerleşim (bkz. ../layout.ts). Eski `wrapHtml(title, body)`
 * (class-CSS, teal gradient) kaldırıldı; şablonlar başlık/paragraf/bilgi satırı/
 * buton/dipnot alanlarını ayrı ayrı verir, HTML'i `renderEmail` üretir.
 */
export function akademiMail(input: Omit<EmailLayoutInput, "module">): string {
  return renderEmailHtml({ module: "Akademi", ...input });
}
