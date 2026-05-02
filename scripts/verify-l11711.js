const XLSX = require("xlsx");
const path = "/home/rokunet/projects/ilerihub/public/uploads/iso27001/documents/1777414115852-aed83ab2377459b5.xlsx";
const wb = XLSX.readFile(path);
const ws = wb.Sheets["2-Yazılım Varlıkları"];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
console.log("Header:", rows[2]);
console.log("");
for (let i = 4; i < 30; i++) {
  const r = rows[i];
  if (!r[0]) continue;
  console.log(`${String(r[0]).padEnd(18)} | sınıf: ${String(r[2] || "").padEnd(28)} | değer: ${r[7]}`);
}
