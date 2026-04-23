"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  label?: string;
}

const NEW_CATEGORY_SENTINEL = "__NEW__";
const NONE_SENTINEL = "__NONE__";

export function AdminCategoryCombobox({
  value,
  onChange,
  categories,
  label = "Kategori",
}: Props) {
  const [isNew, setIsNew] = useState(false);

  const handleSelectChange = (v: string) => {
    if (v === NEW_CATEGORY_SENTINEL) {
      setIsNew(true);
      onChange("");
    } else if (v === NONE_SENTINEL) {
      setIsNew(false);
      onChange("");
    } else {
      setIsNew(false);
      onChange(v);
    }
  };

  const selectValue = isNew
    ? NEW_CATEGORY_SENTINEL
    : value && categories.includes(value)
    ? value
    : NONE_SENTINEL;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {!isNew ? (
        <Select value={selectValue} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Kategori seç (opsiyonel)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_SENTINEL}>— Kategori yok —</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
            <SelectItem value={NEW_CATEGORY_SENTINEL}>
              + Yeni kategori ekle
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Yeni kategori adı"
            autoFocus
            maxLength={50}
          />
          <button
            type="button"
            onClick={() => {
              setIsNew(false);
              onChange("");
            }}
            className="p-2 rounded-md hover:bg-gray-100"
            title="İptal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
