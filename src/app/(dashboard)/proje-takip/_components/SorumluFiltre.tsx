"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { MuhendislikKisi } from "@/app/api/proje-takip/_lib/muhendislik-ekibi";

export function SorumluFiltre({ muhendisler }: { muhendisler: MuhendislikKisi[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aktif = searchParams.get("sorumlu") ?? "hepsi";

  function degistir(deger: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (deger === "hepsi") params.delete("sorumlu");
    else params.set("sorumlu", deger);
    const query = params.toString();
    router.push(query ? `/proje-takip?${query}` : "/proje-takip");
  }

  return (
    <Select value={aktif} onValueChange={degistir}>
      <SelectTrigger className="w-56"><SelectValue placeholder="Sorumlu Mühendis" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="hepsi">Tüm Sorumlular</SelectItem>
        <SelectItem value="atanmamis">Atanmamış</SelectItem>
        {muhendisler.map((m) => (
          <SelectItem key={m.id} value={m.id}>{m.name ?? m.email}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
