/**
 * SpendWise Reconciliation Engine
 * Compares Recorded Expenses (Slip Amount) vs Credit Card Statement (Statement Amount),
 * accounting for Fuel Surcharge Waivers and Merchant Refunds.
 */

const ReconciliationEngine = {

  reconcileExpenses(expenses, month = "ALL") {
    const monthExpenses = month === "ALL" 
      ? expenses 
      : expenses.filter(e => e.month === month);

    const cardExpenses = monthExpenses.filter(e => (e.paymentType || "Card").toLowerCase() !== "non-card");

    const matched = [];
    const amountDifference = [];
    const statementOnly = [];
    const slipOnly = [];

    cardExpenses.forEach(item => {
      const slip = parseFloat(item.slipAmount) || 0;
      const stmt = parseFloat(item.statementAmount) || 0;
      const fuel = parseFloat(item.fuelWaiver) || 0;
      const ref = parseFloat(item.refundAmount) || 0;

      // Effective comparison
      if (stmt > 0 && slip > 0) {
        const diff = Math.abs(stmt - slip - fuel);
        if (stmt === slip || diff < 0.05) {
          matched.push({
            ...item,
            status: "Matched",
            statusClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            difference: 0
          });
        } else {
          amountDifference.push({
            ...item,
            status: "Amount Difference",
            statusClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
            difference: stmt - slip,
            netVariance: (stmt - fuel - ref) - slip
          });
        }
      } else if (stmt > 0 && slip === 0) {
        statementOnly.push({
          ...item,
          status: "Statement Only",
          statusClass: "text-sky-400 bg-sky-500/10 border-sky-500/20",
          difference: stmt
        });
      } else if (slip > 0 && stmt === 0) {
        slipOnly.push({
          ...item,
          status: "Slip Only (Pending in Statement)",
          statusClass: "text-purple-400 bg-purple-500/10 border-purple-500/20",
          difference: slip
        });
      } else {
        matched.push({
          ...item,
          status: "Verified",
          statusClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          difference: 0
        });
      }
    });

    const totalSlip = cardExpenses.reduce((sum, e) => sum + (parseFloat(e.slipAmount) || 0), 0);
    const totalStatement = cardExpenses.reduce((sum, e) => sum + (parseFloat(e.statementAmount) || 0), 0);
    const totalFuelWaiver = cardExpenses.reduce((sum, e) => sum + (parseFloat(e.fuelWaiver) || 0), 0);
    const totalRefund = cardExpenses.reduce((sum, e) => sum + (parseFloat(e.refundAmount) || 0), 0);
    const totalEffective = cardExpenses.reduce((sum, e) => sum + ExpenseCalculator.calculateEffectiveAmount(e), 0);

    return {
      allCardExpenses: cardExpenses,
      matched,
      amountDifference,
      statementOnly,
      slipOnly,
      totalSlip,
      totalStatement,
      totalFuelWaiver,
      totalRefund,
      totalEffective,
      variance: (totalStatement - totalFuelWaiver - totalRefund) - totalEffective
    };
  }
};

window.ReconciliationEngine = ReconciliationEngine;
