"use client";

// PR-IFS-RAPOR-2a: Paket detayında TOPLU son tarih aracı.
// PATCH /api/akademi/admin/packages/[id]/due-date → tighten-only, mevcut
// atamalara uygular (yeni atama oluşturmaz). IFS paket detayında da görünür.

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  packageId: string;
  onApplied?: () => void;
}

export function AdminPackageDueDateCard({ packageId, onApplied }: Props) {
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    if (saving) return;
    if (!dueDate) {
      toast.error("Bir tarih seçin");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/packages/${packageId}/due-date`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dueDate }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Uygulanamadı");
        return;
      }
      const data = await res.json();
      toast.success(
        `${data.updated ?? 0} atama güncellendi, ${data.skipped ?? 0} atlandı`
      );
      onApplied?.();
    } catch {
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ak-card-static p-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="w-4 h-4" style={{ color: "var(--ak-accent)" }} />
        <h3 className="text-sm font-semibold">Toplu Son Tarih Uygula</h3>
      </div>
      <p
        className="text-xs mb-3"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        Paketin tüm mevcut atamalarına son tarih uygular. Kural: yalnızca öne
        çeker (erken tarih kazanır), asla uzatmaz veya silmez.
      </p>
      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="pkg-bulk-due">Son Tarih</Label>
          <Input
            id="pkg-bulk-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-[200px]"
          />
        </div>
        <Button type="button" onClick={apply} disabled={saving || !dueDate}>
          {saving ? "Uygulanıyor..." : "Uygula"}
        </Button>
      </div>
    </div>
  );
}
