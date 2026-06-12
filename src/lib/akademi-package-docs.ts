import type { PackageReferenceDocInput } from "@/types/akademi-package";

// Form'dan gelen referans doküman listesini güvene alır: yalnız geçerli
// (title + fileUrl dolu) kayıtlar, sıra dizideki konuma göre yeniden numaralanır.
// fileUrl yalnız kendi serve route'umuza ait olmalı (dışarıdan URL enjekte
// edilmesin). Dönen değer Prisma nested-create'e hazırdır.
export function normalizeReferenceDocs(
  input: unknown
): PackageReferenceDocInput[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (d): d is { title: unknown; fileUrl: unknown } =>
        !!d && typeof d === "object"
    )
    .map((d) => ({
      title: typeof d.title === "string" ? d.title.trim() : "",
      fileUrl: typeof d.fileUrl === "string" ? d.fileUrl.trim() : "",
    }))
    .filter(
      (d) =>
        d.title.length > 0 &&
        d.fileUrl.startsWith("/api/akademi/files/packages/ref-docs/")
    )
    .map((d, i) => ({ title: d.title, fileUrl: d.fileUrl, sortOrder: i }));
}
