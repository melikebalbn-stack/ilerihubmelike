"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, ClipboardCheck, ShieldCheck } from "lucide-react";

const BRAND = "#1B4F72";

const SEKMELER = [
  { ad: "Formum", yol: "/strategic-hr/is-analizi", ikon: ClipboardList, tam: true },
  { ad: "Onayımdakiler", yol: "/strategic-hr/is-analizi/onaylarim", ikon: ClipboardCheck, tam: false },
  { ad: "İK Onayları", yol: "/strategic-hr/is-analizi/ik-onay", ikon: ShieldCheck, tam: false },
];

export default function IaNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-3xl px-4">
        <nav className="flex gap-1">
          {SEKMELER.map((s) => {
            // "Formum" tam eşleşme ister (alt yollar onun değil); diğerleri prefix.
            const aktif = s.tam ? pathname === s.yol : pathname.startsWith(s.yol);
            const Ikon = s.ikon;
            return (
              <Link
                key={s.yol}
                href={s.yol}
                className="flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition"
                style={{
                  color: aktif ? BRAND : "#64748b",
                  borderColor: aktif ? BRAND : "transparent",
                }}
              >
                <Ikon className="h-4 w-4" />
                {s.ad}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
