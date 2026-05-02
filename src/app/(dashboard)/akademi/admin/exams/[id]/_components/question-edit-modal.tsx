"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TYPE_LABELS,
  AUTO_SCORED_TYPES,
  OPTION_BASED_TYPES,
  DEFAULT_FILE_TYPES,
} from "@/lib/akademi/question-types";
import type { QuestionItem } from "./questions-manager";

const TYPES = [
  { value: "SINGLE_CHOICE", label: `${TYPE_LABELS.SINGLE_CHOICE} (otomatik)` },
  { value: "MULTIPLE_CHOICE", label: `${TYPE_LABELS.MULTIPLE_CHOICE} (otomatik)` },
  { value: "TRUE_FALSE", label: `${TYPE_LABELS.TRUE_FALSE} (otomatik)` },
  { value: "DROPDOWN", label: `${TYPE_LABELS.DROPDOWN} (otomatik)` },
  { value: "YES_NO", label: `${TYPE_LABELS.YES_NO} (manuel)` },
  { value: "TEXT_SHORT", label: `${TYPE_LABELS.TEXT_SHORT} (manuel)` },
  { value: "TEXT_LONG", label: `${TYPE_LABELS.TEXT_LONG} (manuel)` },
  { value: "RATING", label: `${TYPE_LABELS.RATING} (manuel)` },
  { value: "SCALE", label: `${TYPE_LABELS.SCALE} (manuel)` },
  { value: "DATE", label: `${TYPE_LABELS.DATE} (manuel)` },
  { value: "FILE_UPLOAD", label: `${TYPE_LABELS.FILE_UPLOAD} (manuel)` },
  { value: "MATRIX", label: `${TYPE_LABELS.MATRIX} (manuel)` },
];

const AUTO = AUTO_SCORED_TYPES as unknown as string[];
const OPTION_BASED = OPTION_BASED_TYPES as unknown as string[];

type LocalOption = { text: string; isCorrect: boolean };

