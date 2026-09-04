const fs = require('fs');

global.window = global;

eval(fs.readFileSync('./js/data.js', 'utf8'));
eval(fs.readFileSync('./js/calculations.js', 'utf8'));

console.log("=================== JULY 2026 VALIDATION ===================");
const julySummary = ExpenseCalculator.calculateMonthSummary(window.INITIAL_EXPENSES, window.INITIAL_PAYMENTS, "July 2026", window.DEFAULT_SETTINGS);
console.log("Card Statement Total:    ", julySummary.cardStatementTotal.toFixed(2), " [Excel: 8992.35]");
console.log("Fuel Waiver:             ", julySummary.cardFuelWaiverTotal.toFixed(2), " [Excel: 45.79]");
console.log("Refund:                  ", julySummary.cardRefundTotal.toFixed(2), " [Excel: 1449.00]");
console.log("Total Effective Spend:   ", julySummary.cardEffectiveSpend.toFixed(2), " [Excel: 7497.56]");
console.log("Kitkat Card Share:       ", julySummary.person1CardShare.toFixed(2), " [Excel: 3282.57]");
console.log("Rashu Card Share:        ", julySummary.person2CardShare.toFixed(2), " [Excel: 4214.99]");
console.log("Total Non-Card Spend:    ", julySummary.nonCardTotalSpend.toFixed(2), " [Excel: 1000.00]");
console.log("Kitkat Total Share (O17):", julySummary.person1TotalExpenseShare.toFixed(2), " [Excel: 3782.57]");
console.log("Kitkat Paid (O18):       ", julySummary.person1Paid.toFixed(2), " [Excel: 10000.00]");
console.log("Kitkat Balance (O19):    ", julySummary.person1Balance.toFixed(2), " [Excel: -6217.43]");
console.log("Rashu Total Share (O21): ", julySummary.person2TotalExpenseShare.toFixed(2), " [Excel: 4714.99]");
console.log("Rashu Paid (O22):        ", julySummary.person2Paid.toFixed(2), " [Excel: 4714.99]");
console.log("Rashu Balance (O23):     ", julySummary.person2Balance.toFixed(2), " [Excel: 0.00]");

console.log("\n=================== AUGUST 2026 VALIDATION ===================");
const augSummary = ExpenseCalculator.calculateMonthSummary(window.INITIAL_EXPENSES, window.INITIAL_PAYMENTS, "August 2026", window.DEFAULT_SETTINGS);
console.log("Card Statement Total:    ", augSummary.cardStatementTotal.toFixed(2), " [Excel: 33764.20]");
console.log("Fuel Waiver:             ", augSummary.cardFuelWaiverTotal.toFixed(2), " [Excel: 72.52]");
console.log("Refund:                  ", augSummary.cardRefundTotal.toFixed(2), " [Excel: 1000.00]");
console.log("Total Effective Spend:   ", augSummary.cardEffectiveSpend.toFixed(2), " [Excel: 32691.68]");
console.log("Kitkat Card Share:       ", augSummary.person1CardShare.toFixed(2), " [Excel: 16484.25]");
console.log("Rashu Card Share:        ", augSummary.person2CardShare.toFixed(2), " [Excel: 16207.43]");
console.log("Total Non-Card Spend:    ", augSummary.nonCardTotalSpend.toFixed(2), " [Excel: 1000.00]");
console.log("Kitkat Total Share (O17):", augSummary.person1TotalExpenseShare.toFixed(2), " [Excel: 16484.25]");
console.log("Kitkat Paid (O18):       ", augSummary.person1Paid.toFixed(2), " [Excel: 4567.42]");
console.log("Kitkat Balance (O19):    ", augSummary.person1Balance.toFixed(2), " [Excel: 11916.83]");
console.log("Rashu Total Share (O21): ", augSummary.person2TotalExpenseShare.toFixed(2), " [Excel: 17207.43]");
console.log("Rashu Paid (O22):        ", augSummary.person2Paid.toFixed(2), " [Excel: 0.00]");
console.log("Rashu Balance (O23):     ", augSummary.person2Balance.toFixed(2), " [Excel: 17207.43]");
