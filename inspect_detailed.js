const fs = require('fs');
const dump = JSON.parse(fs.readFileSync('./excel_dump.json', 'utf8'));

['Card Expense Tracker july', 'Card Expense Tracker august'].forEach(sheetName => {
  console.log(`\n======================================================================`);
  console.log(`SHEET: ${sheetName}`);
  console.log(`======================================================================`);
  const sheet = dump[sheetName];
  
  console.log("\n--- HEADERS & ROWS ---");
  sheet.rows.forEach((r, idx) => {
    console.log(`Row ${String(idx + 1).padStart(2, ' ')}: ` + r.map((c, i) => {
      const col = String.fromCharCode(65 + i);
      return `[${col}: ${c === null ? 'null' : c}]`;
    }).join(' '));
  });

  console.log("\n--- FORMULAS DETAILED ---");
  sheet.formulas.forEach(f => {
    console.log(`${f.cell.padEnd(5)} = ${f.formula.padEnd(45)} => ${f.value} (${f.formatted})`);
  });
});
