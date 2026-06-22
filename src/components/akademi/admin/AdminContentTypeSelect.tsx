"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { AdminContentType } from "@/types/akademi-admin";

const LABELS: Record<AdminContentType, string> = {
  VIDEO: "🎬 Video",
  PDF: "📄 PDF",
  DOCUMENT: "📎 Doküman",
  QUIZ: "❓ Sınav (Sprint 3)",
  GOREV: "✅ Görev (IFS)",
};

interface Props {
  value: AdminContentType;
  onChange: (value: AdminContentType) => void;
  disabled?: boolean;
  disableQuiz?: boolean;
}

export function AdminContentTypeSelect({
  value,
  onChange,
  disabled = false,
  disableQuiz = true,
}: Props) {
  return (
    <div className="space-y-2">
      <Label>
        İçerik Tipi <span className="text-red-500">*</span>
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as AdminContentType)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="VIDEO">{LABELS.VIDEO}</SelectItem>
          <SelectItem value="PDF">{LABELS.PDF}</SelectItem>
          <SelectItem value="DOCUMENT">{LABELS.DOCUMENT}</SelectItem>
          <SelectItem value="QUIZ" disabled={disableQuiz}>
            {LABELS.QUIZ}
          </SelectItem>
          <SelectItem value="GOREV">{LABELS.GOREV}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
