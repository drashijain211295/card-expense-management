const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./extracted_data.json', 'utf8'));

function inferCategory(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('petrol') || d.includes('filling') || d.includes('fuel') || d.includes('automotive')) return 'Fuel';
  if (d.includes('bhature') || d.includes('food') || d.includes('restaurant') || d.includes('caterin')) return 'Food & Dining';
  if (d.includes('railway') || d.includes('travel') || d.includes('uber') || d.includes('ola')) return 'Travel';
  if (d.includes('bata') || d.includes('shop') || d.includes('gift') || d.includes('asspl') || d.includes('mobile')) return 'Shopping';
  if (d.includes('myjio') || d.includes('jio') || d.includes('airtel') || d.includes('bill') || d.includes('electricity')) return 'Telecom & Utilities';
  if (d.includes('annual fee') || d.includes('gst') || d.includes('fee') || d.includes('charge')) return 'Fees & Charges';
  return 'General';
}

const julyExpenses = data.july.transactions.map((t, index) => ({
  id: `july_${index + 1}`,
  month: 'July 2026',
  date: t.date || 'Jul 2026',
  description: t.description,
  slipAmount: t.slipAmount || 0,
  statementAmount: t.statementAmount || 0,
  fuelWaiver: t.fuelWaiver || 0,
  refundAmount: t.refundAmount || 0,
  usedBy: t.usedBy || 'Both',
  paymentType: t.paymentType || 'Card',
  category: inferCategory(t.description),
  remarks: t.remarks || ''
}));

const augustExpenses = data.august.transactions.map((t, index) => ({
  id: `aug_${index + 1}`,
  month: 'August 2026',
  date: t.date || 'Aug 2026',
  description: t.description,
  slipAmount: t.slipAmount || 0,
  statementAmount: t.statementAmount || 0,
  fuelWaiver: t.fuelWaiver || 0,
  refundAmount: t.refundAmount || 0,
  usedBy: t.usedBy || 'Both',
  paymentType: t.paymentType || 'Card',
  category: inferCategory(t.description),
  remarks: t.remarks || ''
}));

const allExpenses = [...julyExpenses, ...augustExpenses];

const initialPayments = [
  {
    id: 'pay_jul_1',
    month: 'July 2026',
    date: '31 Jul 26',
    person: 'Kitkat',
    amount: 10000.00,
    paymentMethod: 'Bank Transfer',
    notes: 'Advance settlement payment'
  },
  {
    id: 'pay_jul_2',
    month: 'July 2026',
    date: '31 Jul 26',
    person: 'Rashu',
    amount: 4714.99,
    paymentMethod: 'UPI',
    notes: 'Full share settled'
  },
  {
    id: 'pay_aug_1',
    month: 'August 2026',
    date: '31 Aug 26',
    person: 'Kitkat',
    amount: 4567.42,
    paymentMethod: 'Bank Transfer',
    notes: 'Share payment'
  },
  {
    id: 'pay_aug_2',
    month: 'August 2026',
    date: '31 Aug 26',
    person: 'Rashu',
    amount: 0.00,
    paymentMethod: '',
    notes: 'Pending'
  }
];

const jsDataContent = `// Initial data extracted directly from Professional_Card_Expense_Tracker_Kitkat_Rashu_v2.xlsx

const DEFAULT_SETTINGS = {
  person1: "Kitkat",
  person2: "Rashu",
  currencySymbol: "₹",
  defaultMonth: "August 2026"
};

const CATEGORIES = [
  "Fuel",
  "Food & Dining",
  "Travel",
  "Shopping",
  "Telecom & Utilities",
  "Fees & Charges",
  "General"
];

const INITIAL_EXPENSES = ${JSON.stringify(allExpenses, null, 2)};

const INITIAL_PAYMENTS = ${JSON.stringify(initialPayments, null, 2)};

const AVAILABLE_MONTHS = ["July 2026", "August 2026"];

// Export to window for vanilla browser usage
window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
window.CATEGORIES = CATEGORIES;
window.INITIAL_EXPENSES = INITIAL_EXPENSES;
window.INITIAL_PAYMENTS = INITIAL_PAYMENTS;
window.AVAILABLE_MONTHS = AVAILABLE_MONTHS;
`;

fs.writeFileSync('./js/data.js', jsDataContent);
console.log("Created ./js/data.js with", allExpenses.length, "expenses.");
