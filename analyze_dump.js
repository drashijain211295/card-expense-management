const fs = require('fs');
const dump = JSON.parse(fs.readFileSync('./excel_dump.json', 'utf8'));

for (const sheetName in dump) {
  console.log(`\n######################################################################`);
  console.log(`SHEET: ${sheetName}`);
  console.log(`######################################################################`);
  
  const sheet = dump[sheetName];
  console.log("\n--- ROWS ---");
  sheet.rows.forEach((r, idx) => {
    console.log(`Row ${idx + 1}:`, JSON.stringify(r));
  });

  console.log("\n--- FORMULAS ---");
  sheet.formulas.forEach(f => {
    console.log(`${f.cell} = ${f.formula}  -->  [${f.value}] (${f.formatted})`);
  });
}
