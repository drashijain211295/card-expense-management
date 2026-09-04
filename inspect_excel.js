const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('./Professional_Card_Expense_Tracker_Kitkat_Rashu_v2.xlsx', { cellFormula: true, cellHTML: false, cellNF: true });

console.log("=== SHEET NAMES ===");
console.log(workbook.SheetNames);

const output = {};

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  console.log(`\n================== SHEET: ${sheetName} ==================`);
  console.log("Ref:", sheet['!ref']);
  
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  console.log(`Total rows: ${rows.length}`);
  
  // Extract all formulas
  const formulas = [];
  const cells = {};
  for (const cellAddress in sheet) {
    if (cellAddress.startsWith('!')) continue;
    const cell = sheet[cellAddress];
    cells[cellAddress] = {
      v: cell.v,
      w: cell.w,
      t: cell.t,
      f: cell.f
    };
    if (cell.f) {
      formulas.push({ cell: cellAddress, formula: cell.f, value: cell.v, formatted: cell.w });
    }
  }
  
  output[sheetName] = {
    ref: sheet['!ref'],
    merges: sheet['!merges'],
    rows: rows,
    formulas: formulas
  };
});

fs.writeFileSync('./excel_dump.json', JSON.stringify(output, null, 2));
console.log("\nDetailed dump written to excel_dump.json");