export function QuestionEditModal({
  examId,
  question,
  open,
  onClose,
  onSaved,
}: {
  examId: string;
  question: QuestionItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState("SINGLE_CHOICE");
  const [points, setPoints] = useState("1");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<LocalOption[]>([
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);
  const [matrixRows, setMatrixRows] = useState<string[]>([""]);
  const [matrixCols, setMatrixCols] = useState<string[]>(["", ""]);
  const [allowedFileTypes, setAllowedFileTypes] = useState(DEFAULT_FILE_TYPES);
  const [saving, setSaving] = useState(false);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setInitializedFor(null);
      return;
    }
    const key = question?.id ?? "__new__";
    if (initializedFor === key) return;

    if (question) {
      setText(question.question);
      setType(question.type);
      setPoints(question.points.toString());
      setExplanation(question.explanation ?? "");
      if (question.options.length > 0) {
        setOptions(
          question.options.map((o) => ({
            text: o.text,
            isCorrect: o.isCorrect,
          }))
        );
      } else {
        setOptions([
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ]);
      }
      // Matrix config
      const cfg = (question as QuestionItem & {
        matrixConfig?: { rows?: string[]; cols?: string[] } | null;
      }).matrixConfig;
      if (cfg && Array.isArray(cfg.rows) && Array.isArray(cfg.cols)) {
        setMatrixRows(cfg.rows.length > 0 ? cfg.rows : [""]);
        setMatrixCols(cfg.cols.length >= 2 ? cfg.cols : ["", ""]);
      } else {
        setMatrixRows([""]);
        setMatrixCols(["", ""]);
      }
      // Allowed file types
      const aft = (question as QuestionItem & {
        allowedFileTypes?: string | null;
      }).allowedFileTypes;
      setAllowedFileTypes(aft ?? DEFAULT_FILE_TYPES);
    } else {
      setText("");
      setType("SINGLE_CHOICE");
      setPoints("1");
      setExplanation("");
      setOptions([
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ]);
      setMatrixRows([""]);
      setMatrixCols(["", ""]);
      setAllowedFileTypes(DEFAULT_FILE_TYPES);
    }
    setInitializedFor(key);
  }, [open, question, initializedFor]);

  // Tip değişince options / matrix / file types normalize
  useEffect(() => {
    if (!open) return;
    if (type === "TRUE_FALSE") {
      setOptions((prev) => {
        const wasTwo = prev.length === 2;
        const correctIdx = wasTwo ? prev.findIndex((o) => o.isCorrect) : -1;
        return [
          { text: "Doğru", isCorrect: correctIdx === 0 },
          { text: "Yanlış", isCorrect: correctIdx === 1 },
        ];
      });
    } else if (type === "YES_NO") {
      setOptions([
        { text: "Evet", isCorrect: false },
        { text: "Hayır", isCorrect: false },
      ]);
    } else if (!OPTION_BASED.includes(type)) {
      setOptions([]);
    } else {
      setOptions((prev) =>
        prev.length >= 2
          ? prev
          : [
              { text: "", isCorrect: false },
              { text: "", isCorrect: false },
            ]
      );
    }
  }, [type, open]);

  const addOption = () => {
    setOptions((prev) => [...prev, { text: "", isCorrect: false }]);
  };

  const removeOption = (idx: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const setOptionText = (idx: number, value: string) => {
    setOptions((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, text: value } : o))
    );
  };

  const setOptionCorrect = (idx: number, value: boolean) => {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (
          type === "SINGLE_CHOICE" ||
          type === "TRUE_FALSE" ||
          type === "DROPDOWN"
        ) {
          return { ...o, isCorrect: i === idx ? value : false };
        }
        return i === idx ? { ...o, isCorrect: value } : o;
      })
    );
  };

  const handleSave = async () => {
    if (saving) return;

    const trimmed = text.trim();
    if (trimmed.length < 3) {
      toast.error("Soru en az 3 karakter olmalı");
      return;
    }

    const p = parseInt(points, 10);
    if (isNaN(p) || p < 1 || p > 100) {
      toast.error("Puan 1-100 arası olmalı");
      return;
    }

    if (OPTION_BASED.includes(type)) {
      if (
        (type === "TRUE_FALSE" || type === "YES_NO") &&
        options.length !== 2
      ) {
        toast.error("Bu tip için tam 2 seçenek gerekli");
        return;
      }
      if (
        (type === "SINGLE_CHOICE" ||
          type === "MULTIPLE_CHOICE" ||
          type === "DROPDOWN") &&
        options.length < 2
      ) {
        toast.error("En az 2 seçenek gerekli");
        return;
      }
      if (AUTO.includes(type)) {
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (
          (type === "SINGLE_CHOICE" ||
            type === "TRUE_FALSE" ||
            type === "DROPDOWN") &&
          correctCount !== 1
        ) {
          toast.error("Tam 1 doğru cevap işaretleyin");
          return;
        }
        if (type === "MULTIPLE_CHOICE" && correctCount < 1) {
          toast.error("En az 1 doğru cevap işaretleyin");
          return;
        }
      }
      if (
        (type === "SINGLE_CHOICE" ||
          type === "MULTIPLE_CHOICE" ||
          type === "DROPDOWN") &&
        options.some((o) => o.text.trim().length === 0)
      ) {
        toast.error("Tüm seçenek metinleri doldurulmalı");
        return;
      }
    }

    if (type === "MATRIX") {
      const cleanRows = matrixRows.map((r) => r.trim()).filter(Boolean);
      const cleanCols = matrixCols.map((c) => c.trim()).filter(Boolean);
      if (cleanRows.length < 1 || cleanCols.length < 2) {
        toast.error("MATRIX: en az 1 satır ve 2 sütun olmalı");
        return;
      }
      if (cleanRows.length > 20 || cleanCols.length > 10) {
        toast.error("MATRIX: max 20 satır × 10 sütun");
        return;
      }
    }

    if (type === "FILE_UPLOAD" && allowedFileTypes.trim()) {
      const aft = allowedFileTypes.toLowerCase().trim();
      if (!/^[a-z0-9]+(,[a-z0-9]+)*$/.test(aft)) {
        toast.error("Dosya tipleri formatı: pdf,doc,jpg gibi");
        return;
      }
    }

    setSaving(true);
    try {
      const url = question
        ? `/api/akademi/admin/exams/${examId}/questions/${question.id}`
        : `/api/akademi/admin/exams/${examId}/questions`;
      const method = question ? "PATCH" : "POST";

      const payload: Record<string, unknown> = {
        question: trimmed,
        type,
        points: p,
        explanation: explanation.trim() || null,
      };
      if (OPTION_BASED.includes(type)) {
        payload.options = options.map((o) => ({
          text: o.text.trim(),
          isCorrect: AUTO.includes(type) ? o.isCorrect : false,
        }));
      } else {
        payload.options = [];
      }
      if (type === "MATRIX") {
        payload.matrixConfig = {
          rows: matrixRows.map((r) => r.trim()).filter(Boolean),
          cols: matrixCols.map((c) => c.trim()).filter(Boolean),
        };
      } else {
        payload.matrixConfig = null;
      }
      if (type === "FILE_UPLOAD") {
        payload.allowedFileTypes =
          allowedFileTypes.trim().toLowerCase() || null;
      } else {
        payload.allowedFileTypes = null;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Kayıt başarısız");
        return;
      }
      toast.success(question ? "Soru güncellendi" : "Soru eklendi");
      onSaved();
    } catch {
      toast.error("Beklenmeyen hata");
    } finally {
      setSaving(false);
    }
  };

  const showOptions = OPTION_BASED.includes(type);
  const isAuto = AUTO.includes(type);
  const canAddRemoveOptions =
    type === "SINGLE_CHOICE" ||
    type === "MULTIPLE_CHOICE" ||
    type === "DROPDOWN";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {question ? "Soruyu Düzenle" : "Yeni Soru"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Soru Tipi</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qtext">
              Soru Metni <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="qtext"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Soruyu girin..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qpoints">
                Puan <span className="text-red-500">*</span>
              </Label>
              <Input
                id="qpoints"
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                min={1}
                max={100}
              />
            </div>
            <div className="flex items-end pb-2 text-xs">
              {isAuto ? (
                <span className="text-green-700 font-medium">
                  ✓ Otomatik puanlanacak
                </span>
              ) : (
                <span className="text-amber-700 font-medium">
                  ⚠ Manuel grading gerekli
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qexp">Açıklama (opsiyonel)</Label>
            <Textarea
              id="qexp"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              placeholder="Sonuç ekranında gösterilecek açıklama..."
            />
          </div>

          {showOptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Seçenekler{" "}
                  {isAuto && (
                    <span
                      className="font-normal text-xs"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      (doğru cevabı işaretleyin)
                    </span>
                  )}
                </Label>
                {canAddRemoveOptions && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <Plus size={12} />
                    Seçenek Ekle
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {options.map((o, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {isAuto && (
                      <input
                        type={type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                        checked={o.isCorrect}
                        onChange={(e) =>
                          setOptionCorrect(idx, e.target.checked)
                        }
                        className="w-4 h-4 cursor-pointer"
                        name={`q-correct-${question?.id ?? "new"}`}
                      />
                    )}
                    <Input
                      value={o.text}
                      onChange={(e) => setOptionText(idx, e.target.value)}
                      disabled={type === "TRUE_FALSE" || type === "YES_NO"}
                      placeholder={`Seçenek ${idx + 1}`}
                    />
                    {canAddRemoveOptions && options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                        title="Seçeneği sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {type === "MATRIX" && (
            <div className="space-y-3 border-t pt-3">
              <div>
                <Label className="text-sm">Satırlar (sorulan ifadeler)</Label>
                <div className="space-y-1 mt-2">
                  {matrixRows.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-6 text-right font-mono">
                        #{idx + 1}
                      </span>
                      <Input
                        value={r}
                        onChange={(e) => {
                          const next = [...matrixRows];
                          next[idx] = e.target.value;
                          setMatrixRows(next);
                        }}
                        placeholder={`Satır ${idx + 1}`}
                      />
                      {matrixRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setMatrixRows(matrixRows.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 rounded text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMatrixRows([...matrixRows, ""])}
                  className="gap-1.5 h-7 text-xs mt-2"
                  disabled={matrixRows.length >= 20}
                >
                  <Plus size={12} />
                  Satır Ekle
                </Button>
              </div>

              <div>
                <Label className="text-sm">Sütunlar (cevap seçenekleri)</Label>
                <div className="space-y-1 mt-2">
                  {matrixCols.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-6 text-right font-mono">
                        #{idx + 1}
                      </span>
                      <Input
                        value={c}
                        onChange={(e) => {
                          const next = [...matrixCols];
                          next[idx] = e.target.value;
                          setMatrixCols(next);
                        }}
                        placeholder={`Sütun ${idx + 1}`}
                      />
                      {matrixCols.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setMatrixCols(matrixCols.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 rounded text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMatrixCols([...matrixCols, ""])}
                  className="gap-1.5 h-7 text-xs mt-2"
                  disabled={matrixCols.length >= 10}
                >
                  <Plus size={12} />
                  Sütun Ekle
                </Button>
              </div>
              <p className="text-xs text-amber-700 font-medium">
                ⚠ Manuel grading gerekli
              </p>
            </div>
          )}

          {type === "FILE_UPLOAD" && (
            <div className="space-y-2 border-t pt-3">
              <Label>İzin Verilen Dosya Tipleri</Label>
              <Input
                value={allowedFileTypes}
                onChange={(e) => setAllowedFileTypes(e.target.value)}
                placeholder={DEFAULT_FILE_TYPES}
                className="font-mono text-sm"
              />
              <p
                className="text-xs"
                style={{ color: "var(--ak-text-tertiary)" }}
              >
                Virgülle ayrılmış uzantılar (nokta yok). Boş bırakırsanız
                varsayılan: <span className="font-mono">{DEFAULT_FILE_TYPES}</span>
              </p>
              <p className="text-xs text-amber-700 font-medium">
                ⚠ Manuel grading gerekli (admin dosyayı incelemeli)
              </p>
            </div>
          )}

          {!showOptions && type !== "MATRIX" && type !== "FILE_UPLOAD" && (
            <div
              className="border rounded-md p-3 text-xs space-y-1"
              style={{
                background: "var(--ak-surface-secondary)",
                borderColor: "var(--ak-border-divider)",
                color: "var(--ak-text-secondary)",
              }}
            >
              <div>Bu tip soruda seçenek yok. Kullanıcı şu şekilde cevaplar:</div>
              {type === "TEXT_SHORT" && <div>→ Tek satırlık metin kutusu</div>}
              {type === "TEXT_LONG" && <div>→ Çok satırlı metin kutusu</div>}
              {type === "RATING" && <div>→ 1-5 arası yıldız seçimi</div>}
              {type === "SCALE" && <div>→ 1-10 arası kaydırıcı</div>}
              {type === "DATE" && <div>→ Tarih seçici</div>}
              <div className="text-amber-700 font-medium pt-1">
                Admin panelinden manuel grading gerekir.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
