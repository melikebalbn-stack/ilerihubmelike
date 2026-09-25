"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function AramaKutusu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deger, setDeger] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const zamanlayici = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (deger.trim()) params.set("q", deger.trim());
      else params.delete("q");
      const query = params.toString();
      router.push(query ? `/proje-takip?${query}` : "/proje-takip");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 350);
    return () => clearTimeout(zamanlayici);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deger]);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={deger}
        onChange={(e) => setDeger(e.target.value)}
        placeholder="Proje No, ürün, müşteri, sorumlu ara..."
        className="pl-8"
      />
    </div>
  );
}
