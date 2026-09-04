const XLSX = require('xlsx');

const workbook = XLSX.readFile('./Professional_Card_Expense_Tracker_Kitkat_Rashu_v2.xlsx', { cellFormula: true, cellHTML: false, cellNF: true });

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  console.log(`\n======================================================================`);
  console.log(`SHEET: ${sheetName}`);
  console.log(`======================================================================`);
  
  const range = XLSX.utils.decode_range(sheet['!ref']);
  console.log(`Range: ${sheet['!ref']} (Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1})`);
  
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
});
