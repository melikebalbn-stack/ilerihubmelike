"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { BolumWithCount } from "@/types/akademi-package";

interface Props {
  packageId: string;
  initialBolums: string[];
  onSaved: () => void;
}

export function AdminPackageBolumPicker({
  packageId,
  initialBolums,
  onSaved,
}: Props) {
  const [allBolums, setAllBolums] = useState<BolumWithCount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialBolums)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSelected(new Set(initialBolums));
    setDirty(false);
  }, [initialBolums]);

  const loadBolums = useCallback(() => {
    setLoading(true);
    fetch("/api/akademi/admin/packages/bolums")
      .then((r) => (r.ok ? r.json() : { bolums: [] }))
      .then((data) => setAllBolums(data.bolums ?? []))
      .catch(() => setAllBolums([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadBolums();
  }, [loadBolums]);

  const toggle = (bolum: string) => {
    const next = new Set(selected);
    if (next.has(bolum)) next.delete(bolum);
    else next.add(bolum);
    setSelected(next);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/packages/${packageId}/bolums`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bolums: Array.from(selected) }),
        }
      );
      if (!res.ok) throw new Error("save failed");
      toast.success(
        `${selected.size} bölüm kaydedildi (Aşama 3'te otomatik atama yapılacak)`
      );
      onSaved();
    } catch {
      toast.error("Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="ak-card-static p-8 text-center text-sm"
        style={{ color: "var(--ak-text-tertiary)" }}
      >
        Bölümler yükleniyor...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-sm"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          Pakete atanacak bölümleri seçin. Bu bölümlerdeki tüm çalışanlar pakete dahil olur.
        </p>
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "Kaydediliyor..." : `Kaydet (${selected.size})`}
          </Button>
        )}
      </div>

      <div className="ak-card-static p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {allBolums.map((b) => (
            <label
              key={b.bolum}
              className="flex items-center gap-2.5 p-2 rounded-md cursor-pointer hover:bg-[var(--ak-surface-2)]"
            >
              <Checkbox
                checked={selected.has(b.bolum)}
                onCheckedChange={() => toggle(b.bolum)}
              />
              <div className="flex-1 flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{ color: "var(--ak-text-primary)" }}
                >
                  {b.bolum}
                </span>
                <span
                  className="text-xs flex items-center gap-1"
                  style={{ color: "var(--ak-text-tertiary)" }}
                >
                  <Users className="w-3 h-3" />
                  {b.userCount}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
