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
    let fuel = parseFloat(tx.fuelWaiver) || 0;
    const ref = parseFloat(tx.refundAmount) || 0;

    // For fuel/petrol transactions: if fuel waiver is missing/0 but statement exceeds slip amount,
    // the excess is the bank fuel surcharge. Auto-deduct so effective spend matches actual fuel price.
    const isFuel = (tx.category === 'Fuel') || /petrol|fuel|filling|fuels|sharma|misrod|kanta/i.test(tx.description || '');
    if (isFuel && fuel === 0 && slip > 0 && stmt > slip) {
      fuel = stmt - slip;
    }

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

    const cardStatementGross = cardStatementTotal;
    const cardStatementNet = Math.max(0, cardStatementGross - cardFuelWaiverTotal - cardRefundTotal);

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
    const statementDifference = cardStatementGross - cardEffectiveSpend - cardFuelWaiverTotal - cardRefundTotal;

    return {
      month: currentMonth,
      person1Name: person1,
      person2Name: person2,

      // Card Metrics
      cardStatementGross: cardStatementGross,
      cardStatementNet: cardStatementNet,
      cardStatementTotal: cardStatementNet,
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

  // Sort months in chronological sequence (descending: newest first, e.g. Sep 2026 -> Aug 2026 -> Jul 2026)
  sortMonthsChronologically(monthsArray, descending = true) {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const uniqueMonths = Array.from(new Set((monthsArray || []).filter(Boolean)));

    return uniqueMonths.sort((a, b) => {
      const parse = (mStr) => {
        const parts = String(mStr).trim().split(/\s+/);
        const name = parts[0] || '';
        const year = parseInt(parts[1], 10) || 2026;
        const idx = monthNames.findIndex(m => m.toLowerCase().startsWith(name.toLowerCase().slice(0, 3)));
        return year * 100 + (idx !== -1 ? idx : 0);
      };

      const valA = parse(a);
      const valB = parse(b);

      return descending ? (valB - valA) : (valA - valB);
    });
  },

  // Parse month string e.g. "August 2026"
  parseMonthName(monthStr) {
    if (!monthStr || monthStr === "ALL") return null;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const parts = monthStr.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const mName = parts[0];
    const year = parseInt(parts[1], 10);
    const mIdx = months.findIndex(m => m.toLowerCase().startsWith(mName.toLowerCase().slice(0, 3)));
    if (mIdx === -1 || isNaN(year)) return null;

    const nextDate = new Date(year, mIdx + 1, 1);
    const prevDate = new Date(year, mIdx - 1, 1);
    const nextMonthName = `${months[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
    const prevMonthName = `${months[prevDate.getMonth()]} ${prevDate.getFullYear()}`;

    return {
      monthIndex: mIdx,
      monthName: months[mIdx],
      year: year,
      formatted: `${months[mIdx]} ${year}`,
      nextMonthName,
      prevMonthName
    };
  },

  // Get exact Card Statement Date & Card Payment Due Date for a cycle
  getCycleDates(monthStr, settings = {}) {
    const info = this.parseMonthName(monthStr);
    if (!info) return null;

    const stmtDay = parseInt(settings.statementDay, 10) || 24;
    const dueDay = parseInt(settings.paymentDueDay, 10) || 13;

    // Statement Date is stmtDay of the cycle month
    const stmtDateObj = new Date(info.year, info.monthIndex, stmtDay);
    const stmtDateISO = `${stmtDateObj.getFullYear()}-${String(stmtDateObj.getMonth() + 1).padStart(2, '0')}-${String(stmtDateObj.getDate()).padStart(2, '0')}`;

    // Payment Due Date is dueDay of the FOLLOWING month
    const dueDateObj = new Date(info.year, info.monthIndex + 1, dueDay);
    const dueDateISO = `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, '0')}-${String(dueDateObj.getDate()).padStart(2, '0')}`;

    return {
      month: info.formatted,
      statementDay: stmtDay,
      paymentDueDay: dueDay,
      statementDateISO: stmtDateISO,
      dueDateISO: dueDateISO,
      formattedDueDate: this.formatDisplayDate(dueDateISO),
      formattedStmtDate: this.formatDisplayDate(stmtDateISO),
      nextMonthName: info.nextMonthName,
      prevMonthName: info.prevMonthName
    };
  },

  // Determine settlement month for a UPI expense based on its date & entered month
  getUpiSettlementInfo(item, settings = {}) {
    const enteredMonth = item.month || "August 2026";
    const cycleDates = this.getCycleDates(enteredMonth, settings);
    const itemDateISO = this.parseToISODate(item.date);

    if (!cycleDates || !itemDateISO) {
      return {
        settlementMonth: enteredMonth,
        isRolledOver: false,
        isBeforeDueDate: true,
        dueDateISO: cycleDates ? cycleDates.dueDateISO : '',
        formattedDueDate: cycleDates ? cycleDates.formattedDueDate : '',
        reason: 'Default'
      };
    }

    // Rule: if itemDateISO <= cycleDates.dueDateISO => Settles in enteredMonth
    // Else (itemDateISO > cycleDates.dueDateISO) => Rolls over to next month
    if (itemDateISO <= cycleDates.dueDateISO) {
      return {
        settlementMonth: enteredMonth,
        isRolledOver: false,
        isBeforeDueDate: true,
        dueDateISO: cycleDates.dueDateISO,
        formattedDueDate: cycleDates.formattedDueDate,
        reason: `Paid on ${this.formatDisplayDate(itemDateISO)} (<= Card Due Date ${cycleDates.formattedDueDate})`
      };
    } else {
      return {
        settlementMonth: cycleDates.nextMonthName,
        isRolledOver: true,
        isBeforeDueDate: false,
        dueDateISO: cycleDates.dueDateISO,
        formattedDueDate: cycleDates.formattedDueDate,
        reason: `Paid on ${this.formatDisplayDate(itemDateISO)} (> Card Due Date ${cycleDates.formattedDueDate}) -> Rolls over to ${cycleDates.nextMonthName}`
      };
    }
  },

  // Calculate shares for a single UPI item (matching UPI Excel sheet)
  calculateUpiItemShares(item, person1 = "Kitkat", person2 = "Rashu") {
    const amount = parseFloat(item.amount) || 0;
    const usedBy = (item.usedBy || "Both").trim();

    let person1Share = 0;
    let person2Share = 0;

    if (usedBy.toLowerCase() === person1.toLowerCase()) {
      person1Share = amount;
      person2Share = 0;
    } else if (usedBy.toLowerCase() === person2.toLowerCase()) {
      person1Share = 0;
      person2Share = amount;
    } else if (usedBy.toLowerCase() === "both") {
      person1Share = amount / 2;
      person2Share = amount / 2;
    }

    return {
      amount,
      person1Share,
      person2Share
    };
  },

  // Calculate full month summary for UPI expenses based on Card Payment Due Date
  calculateUpiMonthSummary(allUpiExpenses, currentMonth, settings = {}) {
    const person1 = settings.person1 || "Kitkat";
    const person2 = settings.person2 || "Rashu";
    const cycleDates = currentMonth !== "ALL" ? this.getCycleDates(currentMonth, settings) : null;

    let totalUpiSpend = 0;
    let person1UpiShare = 0;
    let person2UpiShare = 0;
    let settledItems = [];
    let rolledOverToNextCount = 0;
    let rolledOverToNextTotal = 0;

    (allUpiExpenses || []).forEach(item => {
      const settlementInfo = this.getUpiSettlementInfo(item, settings);
      
      // If filtering for a specific month, include items whose settlementMonth is currentMonth
      const isSettlingInThisMonth = currentMonth === "ALL" || settlementInfo.settlementMonth === currentMonth;

      if (isSettlingInThisMonth) {
        const shares = this.calculateUpiItemShares(item, person1, person2);
        totalUpiSpend += shares.amount;
        person1UpiShare += shares.person1Share;
        person2UpiShare += shares.person2Share;
        settledItems.push({ ...item, settlementInfo, shares });
      }

      // If item was originally logged for currentMonth but rolled over to next
      if (currentMonth !== "ALL" && item.month === currentMonth && settlementInfo.isRolledOver) {
        rolledOverToNextCount++;
        rolledOverToNextTotal += (parseFloat(item.amount) || 0);
      }
    });

    return {
      month: currentMonth,
      totalUpiSpend,
      person1UpiShare,
      person2UpiShare,
      count: settledItems.length,
      settledItems,
      rolledOverToNextCount,
      rolledOverToNextTotal,
      cycleDates
    };
  },

  // Calculate combined master settlement: Card Share + UPI Share - Advance/Payments
  calculateCombinedSettlement(allCardExpenses, allUpiExpenses, allPayments, currentMonth, settings = {}) {
    const cardSummary = this.calculateMonthSummary(allCardExpenses, allPayments, currentMonth, settings);
    const upiSummary = this.calculateUpiMonthSummary(allUpiExpenses, currentMonth, settings);

    const person1 = settings.person1 || "Kitkat";
    const person2 = settings.person2 || "Rashu";

    const person1CombinedShare = cardSummary.person1TotalExpenseShare + upiSummary.person1UpiShare;
    const person2CombinedShare = cardSummary.person2TotalExpenseShare + upiSummary.person2UpiShare;
    const grandCombinedSpend = cardSummary.grandTotalEffective + upiSummary.totalUpiSpend;

    const person1FinalDue = person1CombinedShare - cardSummary.person1Paid;
    const person2FinalDue = person2CombinedShare - cardSummary.person2Paid;

    return {
      month: currentMonth,
      person1Name: person1,
      person2Name: person2,

      // Card Breakdown
      card: cardSummary,

      // UPI Breakdown
      upi: upiSummary,

      // Combined Totals
      grandCombinedSpend,
      person1CombinedShare,
      person2CombinedShare,

      // Paid / Advance
      person1Paid: cardSummary.person1Paid,
      person2Paid: cardSummary.person2Paid,
      totalPaid: cardSummary.totalPaid,

      // Final Net Balances
      person1FinalDue,
      person2FinalDue
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
  },

  // Parse any date string / serial to YYYY-MM-DD
  parseToISODate(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    dateStr = String(dateStr).trim();
    
    // Excel serial number (e.g. 46227)
    if (/^\d{5}$/.test(dateStr)) {
      const serial = parseInt(dateStr, 10);
      const date = new Date((serial - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    
    // Try DD-MM-YYYY or D-M-YYYY or DD/MM/YYYY
    const dmyMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const d = dmyMatch[1].padStart(2, '0');
      const m = dmyMatch[2].padStart(2, '0');
      const y = dmyMatch[3];
      return `${y}-${m}-${d}`;
    }

    // Try DD-MM-YY or D-M-YY or DD/MM/YY
    const dmyShortMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
    if (dmyShortMatch) {
      const d = dmyShortMatch[1].padStart(2, '0');
      const m = dmyShortMatch[2].padStart(2, '0');
      const y = "20" + dmyShortMatch[3];
      return `${y}-${m}-${d}`;
    }

    // Try "07 Jul 26" or "24-Jul-26" or "07 Jul 2026" or "26 Aug 26"
    const monthMap = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
    const textMatch = dateStr.match(/^(\d{1,2})[- ]([a-zA-Z]{3})[- ](\d{2,4})$/);
    if (textMatch) {
      const d = textMatch[1].padStart(2, '0');
      const m = monthMap[textMatch[2].toLowerCase()] || "01";
      let y = textMatch[3];
      if (y.length === 2) y = "20" + y;
      return `${y}-${m}-${d}`;
    }

    return new Date().toISOString().split('T')[0];
  },

  // Format any date to DD Mon YY (e.g. 26 Aug 26, 02 Sep 26)
  formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    dateStr = String(dateStr).trim();
    
    // If Month + Year header e.g. "Aug 2026"
    if (/^[A-Za-z]{3,9}\s+\d{4}$/.test(dateStr)) return dateStr;

    const iso = this.parseToISODate(dateStr);
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mName = months[parseInt(m, 10) - 1] || m;
      return `${d} ${mName} ${y.slice(2)}`;
    }
    return dateStr;
  }
};

// Export to window
window.ExpenseCalculator = ExpenseCalculator;
window.formatDisplayDate = (d) => ExpenseCalculator.formatDisplayDate(d);
window.parseToISODate = (d) => ExpenseCalculator.parseToISODate(d);
