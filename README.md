# SpendWise — Card Expense Management & Statement Reconciliation

SpendWise is a client-side finance and shared credit card expense management web application built with **HTML5, CSS3, and Vanilla JavaScript**.

The core calculations, data structures, and settlement logic are based on the **`Professional_Card_Expense_Tracker_Kitkat_Rashu_v2.xlsx`** workbook.

---

## 📊 Excel to JavaScript Formula Mapping

| Metric / Calculation | Excel Formula | JavaScript Implementation | Purpose |
| :--- | :--- | :--- | :--- |
| **Effective Amount** | `=IF(D3>0, D3-F3-E3, IF(C3>0, C3-F3-E3, 0))` | `ExpenseCalculator.calculateEffectiveAmount(tx)` | Priority to Statement Amount ($D$), otherwise Slip ($C$), minus Refunds ($F$) and Fuel Waivers ($E$). |
| **Kitkat Share** | `=IF(G3="Kitkat", I3, IF(G3="Both", I3/2, 0))` | `ExpenseCalculator.calculateItemShares(tx).person1Share` | Assigns 100% if "Kitkat", 50% if "Both", 0 if "Rashu". |
| **Rashu Share** | `=IF(G3="Rashu", I3, IF(G3="Both", I3/2, 0))` | `ExpenseCalculator.calculateItemShares(tx).person2Share` | Assigns 100% if "Rashu", 50% if "Both", 0 if "Kitkat". |
| **Card Effective Spend** | `=SUMIFS(I3:I37, H3:H37, "<>Non-Card")` | `summary.cardEffectiveSpend` | Sum of Effective Amounts for all Card transactions. |
| **Card Statement Total** | `=SUMIFS(D3:D38, H3:H38, "<>Non-Card")` | `summary.cardStatementTotal` | Total raw Statement Amount billed on card. |
| **Fuel Waiver Total** | `=SUMIFS(E3:E38, H3:H38, "<>Non-Card")` | `summary.cardFuelWaiverTotal` | Total fuel surcharge waivers credited on card. |
| **Refunds Total** | `=SUMIFS(F3:F38, H3:H38, "<>Non-Card")` | `summary.cardRefundTotal` | Total order refunds and reversals credited on card. |
| **Total Non-Card Spend**| `=SUMIF(H3:H38, "Non-Card", I3:I38)` | `summary.nonCardTotalSpend` | Total offline / cash / UPI non-card expenses. |
| **Person 1 Total Share**| `=O8 + O13` | `summary.person1TotalExpenseShare` | Kitkat Card Share + Kitkat Non-Card Share. |
| **Person 2 Total Share**| `=O9 + O14` | `summary.person2TotalExpenseShare` | Rashu Card Share + Rashu Non-Card Share. |
| **Person 1 Balance** | `=O17 - O18` | `summary.person1Balance` | Person 1 Total Expense Share minus Payments Contributed. |
| **Person 2 Balance** | `=O21 - O22` | `summary.person2Balance` | Person 2 Total Expense Share minus Payments Contributed. |

---

## 🧪 Exact Excel Validation Results

### July 2026 Cycle
| Metric | Excel Value | Web App Value | Result |
| :--- | :--- | :--- | :---: |
| **Card Statement Total** | ₹8,992.35 | ₹8,992.35 | ✅ Exact Match |
| **Fuel Waiver** | ₹45.79 | ₹45.79 | ✅ Exact Match |
| **Refund** | ₹1,449.00 | ₹1,449.00 | ✅ Exact Match |
| **Total Effective Spend** | ₹7,497.56 | ₹7,497.56 | ✅ Exact Match |
| **Kitkat Card Share** | ₹3,282.57 | ₹3,282.57 | ✅ Exact Match |
| **Rashu Card Share** | ₹4,214.99 | ₹4,214.99 | ✅ Exact Match |
| **Total Non-Card Spend** | ₹1,000.00 | ₹1,000.00 | ✅ Exact Match |
| **Kitkat Total Share** | ₹3,782.57 | ₹3,782.57 | ✅ Exact Match |
| **Kitkat Paid** | ₹10,000.00 | ₹10,000.00 | ✅ Exact Match |
| **Kitkat Balance** | -₹6,217.43 | -₹6,217.43 | ✅ Exact Match (Credit Advance) |
| **Rashu Total Share** | ₹4,714.99 | ₹4,714.99 | ✅ Exact Match |
| **Rashu Paid** | ₹4,714.99 | ₹4,714.99 | ✅ Exact Match |
| **Rashu Balance** | ₹0.00 | ₹0.00 | ✅ Exact Match (Settled) |

### August 2026 Cycle
| Metric | Excel Value | Web App Value | Result |
| :--- | :--- | :--- | :---: |
| **Card Statement Total** | ₹33,764.20 | ₹33,764.20 | ✅ Exact Match |
| **Fuel Waiver** | ₹72.52 | ₹72.52 | ✅ Exact Match |
| **Refund** | ₹1,000.00 | ₹1,000.00 | ✅ Exact Match |
| **Total Effective Spend** | ₹32,691.68 | ₹32,691.68 | ✅ Exact Match |
| **Kitkat Card Share** | ₹16,484.25 | ₹16,484.25 | ✅ Exact Match |
| **Rashu Card Share** | ₹16,207.43 | ₹16,207.43 | ✅ Exact Match |
| **Total Non-Card Spend** | ₹1,000.00 | ₹1,000.00 | ✅ Exact Match |
| **Kitkat Total Share** | ₹16,484.25 | ₹16,484.25 | ✅ Exact Match |
| **Kitkat Paid** | ₹4,567.42 | ₹4,567.42 | ✅ Exact Match |
| **Kitkat Balance** | ₹11,916.83 | ₹11,916.83 | ✅ Exact Match (Payable) |
| **Rashu Total Share** | ₹17,207.43 | ₹17,207.43 | ✅ Exact Match |
| **Rashu Paid** | ₹0.00 | ₹0.00 | ✅ Exact Match |
| **Rashu Balance** | ₹17,207.43 | ₹17,207.43 | ✅ Exact Match (Payable) |

---

## 📁 Project Structure

```text
card-expense-management/
│
├── index.html            # Main Single-Page Responsive Dashboard & Views
│
├── css/
│   └── style.css         # Modern Dark Finance Theme & Micro-Interactions
│
├── js/
│   ├── data.js           # Initial Data preloaded from Excel (July & August)
│   ├── calculations.js   # Calculation Engine replicating Excel formulas
│   ├── reconciliation.js # Statement Tally & Reconciliation Engine
│   ├── storage.js        # LocalStorage persistence, JSON Backup & CSV Export
│   └── app.js            # Main Controller & Interactive Event Logic
│
├── server.js             # Built-in lightweight Node HTTP Server
└── README.md             # Documentation & Formula Mapping
```

---

## 🚀 Running Locally

Start the local server:

```bash
node server.js
```

Open **`http://localhost:3000`** in your browser.
