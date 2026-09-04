const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('./Professional_Card_Expense_Tracker_Kitkat_Rashu_v2.xlsx', { cellFormula: true, cellHTML: false, cellNF: true });

function parseSheet(sheetName) {
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  const transactions = [];
  
  // Headers are on row index 1 (Excel row 2)
  // Data starts on row index 2 (Excel row 3)
  for (let R = 2; R <= range.e.r; ++R) {
    const getVal = (colLetter) => {
      const cell = sheet[`${colLetter}${R + 1}`];
      return cell ? cell.v : null;
    };
    const getNum = (colLetter) => {
      const val = getVal(colLetter);
      if (val === null || val === undefined || val === '') return 0;
      const num = parseFloat(String(val).replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    };
    
    const date = getVal('A');
    const description = getVal('B');
    const slipAmount = getNum('C');
    const statementAmount = getNum('D');
    const fuelWaiver = getNum('E');
    const refundAmount = getNum('F');
    const usedBy = getVal('G');
    const paymentType = getVal('H');
    const remarks = getVal('L') || '';

    // If both date and description and amount are empty, skip row
    if (!date && !description && !statementAmount && !slipAmount) continue;

    transactions.push({
      id: `${sheetName.replace(/\s+/g, '_')}_${R + 1}`,
      date: date ? String(date).trim() : '',
      description: description ? String(description).trim() : '',
      slipAmount: slipAmount,
      statementAmount: statementAmount,
      fuelWaiver: fuelWaiver,
      refundAmount: refundAmount,
      usedBy: usedBy ? String(usedBy).trim() : 'Both',
      paymentType: paymentType ? (String(paymentType).toLowerCase().includes('non-card') ? 'Non-Card' : 'Card') : 'Card',
      remarks: remarks ? String(remarks).trim() : ''
    });
  }

  // Also extract summary / payment cells from columns N and O
  // Let's inspect all O cells with their labels in N
  const summary = {};
  for (let R = 1; R <= range.e.r; ++R) {
    const label = sheet[`N${R + 1}`] ? sheet[`N${R + 1}`].v : null;
    const cellO = sheet[`O${R + 1}`];
    if (label && cellO) {
      summary[label.trim()] = {
        value: cellO.v,
        formatted: cellO.w,
        formula: cellO.f || null
      };
    }
  }

  return { transactions, summary };
}

const julyData = parseSheet('Card Expense Tracker july');
const augustData = parseSheet('Card Expense Tracker august');

console.log("July Transactions Count:", julyData.transactions.length);
console.log("July Summary:", julyData.summary);
console.log("\nAugust Transactions Count:", augustData.transactions.length);
console.log("August Summary:", augustData.summary);

fs.writeFileSync('./extracted_data.json', JSON.stringify({
  july: julyData,
  august: augustData
}, null, 2));

console.log("\nSaved to extracted_data.json");
