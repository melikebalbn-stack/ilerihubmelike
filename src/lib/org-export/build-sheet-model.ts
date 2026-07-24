// Org export — kütüphane-bağımsız soyut yerleşim modeli (IV-LS-45 kalite çerçevesi, EK-C).
// Hiçbir Excel kütüphanesi (xlsx/exceljs) burada ÇAĞRILMAZ. Fiziksel Excel üretimi
// bu modeli tüketen AYRI bir adımdadır (exceljs onayı sonrası).
//
// Prisma: yalnız OKUMA (findUnique/findMany). Personnel/Position'a hiç dokunulmaz.

import { prisma } from "@/lib/prisma";

export type CellStyle = {
  bold?: boolean;
  fill?: "YELLOW" | "NONE";
  border?: boolean;
  align?: "left" | "center" | "right";
  fontSize?: number;
};

export type Cell = { row: number; col: number; value: string; style?: CellStyle };
export type Merge = { r1: number; c1: number; r2: number; c2: number };
export type SheetModel = {
  sheetName: string;
  cells: Cell[];
  merges: Merge[];
  colWidths?: { col: number; width: number }[];
};

// ─── Yerleşim sabitleri (koordinatlar öneri; mantık sabit) ───────────────────

const TITLE_ROW = 1;
const TITLE_COL_START = 1;
const TITLE_COL_END = 10;

const DOC_INFO_START_ROW = 2; // 4 satır: Doküman No / İlk Yayın Tarihi / Rev No / Say No
const DOC_INFO_LABEL_COL = 9;
const DOC_INFO_VALUE_COL = 10;

const SORUMLU_HEADER_ROW = 7;
const SORUMLU_DATA_START_ROW = 8; // 5 satır (sira 1-5)
const SORUMLU_COL_1 = 9;
const SORUMLU_COL_2 = 10;

const TREE_START_ROW = 14; // gövde — ağaç kökün çocuklarından başlar (kök zaten BAŞLIK'ta)
const TREE_BASE_COL = 1;
const LEVEL_INDENT = 2; // her derinlik seviyesi 2 sütun kayar
const BOX_WIDTH = 4; // her kutu 4 sütun genişliğinde merge

interface FlatOrgUnit {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  unitType: string;
  approvedHeadcount: number | null;
  isExternal: boolean;
  vekaletDurumu: boolean;
  vekilAdi: string | null;
  positionStatus: string;
}

interface TreeOrgUnit extends FlatOrgUnit {
  children: TreeOrgUnit[];
}

