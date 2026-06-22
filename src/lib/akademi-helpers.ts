import type { ContentItem } from "@/types/akademi";

const GRADIENTS = [
  "linear-gradient(135deg, #3878ff 0%, #00d4b4 100%)",
  "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
  "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  "linear-gradient(135deg, #6366f1 0%, #3878ff 100%)",
  "linear-gradient(135deg, #14b8a6 0%, #10b981 100%)",
];

export function getGradientForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

export function getDifficultyLabel(
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
): string {
  switch (difficulty) {
    case "BEGINNER": return "Başlangıç";
    case "INTERMEDIATE": return "Orta Seviye";
    case "ADVANCED": return "İleri Seviye";
  }
}

export function getContentTypeLabel(type: ContentItem["type"]): string {
  switch (type) {
    case "VIDEO": return "Video";
    case "PDF": return "PDF";
    case "DOCUMENT": return "Doküman";
    case "QUIZ": return "Sınav";
    case "GOREV": return "Görev";
  }
}

export function getContentFileUrl(content: ContentItem): string | null {
  if (!content.filePath) return null;
  if (content.fileUrl?.startsWith("http")) return content.fileUrl;

  const subdir =
    content.type === "VIDEO" ? "videos" :
    content.type === "PDF" || content.type === "DOCUMENT" ? "documents" :
    "documents";

  return `/api/akademi/files/${subdir}/${content.filePath}`;
}

export function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} saat` : `${h} sa ${m} dk`;
}

export function getInitials(name: string): string {
  return name
    .split(/[\s.@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function resolveUserDisplayName(u: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  if (u.name?.trim()) return u.name.trim();
  const composed = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  if (composed) return composed;
  if (u.username?.trim()) return u.username.trim();
  if (u.email) return u.email.split("@")[0];
  return "Kullanıcı";
}

export function resolveFirstName(u: {
  firstName?: string | null;
  name?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  if (u.firstName?.trim()) return u.firstName.trim();
  if (u.name?.trim()) return u.name.trim().split(" ")[0];
  if (u.username?.trim()) {
    const first = u.username.split(".")[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  }
  if (u.email) {
    const local = u.email.split("@")[0].split(".")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return "";
}
