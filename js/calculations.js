/**
 * SpendWise Calculation Engine
 * Replicates Excel Formulas exactly:
 * - Effective Amount: =IF(D>0, D-F-E, IF(C>0, C-F-E, 0))
 * - Kitkat Share: =IF(G="Kitkat", I, IF(G="Both", I/2, 0))
 * - Rashu Share: =IF(G="Rashu", I, IF(G="Both", I/2, 0))
 * - Card Summary: SUMIFS with "<>Non-Card"
 * - Non-Card Summary: SUMIF with "Non-Card"
 * - Settlement: Share - Paid = Net Balance
 */

const ExpenseCalculator = {
  
  // Calculate Effective Amount for a single transaction (Col I)
  calculateEffectiveAmount(tx) {
    const slip = parseFloat(tx.slipAmount) || 0;
    const stmt = parseFloat(tx.statementAmount) || 0;
    const fuel = parseFloat(tx.fuelWaiver) || 0;
    const ref = parseFloat(tx.refundAmount) || 0;

    let base = 0;
    if (stmt > 0) {
      base = stmt;
    } else if (slip > 0) {
      base = slip;
    }

    const effective = base - ref - fuel;
    return Math.max(0, effective);
  },

  // Calculate person shares for a single transaction (Cols J & K)
  calculateItemShares(tx, person1 = "Kitkat", person2 = "Rashu") {
    const effective = this.calculateEffectiveAmount(tx);
    const usedBy = (tx.usedBy || "Both").trim();

    let person1Share = 0;
    let person2Share = 0;

    if (usedBy.toLowerCase() === person1.toLowerCase()) {
      person1Share = effective;
      person2Share = 0;
    } else if (usedBy.toLowerCase() === person2.toLowerCase()) {
      person1Share = 0;
      person2Share = effective;
    } else if (usedBy.toLowerCase() === "both") {
      person1Share = effective / 2;
      person2Share = effective / 2;
    }

    return {
      effectiveAmount: effective,
      person1Share: person1Share,
      person2Share: person2Share
    };
  },

  // Calculate full month summary matching Excel cells O4:O23
  calculateMonthSummary(allExpenses, allPayments, currentMonth, settings = {}) {
    const person1 = settings.person1 || "Kitkat";
    const person2 = settings.person2 || "Rashu";

    // Filter for the selected month
    const monthExpenses = allExpenses.filter(e => e.month === currentMonth);
    const monthPayments = allPayments.filter(p => p.month === currentMonth);

    // Differentiate Card vs Non-Card
    const cardExpenses = monthExpenses.filter(e => (e.paymentType || "Card").toLowerCase() !== "non-card");
    const nonCardExpenses = monthExpenses.filter(e => (e.paymentType || "Card").toLowerCase() === "non-card");

    // 1. 💳 Card Expenses
    let cardStatementTotal = 0;
    let cardFuelWaiverTotal = 0;
    let cardRefundTotal = 0;
    let cardEffectiveSpend = 0;
    let person1CardShare = 0;
    let person2CardShare = 0;

    cardExpenses.forEach(tx => {
      cardStatementTotal += parseFloat(tx.statementAmount) || 0;
      cardFuelWaiverTotal += parseFloat(tx.fuelWaiver) || 0;
      cardRefundTotal += parseFloat(tx.refundAmount) || 0;

      const shares = this.calculateItemShares(tx, person1, person2);
      cardEffectiveSpend += shares.effectiveAmount;
      person1CardShare += shares.person1Share;
      person2CardShare += shares.person2Share;
    });

    // 2. 💳 Non-Card Expenses
    let nonCardTotalSpend = 0;
    let person1NonCardShare = 0;
    let person2NonCardShare = 0;

    nonCardExpenses.forEach(tx => {
      const shares = this.calculateItemShares(tx, person1, person2);
      nonCardTotalSpend += shares.effectiveAmount;
      person1NonCardShare += shares.person1Share;
      person2NonCardShare += shares.person2Share;
    });

    // 3. 💳 Final Settlement & Payments
    const person1TotalExpenseShare = person1CardShare + person1NonCardShare;
    const person2TotalExpenseShare = person2CardShare + person2NonCardShare;
    const grandTotalEffective = cardEffectiveSpend + nonCardTotalSpend;

    // Payments contributed
    const person1Paid = monthPayments
      .filter(p => (p.person || "").toLowerCase() === person1.toLowerCase())
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const person2Paid = monthPayments
      .filter(p => (p.person || "").toLowerCase() === person2.toLowerCase())
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const totalPaid = person1Paid + person2Paid;

    // Next Month Balance (= Share - Payment)
    const person1Balance = person1TotalExpenseShare - person1Paid;
    const person2Balance = person2TotalExpenseShare - person2Paid;

    // Statement difference (Statement total vs recorded slip / effective total)
    const totalSlipRecorded = monthExpenses.reduce((sum, e) => sum + (parseFloat(e.slipAmount) || 0), 0);
    const statementDifference = cardStatementTotal - cardEffectiveSpend - cardFuelWaiverTotal - cardRefundTotal;

    return {
      month: currentMonth,
      person1Name: person1,
      person2Name: person2,

      // Card Metrics
      cardStatementTotal: cardStatementTotal,
      cardFuelWaiverTotal: cardFuelWaiverTotal,
      cardRefundTotal: cardRefundTotal,
      cardEffectiveSpend: cardEffectiveSpend,
      person1CardShare: person1CardShare,
      person2CardShare: person2CardShare,

      // Non-Card Metrics
      nonCardTotalSpend: nonCardTotalSpend,
      person1NonCardShare: person1NonCardShare,
      person2NonCardShare: person2NonCardShare,

      // Total Shares
      person1TotalExpenseShare: person1TotalExpenseShare,
      person2TotalExpenseShare: person2TotalExpenseShare,
      grandTotalEffective: grandTotalEffective,

      // Payments & Settlement
      person1Paid: person1Paid,
      person2Paid: person2Paid,
      totalPaid: totalPaid,
      person1Balance: person1Balance,
      person2Balance: person2Balance,

      // Tally & Counts
      totalSlipRecorded: totalSlipRecorded,
      cardExpenseCount: cardExpenses.length,
      nonCardExpenseCount: nonCardExpenses.length,
      totalTransactionCount: monthExpenses.length
    };
  },

  // Category-wise summary calculation
  calculateCategoryBreakdown(allExpenses, currentMonth) {
    const monthExpenses = currentMonth === "ALL" 
      ? allExpenses 
      : allExpenses.filter(e => e.month === currentMonth);

    const categories = {};
    let total = 0;

    monthExpenses.forEach(tx => {
      const cat = tx.category || "General";
      const eff = this.calculateEffectiveAmount(tx);
      categories[cat] = (categories[cat] || 0) + eff;
      total += eff;
    });

    const breakdown = Object.keys(categories).map(cat => ({
      category: cat,
      amount: categories[cat],
      percentage: total > 0 ? ((categories[cat] / total) * 100).toFixed(1) : 0
    }));

    return { total, breakdown };
  }
};

// Export to window
window.ExpenseCalculator = ExpenseCalculator;