// page.tsx'teki buildTree ile aynı mantık (parentId ile ağaç kurma), server tarafı düz veri için
function buildTree(flat: FlatOrgUnit[]): TreeOrgUnit[] {
  const byId = new Map<string, TreeOrgUnit>();
  flat.forEach((u) => byId.set(u.id, { ...u, children: [] }));
  const roots: TreeOrgUnit[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  byId.forEach((n) => n.children.sort((a, b) => a.sortOrder - b.sortOrder));
  return roots;
}

function formatDateTr(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("tr-TR");
}

// ─── Revizyon Geçmişi sheet yerleşimi ─────────────────────────────────────────

const REV_TITLE_ROW = 1;
const REV_HEADER_ROW = 2;
const REV_DATA_START_ROW = 3;
const REV_COLS = { revNo: 1, tarih: 2, aciklama: 3, degisiklikYeri: 4, yapan: 5 };

async function buildRevizyonSheetModel(orgUnitId: string, kokAd: string): Promise<SheetModel> {
  // SALT OKUMA — yazma yok
  const revizyonlar = await prisma.orgRevizyon.findMany({
    where: { orgUnitId },
    orderBy: { revNo: "asc" },
    select: {
      revNo: true,
      tarih: true,
      aciklama: true,
      degisiklikYeri: true,
      yapan: true,
    },
  });

  const cells: Cell[] = [];
  const merges: Merge[] = [];

  cells.push({
    row: REV_TITLE_ROW,
    col: REV_COLS.revNo,
    value: `REVİZYON GEÇMİŞİ - ${kokAd}`,
    style: { bold: true, align: "center", fontSize: 14 },
  });
  merges.push({ r1: REV_TITLE_ROW, c1: REV_COLS.revNo, r2: REV_TITLE_ROW, c2: REV_COLS.yapan });

  const headers: [string, number][] = [
    ["Rev No", REV_COLS.revNo],
    ["Tarih", REV_COLS.tarih],
    ["Değişiklik Açıklaması", REV_COLS.aciklama],
    ["Değişiklik Yapılan Yer", REV_COLS.degisiklikYeri],
    ["Yapan", REV_COLS.yapan],
  ];
  headers.forEach(([label, col]) => {
    cells.push({
      row: REV_HEADER_ROW,
      col,
      value: label,
      style: { bold: true, fill: "YELLOW", border: true, align: "center" },
    });
  });

  if (revizyonlar.length === 0) {
    cells.push({
      row: REV_DATA_START_ROW,
      col: REV_COLS.revNo,
      value: "Kayıt yok",
      style: { align: "center", border: true },
    });
    merges.push({ r1: REV_DATA_START_ROW, c1: REV_COLS.revNo, r2: REV_DATA_START_ROW, c2: REV_COLS.yapan });
  } else {
    revizyonlar.forEach((r, i) => {
      const row = REV_DATA_START_ROW + i;
      cells.push({ row, col: REV_COLS.revNo, value: String(r.revNo), style: { border: true, align: "center" } });
      cells.push({ row, col: REV_COLS.tarih, value: formatDateTr(r.tarih), style: { border: true, align: "center" } });
      cells.push({ row, col: REV_COLS.aciklama, value: r.aciklama, style: { border: true, align: "left" } });
      cells.push({ row, col: REV_COLS.degisiklikYeri, value: r.degisiklikYeri, style: { border: true, align: "left" } });
      cells.push({ row, col: REV_COLS.yapan, value: r.yapan, style: { border: true, align: "center" } });
    });
  }

  return {
    sheetName: "Revizyon Gecmisi",
    cells,
    merges,
    colWidths: [
      { col: REV_COLS.revNo, width: 10 },
      { col: REV_COLS.tarih, width: 14 },
      { col: REV_COLS.aciklama, width: 40 },
      { col: REV_COLS.degisiklikYeri, width: 30 },
      { col: REV_COLS.yapan, width: 20 },
    ],
  };
}

export async function buildOrgSheetModel(kokKodu: string): Promise<SheetModel[]> {
  // ── Veri: kök + meta + sorumlu tablosu (SADECE OKUMA) ─────────────────────
  const kok = await prisma.orgUnit.findUnique({
    where: { code: kokKodu },
    include: {
      bolumMeta: true,
      sorumluluklar: { orderBy: { sira: "asc" } },
    },
  });

  if (!kok) {
    throw new Error(`OrgUnit bulunamadı: ${kokKodu}`);
  }

  // ── Veri: kökün tüm alt ağacı (flat, kendisi dahil) ───────────────────────
  const flatDescendants: FlatOrgUnit[] = await prisma.orgUnit.findMany({
    where: {
      OR: [{ code: kokKodu }, { code: { startsWith: `${kokKodu}-` } }],
    },
    select: {
      id: true,
      code: true,
      name: true,
      parentId: true,
      level: true,
      sortOrder: true,
      unitType: true,
      approvedHeadcount: true,
      isExternal: true,
      vekaletDurumu: true,
      vekilAdi: true,
      positionStatus: true,
    },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
  });

  const tree = buildTree(flatDescendants);
  const kokNode = tree.find((r) => r.id === kok.id);
  if (!kokNode) {
    throw new Error(`Ağaç kurulamadı: kök düğüm (${kokKodu}) alt ağaçta bulunamadı`);
  }

  // ── Veri: POSITION kutuları için koltuklar (aktif OrgEmployee) ────────────
  const positionIds = flatDescendants.filter((u) => u.unitType === "POSITION").map((u) => u.id);
  const employees = await prisma.orgEmployee.findMany({
    where: { orgUnitId: { in: positionIds }, isActive: true },
    select: { orgUnitId: true, displayName: true },
  });
  const employeesByUnit = new Map<string, string[]>();
  for (const e of employees) {
    const arr = employeesByUnit.get(e.orgUnitId) ?? [];
    arr.push(e.displayName);
    employeesByUnit.set(e.orgUnitId, arr);
  }

  const cells: Cell[] = [];
  const merges: Merge[] = [];

  // ── 1) SAĞ ÜST doküman bloğu ──────────────────────────────────────────────
  const meta = kok.bolumMeta;
  const docInfoRows: [string, string][] = [
    ["Doküman No", meta?.dokumanNo ?? ""],
    ["İlk Yayın Tarihi", formatDateTr(meta?.ilkYayinTarihi)],
    ["Rev No", meta?.revNo ?? ""],
    ["Say No", meta?.sayNo ?? ""],
  ];
  docInfoRows.forEach(([label, value], i) => {
    const r = DOC_INFO_START_ROW + i;
    cells.push({ row: r, col: DOC_INFO_LABEL_COL, value: label, style: { bold: true, align: "right" } });
    cells.push({ row: r, col: DOC_INFO_VALUE_COL, value, style: { align: "left" } });
  });

  // ── 2) BAŞLIK (üst orta, merge, bold, büyük font) ─────────────────────────
  cells.push({
    row: TITLE_ROW,
    col: TITLE_COL_START,
    value: `İLERİ GROUP ORGANİZASYON ŞEMASI - ${kok.name}`,
    style: { bold: true, align: "center", fontSize: 14 },
  });
  merges.push({ r1: TITLE_ROW, c1: TITLE_COL_START, r2: TITLE_ROW, c2: TITLE_COL_END });

  // ── 3) SAĞ ÜST sorumlu tablosu (sira sıralı) ──────────────────────────────
  cells.push({
    row: SORUMLU_HEADER_ROW,
    col: SORUMLU_COL_1,
    value: "1.Sorumlu",
    style: { bold: true, fill: "YELLOW", border: true, align: "center" },
  });
  cells.push({
    row: SORUMLU_HEADER_ROW,
    col: SORUMLU_COL_2,
    value: "Yedek Sorumlu",
    style: { bold: true, fill: "YELLOW", border: true, align: "center" },
  });
  kok.sorumluluklar.forEach((s, i) => {
    const r = SORUMLU_DATA_START_ROW + i;
    cells.push({ row: r, col: SORUMLU_COL_1, value: s.birinciSorumlu, style: { border: true } });
    cells.push({ row: r, col: SORUMLU_COL_2, value: s.yedekSorumlu ?? "", style: { border: true } });
  });

  // ── 4) GÖVDE — ağaç (kök zaten BAŞLIK'ta; gövde kökün çocuklarından başlar) ─
  let currentRow = TREE_START_ROW;

  function layoutNode(node: TreeOrgUnit, level: number) {
    const colStart = TREE_BASE_COL + level * LEVEL_INDENT;
    const colEnd = colStart + BOX_WIDTH - 1;
    const disKaynakEki = node.isExternal ? " (Dış Kaynak)" : "";

    if (node.unitType === "POSITION") {
      const names = employeesByUnit.get(node.id) ?? [];
      const m = names.length;
      const bos = m === 0;
      const vekaletli = node.vekaletDurumu && bos; // vekalet yalnız boş kadroda anlamlı
      const pasif = node.positionStatus === "DONDURULDU";
      const unvanRow = currentRow;
      const isimRow = currentRow + 1;

      // PASİF (dondurulmuş) pozisyonlar ekranda gizli ama export bunları hâlâ
      // getiriyor (flatDescendants sorgusu positionStatus'a göre filtrelemiyor) —
      // gerçek boş kadrolarla karışmasın diye unvana "(PASİF)" eki eklenir.
      const unvanDeğeri = `${node.name}${disKaynakEki}${pasif ? " (PASİF)" : ""}`;
      const isimDeğeri = pasif
        ? "PASİF POZİSYON"
        : vekaletli
          ? `Vekaleten: ${node.vekilAdi ?? ""}`
          : bos
            ? "BOŞ KADRO"
            : names.join(", ");

      cells.push({
        row: unvanRow,
        col: colStart,
        value: unvanDeğeri,
        style: { bold: true, border: true, fill: bos ? "YELLOW" : "NONE", align: "center" },
      });
      merges.push({ r1: unvanRow, c1: colStart, r2: unvanRow, c2: colEnd });

      cells.push({
        row: isimRow,
        col: colStart,
        value: isimDeğeri,
        style: { border: true, fill: bos ? "YELLOW" : "NONE", align: "left" },
      });
      merges.push({ r1: isimRow, c1: colStart, r2: isimRow, c2: colEnd });

      currentRow += 2;
    } else {
      // DEPARTMENT/GROUP/vb. — koltuk verisi yok, tek satırlık başlık kutusu
      cells.push({
        row: currentRow,
        col: colStart,
        value: `${node.name}${disKaynakEki}`,
        style: { bold: true, border: true, fill: "NONE", align: "center" },
      });
      merges.push({ r1: currentRow, c1: colStart, r2: currentRow, c2: colEnd });

      currentRow += 1;
    }

    for (const child of node.children) {
      layoutNode(child, level + 1);
    }
  }

  for (const child of kokNode.children) {
    layoutNode(child, 0);
  }

  const lastTreeRow = currentRow - 1;

  // ── 5) ALT — imza bloğu (3 sütun merge) ───────────────────────────────────
  const SIGNATURE_ROW = lastTreeRow + 2;
  cells.push({
    row: SIGNATURE_ROW,
    col: 1,
    value: `Hazırlayan: ${meta?.hazirlayan ?? ""}`,
    style: { bold: true, align: "center", border: true },
  });
  merges.push({ r1: SIGNATURE_ROW, c1: 1, r2: SIGNATURE_ROW, c2: 3 });

  cells.push({
    row: SIGNATURE_ROW,
    col: 4,
    value: `Yönetim Temsilcisi: ${meta?.yonetimTemsilcisi ?? ""}`,
    style: { bold: true, align: "center", border: true },
  });
  merges.push({ r1: SIGNATURE_ROW, c1: 4, r2: SIGNATURE_ROW, c2: 6 });

  cells.push({
    row: SIGNATURE_ROW,
    col: 7,
    value: `Genel Müdür Onayı: ${meta?.gmOnayi ?? ""}`,
    style: { bold: true, align: "center", border: true },
  });
  merges.push({ r1: SIGNATURE_ROW, c1: 7, r2: SIGNATURE_ROW, c2: 9 });

  // ── 6) Gizlilik (merge, center) ────────────────────────────────────────────
  const GIZLILIK_ROW = SIGNATURE_ROW + 2;
  cells.push({
    row: GIZLILIK_ROW,
    col: 1,
    value: meta?.gizlilik ?? "HİZMETE ÖZEL",
    style: { bold: true, align: "center" },
  });
  merges.push({ r1: GIZLILIK_ROW, c1: 1, r2: GIZLILIK_ROW, c2: 10 });

  // ── 7) EN ALT SOL: isoMadde ────────────────────────────────────────────────
  const ISO_MADDE_ROW = GIZLILIK_ROW + 1;
  cells.push({
    row: ISO_MADDE_ROW,
    col: 1,
    value: meta?.isoMadde ?? "",
    style: { align: "left", fontSize: 8 },
  });

  const anaSemaModel: SheetModel = {
    sheetName: kok.name.slice(0, 31), // Excel sheet adı 31 karakter sınırı
    cells,
    merges,
    colWidths: [
      // 1-4: unvan+isim taşıyan sütunlar (okunabilirlik için genişletildi) —
      // yalnız width değişti, hiçbir Cell/Merge koordinatı değişmedi.
      { col: 1, width: 30 },
      { col: 2, width: 26 },
      { col: 3, width: 24 },
      { col: 4, width: 24 },
      { col: 5, width: 20 },
      { col: 6, width: 20 },
      { col: 7, width: 20 },
      { col: 8, width: 20 },
      { col: 9, width: 22 },
      { col: 10, width: 22 },
    ],
  };

  // Revizyon Geçmişi — ayrı sheet, ana şema çerçevesi (IV-LS-45) değişmez
  const revizyonModel = await buildRevizyonSheetModel(kok.id, kok.name);

  return [anaSemaModel, revizyonModel];
}
