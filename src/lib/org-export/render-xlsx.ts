// Org export — SheetModel'i exceljs Workbook'a çevirip Buffer döndürür.
// Salt dönüşüm: Prisma/DB erişimi YOK. exceljs YALNIZ bu dosyada import edilir.

import ExcelJS from "exceljs";
import type { SheetModel } from "./build-sheet-model";

// ÖN KONTROL: build-sheet-model.ts'teki tüm koordinatlar (TITLE_ROW=1, TITLE_COL_START=1,
// TREE_BASE_COL=1 vb.) 1-index. exceljs de 1-index (ws.getCell(1,1) === "A1"). Aynı
// indeksleme — offset gerekmiyor, +1 uygulanmadı.

// Tek bir SheetModel'i workbook'a bir worksheet olarak ekler (hücre/merge/fill/border
// mantığı önceki tek-sheet sürümüyle AYNEN — sadece worksheet başına çağrılıyor).
function renderModelIntoWorkbook(wb: ExcelJS.Workbook, model: SheetModel): void {
  const ws = wb.addWorksheet(model.sheetName);

  // 1) Hücreler
  for (const c of model.cells) {
    const cell = ws.getCell(c.row, c.col);
    cell.value = c.value;
    const s = c.style;
    if (s) {
      if (s.bold || s.fontSize) cell.font = { bold: !!s.bold, size: s.fontSize ?? 11 };
      if (s.fill === "YELLOW") {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFF00" }, // IV-LS-45 sarısı
        };
      }
      if (s.align) cell.alignment = { horizontal: s.align, vertical: "middle", wrapText: true };
      if (s.border) {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }
  }

  // 2) Merge'ler
  for (const m of model.merges) {
    ws.mergeCells(m.r1, m.c1, m.r2, m.c2);
  }

  // 3) Sütun genişlikleri
  if (model.colWidths) {
    for (const cw of model.colWidths) {
      ws.getColumn(cw.col).width = cw.width;
    }
  }
}

export async function renderSheetModelToXlsx(models: SheetModel[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  for (const model of models) {
    renderModelIntoWorkbook(wb, model);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
