const XLSX = require("xlsx");
const path = "/home/rokunet/projects/ilerihub/public/uploads/evidences/2026/01/L11_711_Varl_k_Gruplar__Listesi_1769409130905_ulenya.xls";
const wb = XLSX.readFile(path);
console.log("Sheets:", wb.SheetNames);
for (const name of wb.SheetNames) {
  console.log("\n=== Sheet:", name, "===");
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false });
  rows.forEach((r, i) => console.log(i, JSON.stringify(r)));
}
