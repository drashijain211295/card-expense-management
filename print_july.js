const XLSX = require('xlsx');

const workbook = XLSX.readFile('./Professional_Card_Expense_Tracker_Kitkat_Rashu_v2.xlsx', { cellFormula: true, cellHTML: false, cellNF: true });
const sheet = workbook.Sheets['Card Expense Tracker july'];
const range = XLSX.utils.decode_range(sheet['!ref']);

console.log("=== JULY SHEET RAW DUMP ===");
for (let R = range.s.r; R <= range.e.r; ++R) {
  let rowStr = `Row ${String(R + 1).padStart(2, ' ')}: `;
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell_address = XLSX.utils.encode_cell({c: C, r: R});
    const cell = sheet[cell_address];
    const colLetter = XLSX.utils.encode_col(C);
    if (cell) {
      let val = cell.w !== undefined ? cell.w : cell.v;
      let formula = cell.f ? ` [f: =${cell.f}]` : '';
      rowStr += `| ${colLetter}: ${val}${formula} `;
    } else {
      rowStr += `| ${colLetter}: <empty> `;
    }
  }
  console.log(rowStr);
}
