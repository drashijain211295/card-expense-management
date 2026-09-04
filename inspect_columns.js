const fs = require('fs');
const dump = JSON.parse(fs.readFileSync('./excel_dump.json', 'utf8'));

for (const sheetName in dump) {
  console.log(`\n======================================================================`);
  console.log(`SHEET: ${sheetName}`);
  console.log(`======================================================================`);
  const sheet = dump[sheetName];
  
  console.log("\n--- FULL ROWS PRINT ---");
  sheet.rows.forEach((r, idx) => {
    console.log(`Row ${idx + 1}: ${r.map((c, i) => `[Col ${String.fromCharCode(65+i)}: ${c}]`).join(' ')}`);
  });
}
