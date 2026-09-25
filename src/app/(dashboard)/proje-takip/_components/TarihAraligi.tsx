"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function TarihAraligi() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baslangic = searchParams.get("tarihBaslangic") ?? "";
  const bitis = searchParams.get("tarihBitis") ?? "";

  function guncelle(alan: "tarihBaslangic" | "tarihBitis", deger: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (deger) params.set(alan, deger);
    else params.delete(alan);
    const query = params.toString();
    router.push(query ? `/proje-takip?${query}` : "/proje-takip");
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={baslangic}
        onChange={(e) => guncelle("tarihBaslangic", e.target.value)}
        className="w-40"
        aria-label="Açılış tarihi başlangıç"
      />
      <span className="text-muted-foreground text-sm">—</span>
      <Input
        type="date"
        value={bitis}
        onChange={(e) => guncelle("tarihBitis", e.target.value)}
        className="w-40"
        aria-label="Açılış tarihi bitiş"
      />
    </div>
  );
}
