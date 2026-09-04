const fs = require('fs');

global.window = global;
eval(fs.readFileSync('./js/data.js', 'utf8'));

const newRecords = [
  {
    id: "sep_1",
    month: "September 2026",
    date: "24-08-2026",
    description: "Fuel / Card Spend",
    slipAmount: 572.85,
    statementAmount: 0,
    fuelWaiver: 0,
    refundAmount: 0,
    usedBy: "Rashu",
    paymentType: "Card",
    category: "Fuel",
    remarks: "Awaiting 24th Sep Statement"
  },
  {
    id: "sep_2",
    month: "September 2026",
    date: "26-08-2026",
    description: "Fuel / Card Spend",
    slipAmount: 343.71,
    statementAmount: 0,
    fuelWaiver: 0,
    refundAmount: 0,
    usedBy: "Kitkat",
    paymentType: "Card",
    category: "Fuel",
    remarks: "Awaiting 24th Sep Statement"
  },
  {
    id: "sep_3",
    month: "September 2026",
    date: "27-08-2026",
    description: "Fuel / Card Spend",
    slipAmount: 458.24,
    statementAmount: 0,
    fuelWaiver: 0,
    refundAmount: 0,
    usedBy: "Rashu",
    paymentType: "Card",
    category: "Fuel",
    remarks: "Awaiting 24th Sep Statement"
  },
  {
    id: "sep_4",
    month: "September 2026",
    date: "01-09-2026",
    description: "Fuel / Card Spend",
    slipAmount: 695.00,
    statementAmount: 0,
    fuelWaiver: 0,
    refundAmount: 0,
    usedBy: "Rashu",
    paymentType: "Card",
    category: "Fuel",
    remarks: "Awaiting 24th Sep Statement"
  },
  {
    id: "sep_5",
    month: "September 2026",
    date: "01-09-2026",
    description: "Fuel / Card Spend",
    slipAmount: 515.56,
    statementAmount: 0,
    fuelWaiver: 0,
    refundAmount: 0,
    usedBy: "Rashu",
    paymentType: "Card",
    category: "Fuel",
    remarks: "Awaiting 24th Sep Statement"
  },
  {
    id: "sep_6",
    month: "September 2026",
    date: "02-09-2026",
    description: "Fuel / Card Spend",
    slipAmount: 336.00,
    statementAmount: 0,
    fuelWaiver: 0,
    refundAmount: 0,
    usedBy: "Rashu",
    paymentType: "Card",
    category: "Fuel",
    remarks: "Awaiting 24th Sep Statement"
  }
];

const existing = window.INITIAL_EXPENSES.filter(e => !e.id.startsWith("sep_"));
const updatedExpenses = [...existing, ...newRecords];

const updatedMonths = ["September 2026", "August 2026", "July 2026"];
const defaultSettings = {
  ...window.DEFAULT_SETTINGS,
  defaultMonth: "September 2026"
};

const fileContent = `// Initial data extracted directly from Professional_Card_Expense_Tracker_Kitkat_Rashu_v2.xlsx + September additions

const DEFAULT_SETTINGS = ${JSON.stringify(defaultSettings, null, 2)};

const CATEGORIES = [
  "Fuel",
  "Food & Dining",
  "Travel",
  "Shopping",
  "Telecom & Utilities",
  "Fees & Charges",
  "General"
];

const INITIAL_EXPENSES = ${JSON.stringify(updatedExpenses, null, 2)};

const INITIAL_PAYMENTS = ${JSON.stringify(window.INITIAL_PAYMENTS, null, 2)};

const AVAILABLE_MONTHS = ${JSON.stringify(updatedMonths, null, 2)};

// Export to window for vanilla browser usage
window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
window.CATEGORIES = CATEGORIES;
window.INITIAL_EXPENSES = INITIAL_EXPENSES;
window.INITIAL_PAYMENTS = INITIAL_PAYMENTS;
window.AVAILABLE_MONTHS = AVAILABLE_MONTHS;
`;

fs.writeFileSync('./js/data.js', fileContent);
console.log("Updated js/data.js with", updatedExpenses.length, "expenses.");
