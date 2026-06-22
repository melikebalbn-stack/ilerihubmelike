import { QuestionType } from "@/generated/prisma";

/**
 * Akademi soru sistemi merkezi sabitleri.
 * Sprint 2'de 9 tip + Sprint 3 PR-2'de 3 tip eklendi (DROPDOWN, FILE_UPLOAD, MATRIX).
 *
 * Burayı tek noktada yöneterek questions API + edit modal + scoring helper +
 * take page arasında sapma riskini elimine ediyoruz.
 */

export const SUPPORTED_TYPES: QuestionType[] = [
  QuestionType.SINGLE_CHOICE,
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.YES_NO,
  QuestionType.DROPDOWN,
  QuestionType.TEXT_SHORT,
  QuestionType.TEXT_LONG,
  QuestionType.RATING,
  QuestionType.SCALE,
  QuestionType.DATE,
  QuestionType.FILE_UPLOAD,
  QuestionType.MATRIX,
];

export const AUTO_SCORED_TYPES: QuestionType[] = [
  QuestionType.SINGLE_CHOICE,
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.DROPDOWN,
];

export const OPTION_BASED_TYPES: QuestionType[] = [
  QuestionType.SINGLE_CHOICE,
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.YES_NO,
  QuestionType.DROPDOWN,
];

export const MANUAL_TYPES: QuestionType[] = SUPPORTED_TYPES.filter(
  (t) => !AUTO_SCORED_TYPES.includes(t)
);

export const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: "Tek Seçim",
  MULTIPLE_CHOICE: "Çoklu Seçim",
  TRUE_FALSE: "Doğru/Yanlış",
  YES_NO: "Evet/Hayır",
  DROPDOWN: "Açılır Liste",
  TEXT_SHORT: "Kısa Metin",
  TEXT_LONG: "Uzun Metin",
  RATING: "Değerlendirme (1-5)",
  SCALE: "Skala (1-10)",
  DATE: "Tarih",
  FILE_UPLOAD: "Dosya Yükleme",
  MATRIX: "Matris",
};

export function isAutoScored(type: QuestionType | string): boolean {
  return (AUTO_SCORED_TYPES as string[]).includes(type as string);
}

export function isOptionBased(type: QuestionType | string): boolean {
  return (OPTION_BASED_TYPES as string[]).includes(type as string);
}

export function requiresMatrixConfig(type: QuestionType | string): boolean {
  return type === QuestionType.MATRIX;
}

export function isFileUpload(type: QuestionType | string): boolean {
  return type === QuestionType.FILE_UPLOAD;
}

export const DEFAULT_FILE_TYPES = "pdf,doc,docx,jpg,jpeg,png";
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
