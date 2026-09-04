/**
 * SpendWise Main Application Controller
 * Handles UI interactions, View routing, State updates, Charts, 24th Statement Reconciliation Flow,
 * and Advance / Received Funds Management in Final Billing.
 */

// Application State
let appState = {
  currentMonth: "August 2026",
  currentTab: "dashboard",
  settings: {},
  expenses: [],
  payments: [],
  months: [],
  dashboardChart: null,
  personReportChart: null,
  monthlyTrendChart: null
};

// Initialization on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  StorageManager.init();
  loadStateFromStorage();
  initLucide();
  initEventListeners();
  populateCategoryDropdowns();
  populateMonthDropdown();
  renderApp();
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function loadStateFromStorage() {
  appState.settings = StorageManager.getSettings();
  appState.expenses = StorageManager.getExpenses();
  appState.payments = StorageManager.getPayments();
  appState.months = StorageManager.getMonths();
  appState.currentMonth = appState.settings.defaultMonth || "August 2026";
}

function saveStateToStorage() {
  StorageManager.saveExpenses(appState.expenses);
  StorageManager.savePayments(appState.payments);
  StorageManager.saveSettings(appState.settings);
  StorageManager.saveMonths(appState.months);
}

// Event Listeners Setup
function initEventListeners() {
  // Navigation Tabs
  document.querySelectorAll("[data-tab]").forEach(tabBtn => {
    tabBtn.addEventListener("click", () => {
      const tabName = tabBtn.getAttribute("data-tab");
      switchTab(tabName);
    });
  });

  // Global Month Selector
  const globalMonthSelect = document.getElementById("globalMonthSelect");
  if (globalMonthSelect) {
    globalMonthSelect.addEventListener("change", (e) => {
      appState.currentMonth = e.target.value;
      renderApp();
    });
  }

  // Expense Search & Filters
  const searchInput = document.getElementById("expenseSearchInput");
  const personFilter = document.getElementById("expensePersonFilter");
  const catFilter = document.getElementById("expenseCategoryFilter");
  const typeFilter = document.getElementById("expenseTypeFilter");

  [searchInput, personFilter, catFilter, typeFilter].forEach(el => {
    if (el) {
      el.addEventListener("input", renderExpensesView);
      el.addEventListener("change", renderExpensesView);
    }
  });

  // Export CSV
  const exportCsvBtn = document.getElementById("exportExpensesCSVBtn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      StorageManager.exportExpensesCSV(appState.currentMonth);
    });
  }

  // Modals Open/Close Setup
  setupExpenseModal();
  setupPaymentModal();
  setupImportModal();
  setupQuickStatementModal();
  setupSettingsForm();
}

function switchTab(tabName) {
  appState.currentTab = tabName;

  // Update Nav Tab button styles
  document.querySelectorAll("[data-tab]").forEach(btn => {
    if (btn.getAttribute("data-tab") === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Switch visible sections
  const views = ["dashboard", "expenses", "tally", "payments", "reports", "settings"];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === tabName) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    }
  });

  // Re-render specific views if needed
  if (tabName === "reports") {
    renderReportsView();
  } else if (tabName === "tally") {
    renderTallyView();
  } else if (tabName === "expenses") {
    renderExpensesView();
  } else if (tabName === "payments") {
    renderPaymentsView();
  } else if (tabName === "dashboard") {
    renderDashboardView();
  }

  initLucide();
}

function populateMonthDropdown() {
  const globalMonthSelect = document.getElementById("globalMonthSelect");
  const expenseMonthInput = document.getElementById("expenseMonthInput");
  const payMonthInput = document.getElementById("payMonthInput");

  if (!globalMonthSelect) return;

  const months = appState.months.length > 0 ? appState.months : ["August 2026", "July 2026"];

  const optionsHTML = months.map(m => `<option value="${m}" ${m === appState.currentMonth ? "selected" : ""}>${m}</option>`).join("");
  globalMonthSelect.innerHTML = optionsHTML;
  
  if (expenseMonthInput) expenseMonthInput.innerHTML = optionsHTML;
  if (payMonthInput) payMonthInput.innerHTML = optionsHTML;
}

function populateCategoryDropdowns() {
  const catFilter = document.getElementById("expenseCategoryFilter");
  const catInput = document.getElementById("expenseCategoryInput");

  const categories = window.CATEGORIES || ["Fuel", "Food & Dining", "Travel", "Shopping", "Telecom & Utilities", "Fees & Charges", "General"];

  if (catFilter) {
    catFilter.innerHTML = `<option value="ALL">All Categories</option>` + categories.map(c => `<option value="${c}">${c}</option>`).join("");
  }
  if (catInput) {
    catInput.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join("");
  }
}

// Master Render
function renderApp() {
  updateHeaderLabels();
  renderDashboardView();
  renderExpensesView();
  renderTallyView();
  renderPaymentsView();
  if (appState.currentTab === "reports") {
    renderReportsView();
  }
  initLucide();
}

function updateHeaderLabels() {
  const p1 = appState.settings.person1 || "Kitkat";
  const p2 = appState.settings.person2 || "Rashu";

  const thP1 = document.getElementById("thPerson1Share");
  const thP2 = document.getElementById("thPerson2Share");
  if (thP1) thP1.innerText = `${p1} Share`;
  if (thP2) thP2.innerText = `${p2} Share`;

  const payP1Label = document.getElementById("payPerson1Label");
  const payP2Label = document.getElementById("payPerson2Label");
  if (payP1Label) payP1Label.innerText = `${p1} Contributions`;
  if (payP2Label) payP2Label.innerText = `${p2} Contributions`;

  const dashP1Label = document.getElementById("dashPerson1Label");
  const dashP2Label = document.getElementById("dashPerson2Label");
  if (dashP1Label) dashP1Label.innerText = `${p1} Share`;
  if (dashP2Label) dashP2Label.innerText = `${p2} Share`;
}

// =============================================================================
// DASHBOARD VIEW
// =============================================================================
function renderDashboardView() {
  const summary = ExpenseCalculator.calculateMonthSummary(appState.expenses, appState.payments, appState.currentMonth, appState.settings);
  const cur = appState.settings.currencySymbol || "₹";

  document.getElementById("dashStatementTotal").innerText = `${cur}${summary.cardStatementTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("dashEffectiveSpend").innerText = `${cur}${summary.cardEffectiveSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("dashFuelWaiverBadge").innerText = `-${cur}${summary.cardFuelWaiverTotal.toFixed(2)} Fuel Waiver`;
  document.getElementById("dashRefundBadge").innerText = `-${cur}${summary.cardRefundTotal.toFixed(2)} Refund`;

  document.getElementById("dashPerson1Share").innerText = `${cur}${summary.person1TotalExpenseShare.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("dashPerson1Paid").innerText = `${cur}${summary.person1Paid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("dashPerson1Balance").innerText = `${cur}${summary.person1Balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  document.getElementById("dashPerson2Share").innerText = `${cur}${summary.person2TotalExpenseShare.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("dashPerson2Paid").innerText = `${cur}${summary.person2Paid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("dashPerson2Balance").innerText = `${cur}${summary.person2Balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  document.getElementById("dashSelectedMonthBadge").innerText = appState.currentMonth;

  // Cycle Reconciled Counter Progress
  const monthTxs = appState.expenses.filter(e => e.month === appState.currentMonth);
  const cardTxs = monthTxs.filter(e => (e.paymentType || "Card").toLowerCase() !== "non-card");
  const reconciledCardTxs = cardTxs.filter(e => (parseFloat(e.statementAmount) || 0) > 0);

  const countEl = document.getElementById("dashCycleReconciledCount");
  const barEl = document.getElementById("dashCycleProgressBar");
  if (countEl && barEl) {
    const total = cardTxs.length;
    const reconciled = reconciledCardTxs.length;
    countEl.innerText = `${reconciled} of ${total} updated on 24th`;
    const pct = total > 0 ? (reconciled / total) * 100 : 100;
    barEl.style.width = `${pct}%`;
  }

  // Settlement Banner Text (Managing Advance / Received amounts clearly)
  const p1 = summary.person1Name;
  const p2 = summary.person2Name;
  let bannerMain = "";
  let bannerSub = "";

  if (summary.person1Paid > 0 || summary.person2Paid > 0) {
    // Show exact formula math: Share - Received = Net Due
    const p1Part = summary.person1Paid > 0 
      ? `${p1} Share: ${cur}${summary.person1TotalExpenseShare.toFixed(2)} - Received: ${cur}${summary.person1Paid.toFixed(2)} = ${summary.person1Balance >= 0 ? `Net Due ${cur}${summary.person1Balance.toFixed(2)}` : `Surplus Advance ${cur}${Math.abs(summary.person1Balance).toFixed(2)}`}`
      : `${p1} Net Due: ${cur}${summary.person1Balance.toFixed(2)}`;

    const p2Part = summary.person2Paid > 0
      ? `${p2} Share: ${cur}${summary.person2TotalExpenseShare.toFixed(2)} - Received: ${cur}${summary.person2Paid.toFixed(2)} = ${summary.person2Balance >= 0 ? `Net Due ${cur}${summary.person2Balance.toFixed(2)}` : `Surplus Advance ${cur}${Math.abs(summary.person2Balance).toFixed(2)}`}`
      : `${p2} Net Due: ${cur}${summary.person2Balance.toFixed(2)}`;

    bannerMain = `${p1Part} | ${p2Part}`;
    bannerSub = `Advance funds & payments are automatically subtracted from gross shares to compute the final net settlement balance.`;
  } else {
    bannerMain = `${p1} owes ${cur}${summary.person1Balance.toFixed(2)} | ${p2} owes ${cur}${summary.person2Balance.toFixed(2)}`;
    bannerSub = `No advance/payments recorded yet for this cycle. Click "Record Received / Advance" to factor in pre-payments.`;
  }

  document.getElementById("settlementMainText").innerText = bannerMain;
  document.getElementById("settlementSubText").innerText = bannerSub;

  // Recent Transactions Table in Dashboard
  const recentSlice = monthTxs.slice(-5).reverse();
  const recentTbody = document.getElementById("dashRecentTableBody");

  if (recentTbody) {
    recentTbody.innerHTML = recentSlice.map(tx => {
      const eff = ExpenseCalculator.calculateEffectiveAmount(tx);
      const isReconciled = (parseFloat(tx.statementAmount) || 0) > 0;
      return `
        <tr class="table-row-hover transition">
          <td class="px-5 py-3 text-slate-400 whitespace-nowrap">${formatDisplayDate(tx.date)}</td>
          <td class="px-5 py-3 font-medium text-white">${tx.description}</td>
          <td class="px-5 py-3">
            <span class="badge ${getPersonBadgeClass(tx.usedBy)}">${tx.usedBy}</span>
          </td>
          <td class="px-5 py-3">
            <span class="badge ${tx.paymentType === 'Non-Card' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-slate-800 text-slate-300 border-slate-700'}">${tx.paymentType}</span>
          </td>
          <td class="px-5 py-3 text-right font-mono text-slate-400">${cur}${(tx.slipAmount || 0).toFixed(2)}</td>
          <td class="px-5 py-3 text-right font-mono text-slate-200">${tx.statementAmount ? `${cur}${tx.statementAmount.toFixed(2)}` : '-'}</td>
          <td class="px-5 py-3 text-right font-mono font-bold text-indigo-400">${cur}${eff.toFixed(2)}</td>
          <td class="px-5 py-3 text-center">
            <span class="badge ${isReconciled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}">
              ${isReconciled ? '✓ Statement Reconciled' : '⏳ Awaiting 24th'}
            </span>
          </td>
        </tr>
      `;
    }).join("");
  }

  renderDashboardChart();
}

function renderDashboardChart() {
  const ctx = document.getElementById("dashboardChart");
  if (!ctx) return;

  const breakdown = ExpenseCalculator.calculateCategoryBreakdown(appState.expenses, appState.currentMonth);

  if (appState.dashboardChart) {
    appState.dashboardChart.destroy();
  }

  const labels = breakdown.breakdown.map(b => b.category);
  const data = breakdown.breakdown.map(b => b.amount);
  const colors = ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#94a3b8'];

  appState.dashboardChart = new Chart(ctx.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#111827',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#cbd5e1',
            font: { size: 11, family: 'Plus Jakarta Sans' },
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          padding: 10,
          borderColor: '#334155',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` ₹${ctx.parsed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          }
        }
      }
    }
  });
}

// =============================================================================
// EXPENSES VIEW
// =============================================================================
function renderExpensesView() {
  const tbody = document.getElementById("expensesTableBody");
  const tfoot = document.getElementById("expensesTableFooter");
  if (!tbody) return;

  const searchQuery = (document.getElementById("expenseSearchInput")?.value || "").toLowerCase();
  const personFilter = document.getElementById("expensePersonFilter")?.value || "ALL";
  const catFilter = document.getElementById("expenseCategoryFilter")?.value || "ALL";
  const typeFilter = document.getElementById("expenseTypeFilter")?.value || "ALL";
  const cur = appState.settings.currencySymbol || "₹";

  const monthExpenses = appState.expenses.filter(e => e.month === appState.currentMonth);

  const filtered = monthExpenses.filter(item => {
    const matchesSearch = (item.description || "").toLowerCase().includes(searchQuery) || (item.remarks || "").toLowerCase().includes(searchQuery);
    const matchesPerson = personFilter === "ALL" || (item.usedBy || "").toLowerCase() === personFilter.toLowerCase();
    const matchesCat = catFilter === "ALL" || (item.category || "").toLowerCase() === catFilter.toLowerCase();
    const matchesType = typeFilter === "ALL" || (item.paymentType || "").toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesPerson && matchesCat && matchesType;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="px-6 py-12 text-center text-slate-500 text-xs">
          No expense transactions found matching the selected filters.
        </td>
      </tr>
    `;
    if (tfoot) tfoot.innerHTML = "";
    return;
  }

  let totalSlip = 0;
  let totalStmt = 0;
  let totalFuel = 0;
  let totalRefund = 0;
  let totalEffective = 0;
  let totalP1 = 0;
  let totalP2 = 0;

  tbody.innerHTML = filtered.map(item => {
    const shares = ExpenseCalculator.calculateItemShares(item, appState.settings.person1, appState.settings.person2);
    
    totalSlip += parseFloat(item.slipAmount) || 0;
    totalStmt += parseFloat(item.statementAmount) || 0;
    totalFuel += parseFloat(item.fuelWaiver) || 0;
    totalRefund += parseFloat(item.refundAmount) || 0;
    totalEffective += shares.effectiveAmount;
    totalP1 += shares.person1Share;
    totalP2 += shares.person2Share;

    return `
      <tr class="table-row-hover transition">
        <td class="px-4 py-3 text-slate-400 whitespace-nowrap">${formatDisplayDate(item.date)}</td>
        <td class="px-4 py-3 font-semibold text-white">
          ${item.description}
          ${item.remarks ? `<div class="text-[10px] text-slate-400 font-normal mt-0.5">${item.remarks}</div>` : ''}
        </td>
        <td class="px-4 py-3 text-right font-mono text-slate-400">${item.slipAmount ? `${cur}${item.slipAmount.toFixed(2)}` : '-'}</td>
        <td class="px-4 py-3 text-right font-mono text-slate-200">${item.statementAmount ? `${cur}${item.statementAmount.toFixed(2)}` : `<span class="text-amber-400/80 text-[10px]">Pending 24th</span>`}</td>
        <td class="px-4 py-3 text-right font-mono text-amber-400">${item.fuelWaiver ? `${cur}${item.fuelWaiver.toFixed(2)}` : '-'}</td>
        <td class="px-4 py-3 text-right font-mono text-emerald-400">${item.refundAmount ? `${cur}${item.refundAmount.toFixed(2)}` : '-'}</td>
        <td class="px-4 py-3 text-center">
          <span class="badge ${getPersonBadgeClass(item.usedBy)}">${item.usedBy}</span>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="badge ${item.paymentType === 'Non-Card' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-slate-800 text-slate-300 border-slate-700'}">${item.paymentType}</span>
        </td>
        <td class="px-4 py-3 text-right font-mono font-bold text-indigo-400">${cur}${shares.effectiveAmount.toFixed(2)}</td>
        <td class="px-4 py-3 text-right font-mono text-indigo-300">${cur}${shares.person1Share.toFixed(2)}</td>
        <td class="px-4 py-3 text-right font-mono text-purple-300">${cur}${shares.person2Share.toFixed(2)}</td>
        <td class="px-4 py-3 text-center whitespace-nowrap">
          <button onclick="editExpense('${item.id}')" class="p-1 text-slate-400 hover:text-indigo-400 transition" title="Edit / Add 24th Statement Details">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="deleteExpense('${item.id}')" class="p-1 text-slate-400 hover:text-red-400 transition ml-1" title="Delete">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td colspan="2" class="px-4 py-3.5 text-left uppercase text-[11px] tracking-wider text-slate-300">Total (${filtered.length} items)</td>
        <td class="px-4 py-3.5 text-right font-mono">${cur}${totalSlip.toFixed(2)}</td>
        <td class="px-4 py-3.5 text-right font-mono">${cur}${totalStmt.toFixed(2)}</td>
        <td class="px-4 py-3.5 text-right font-mono text-amber-400">${cur}${totalFuel.toFixed(2)}</td>
        <td class="px-4 py-3.5 text-right font-mono text-emerald-400">${cur}${totalRefund.toFixed(2)}</td>
        <td colspan="2"></td>
        <td class="px-4 py-3.5 text-right font-mono font-bold text-indigo-400">${cur}${totalEffective.toFixed(2)}</td>
        <td class="px-4 py-3.5 text-right font-mono text-indigo-300">${cur}${totalP1.toFixed(2)}</td>
        <td class="px-4 py-3.5 text-right font-mono text-purple-300">${cur}${totalP2.toFixed(2)}</td>
        <td></td>
      </tr>
    `;
  }

  initLucide();
}

function getPersonBadgeClass(usedBy) {
  const p = (usedBy || "").toLowerCase();
  if (p === "kitkat") return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
  if (p === "rashu") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
  return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
}

// =============================================================================
// STATEMENT TALLY / RECONCILIATION VIEW
// =============================================================================
function renderTallyView() {
  const tbody = document.getElementById("tallyTableBody");
  if (!tbody) return;

  const result = ReconciliationEngine.reconcileExpenses(appState.expenses, appState.currentMonth);
  const cur = appState.settings.currencySymbol || "₹";

  document.getElementById("tallyStatementTotal").innerText = `${cur}${result.totalStatement.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("tallyFuelWaiver").innerText = `${cur}${result.totalFuelWaiver.toFixed(2)}`;
  document.getElementById("tallyRefund").innerText = `${cur}${result.totalRefund.toFixed(2)}`;
  document.getElementById("tallyEffectiveSpend").innerText = `${cur}${result.totalEffective.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("tallyVariance").innerText = `${cur}${Math.abs(result.variance).toFixed(2)}`;

  tbody.innerHTML = result.allCardExpenses.map(item => {
    const slip = parseFloat(item.slipAmount) || 0;
    const stmt = parseFloat(item.statementAmount) || 0;
    const fuel = parseFloat(item.fuelWaiver) || 0;
    const ref = parseFloat(item.refundAmount) || 0;
    const eff = ExpenseCalculator.calculateEffectiveAmount(item);

    const isMatch = (stmt === slip && stmt > 0) || (stmt > 0 && Math.abs(stmt - slip - fuel) < 0.05);
    const isPending = stmt === 0;

    return `
      <tr class="table-row-hover transition">
        <td class="px-4 py-3 text-slate-400 whitespace-nowrap">${formatDisplayDate(item.date)}</td>
        <td class="px-4 py-3 font-semibold text-white">${item.description}</td>
        <td class="px-4 py-3 text-right font-mono text-slate-400">${slip ? `${cur}${slip.toFixed(2)}` : '-'}</td>
        <td class="px-4 py-3 text-right font-mono text-slate-200">${stmt ? `${cur}${stmt.toFixed(2)}` : `<span class="text-amber-400/80 text-[10px]">Awaiting 24th</span>`}</td>
        <td class="px-4 py-3 text-right font-mono text-amber-400">${(fuel + ref) > 0 ? `-${cur}${(fuel + ref).toFixed(2)}` : '-'}</td>
        <td class="px-4 py-3 text-right font-mono font-bold text-indigo-400">${cur}${eff.toFixed(2)}</td>
        <td class="px-4 py-3 text-center">
          <span class="badge ${isPending ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : (isMatch ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20')}">
            ${isPending ? '⏳ Awaiting 24th' : (isMatch ? '✓ Reconciled' : '⚡ Surcharge / Waiver')}
          </span>
        </td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <button onclick="editExpense('${item.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition text-[11px] font-semibold">
            Edit / Reconcile
          </button>
        </td>
      </tr>
    `;
  }).join("");

  initLucide();
}

// =============================================================================
// PAYMENT TRACKING & ADVANCE FUNDS VIEW
// =============================================================================
function renderPaymentsView() {
  const tbody = document.getElementById("paymentsTableBody");
  if (!tbody) return;

  const cur = appState.settings.currencySymbol || "₹";
  const p1 = appState.settings.person1 || "Kitkat";
  const p2 = appState.settings.person2 || "Rashu";

  const monthPayments = appState.payments.filter(p => p.month === appState.currentMonth);

  const p1Total = monthPayments
    .filter(p => (p.person || "").toLowerCase() === p1.toLowerCase())
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const p2Total = monthPayments
    .filter(p => (p.person || "").toLowerCase() === p2.toLowerCase())
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  document.getElementById("payPerson1Total").innerText = `${cur}${p1Total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById("payPerson2Total").innerText = `${cur}${p2Total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById("payGrandTotal").innerText = `${cur}${(p1Total + p2Total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  if (monthPayments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-10 text-center text-slate-500 text-xs">
          No advance or settlement payments recorded for ${appState.currentMonth}.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = monthPayments.map(p => `
    <tr class="table-row-hover transition">
      <td class="px-5 py-3.5 text-slate-400 whitespace-nowrap">${formatDisplayDate(p.date)}</td>
      <td class="px-5 py-3.5 text-slate-400">${p.month}</td>
      <td class="px-5 py-3.5">
        <span class="badge ${getPersonBadgeClass(p.person)}">${p.person}</span>
      </td>
      <td class="px-5 py-3.5 text-slate-300 font-medium">${p.paymentMethod || 'UPI / Transfer'}</td>
      <td class="px-5 py-3.5 text-slate-400">
        <span class="text-white font-semibold">${p.purpose || 'Payment'}</span>
        ${p.notes ? ` <span class="text-slate-500">(${p.notes})</span>` : ''}
      </td>
      <td class="px-5 py-3.5 text-right font-mono font-bold text-emerald-400">${cur}${parseFloat(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td class="px-5 py-3.5 text-center">
        <button onclick="deletePayment('${p.id}')" class="p-1 text-slate-400 hover:text-red-400 transition" title="Delete">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </td>
    </tr>
  `).join("");

  initLucide();
}

// =============================================================================
// REPORTS VIEW
// =============================================================================
function renderReportsView() {
  const summary = ExpenseCalculator.calculateMonthSummary(appState.expenses, appState.payments, appState.currentMonth, appState.settings);
  const cur = appState.settings.currencySymbol || "₹";

  // Person Breakdown Chart
  const personCtx = document.getElementById("personReportChart");
  if (personCtx) {
    if (appState.personReportChart) appState.personReportChart.destroy();

    appState.personReportChart = new Chart(personCtx.getContext("2d"), {
      type: "bar",
      data: {
        labels: [summary.person1Name, summary.person2Name],
        datasets: [
          {
            label: 'Expense Share (₹)',
            data: [summary.person1TotalExpenseShare, summary.person2TotalExpenseShare],
            backgroundColor: ['#6366f1', '#a855f7'],
            borderRadius: 8
          },
          {
            label: 'Advance & Payments Contributed (₹)',
            data: [summary.person1Paid, summary.person2Paid],
            backgroundColor: ['#10b981', '#14b8a6'],
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cbd5e1' } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  // Month-Over-Month Chart (July vs August)
  const monthCtx = document.getElementById("monthlyTrendChart");
  if (monthCtx) {
    if (appState.monthlyTrendChart) appState.monthlyTrendChart.destroy();

    const julSum = ExpenseCalculator.calculateMonthSummary(appState.expenses, appState.payments, "July 2026", appState.settings);
    const augSum = ExpenseCalculator.calculateMonthSummary(appState.expenses, appState.payments, "August 2026", appState.settings);

    appState.monthlyTrendChart = new Chart(monthCtx.getContext("2d"), {
      type: "line",
      data: {
        labels: ["July 2026", "August 2026"],
        datasets: [
          {
            label: 'Effective Card Spend',
            data: [julSum.cardEffectiveSpend, augSum.cardEffectiveSpend],
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            fill: true,
            tension: 0.3,
            borderWidth: 3
          },
          {
            label: 'Statement Billed',
            data: [julSum.cardStatementTotal, augSum.cardStatementTotal],
            borderColor: '#ec4899',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cbd5e1' } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  // Category Table
  const catTbody = document.getElementById("categoryReportTableBody");
  if (catTbody) {
    const catData = ExpenseCalculator.calculateCategoryBreakdown(appState.expenses, appState.currentMonth);
    catTbody.innerHTML = catData.breakdown.map(c => `
      <tr class="table-row-hover transition">
        <td class="px-5 py-3.5 font-semibold text-white">${c.category}</td>
        <td class="px-5 py-3.5 text-right font-mono font-bold text-indigo-400">${cur}${c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="px-5 py-3.5 text-right">
          <div class="flex items-center justify-end gap-2">
            <span class="font-mono text-slate-300">${c.percentage}%</span>
            <div class="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div class="bg-indigo-500 h-1.5 rounded-full" style="width: ${c.percentage}%"></div>
            </div>
          </div>
        </td>
      </tr>
    `).join("");
  }
}

// Date formatting helpers for calendar picker & unified display
function parseToISODate(dateStr) {
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
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  dateStr = String(dateStr).trim();
  
  // If Month + Year header e.g. "Aug 2026"
  if (/^[A-Za-z]{3,9}\s+\d{4}$/.test(dateStr)) return dateStr;

  const iso = parseToISODate(dateStr);
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mName = months[parseInt(m, 10) - 1] || m;
    return `${d} ${mName} ${y.slice(2)}`;
  }
  return dateStr;
}

// =============================================================================
// MODALS & FORMS
// =============================================================================
function setupExpenseModal() {
  const modal = document.getElementById("expenseModal");
  const card = document.getElementById("expenseModalCard");
  const openBtns = [document.getElementById("openAddExpenseBtn"), document.getElementById("expenseAddBtn2")];
  const closeBtn = document.getElementById("closeExpenseModalBtn");
  const cancelBtn = document.getElementById("cancelExpenseModalBtn");
  const form = document.getElementById("expenseForm");

  const open = () => {
    document.getElementById("expenseModalTitle").innerText = "Log Daily Expense";
    form.reset();
    document.getElementById("editExpenseId").value = "";
    document.getElementById("expenseMonthInput").value = appState.currentMonth;
    document.getElementById("expenseDateInput").value = new Date().toISOString().split('T')[0];
    modal.classList.remove("hidden");
    setTimeout(() => {
      modal.classList.remove("opacity-0");
      card.classList.remove("scale-95");
    }, 10);
  };

  const close = () => {
    modal.classList.add("opacity-0");
    card.classList.add("scale-95");
    setTimeout(() => modal.classList.add("hidden"), 200);
  };

  openBtns.forEach(btn => { if (btn) btn.addEventListener("click", open); });
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("editExpenseId").value;
    const month = document.getElementById("expenseMonthInput").value;
    const rawDate = document.getElementById("expenseDateInput").value;
    const date = formatDisplayDate(rawDate);
    const description = document.getElementById("expenseDescInput").value;
    const slipAmount = parseFloat(document.getElementById("expenseSlipInput").value) || 0;
    const statementAmount = parseFloat(document.getElementById("expenseStmtInput").value) || 0;
    const fuelWaiver = parseFloat(document.getElementById("expenseFuelInput").value) || 0;
    const refundAmount = parseFloat(document.getElementById("expenseRefundInput").value) || 0;
    const usedBy = document.getElementById("expenseUsedByInput").value;
    const paymentType = document.getElementById("expenseTypeInput").value;
    const category = document.getElementById("expenseCategoryInput").value;
    const remarks = document.getElementById("expenseRemarksInput").value;

    const payload = {
      id: id || `exp_${Date.now()}`,
      month,
      date,
      description,
      slipAmount,
      statementAmount,
      fuelWaiver,
      refundAmount,
      usedBy,
      paymentType,
      category,
      remarks
    };

    if (id) {
      const idx = appState.expenses.findIndex(x => x.id === id);
      if (idx !== -1) appState.expenses[idx] = payload;
    } else {
      appState.expenses.push(payload);
    }

    StorageManager.addMonthIfNew(month);
    saveStateToStorage();
    renderApp();
    close();
  });
}

function editExpense(id) {
  const item = appState.expenses.find(x => x.id === id);
  if (!item) return;

  document.getElementById("expenseModalTitle").innerText = "Edit / Update Statement Details";
  document.getElementById("editExpenseId").value = item.id;
  document.getElementById("expenseMonthInput").value = item.month;
  document.getElementById("expenseDateInput").value = parseToISODate(item.date);
  document.getElementById("expenseDescInput").value = item.description;
  document.getElementById("expenseSlipInput").value = item.slipAmount || '';
  document.getElementById("expenseStmtInput").value = item.statementAmount || '';
  document.getElementById("expenseFuelInput").value = item.fuelWaiver || '';
  document.getElementById("expenseRefundInput").value = item.refundAmount || '';
  document.getElementById("expenseUsedByInput").value = item.usedBy || 'Both';
  document.getElementById("expenseTypeInput").value = item.paymentType || 'Card';
  document.getElementById("expenseCategoryInput").value = item.category || 'General';
  document.getElementById("expenseRemarksInput").value = item.remarks || '';

  const modal = document.getElementById("expenseModal");
  const card = document.getElementById("expenseModalCard");
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    card.classList.remove("scale-95");
  }, 10);
}

function deleteExpense(id) {
  if (confirm("Are you sure you want to delete this expense?")) {
    appState.expenses = appState.expenses.filter(x => x.id !== id);
    saveStateToStorage();
    renderApp();
  }
}

// Quick 24th Statement Reconciler Modal
function setupQuickStatementModal() {
  const modal = document.getElementById("quickStatementModal");
  const card = document.getElementById("quickStatementModalCard");
  const openBtns = [document.getElementById("openQuickStatementModalBtn"), document.getElementById("openQuickStatementModalBtn2")];
  const closeBtn = document.getElementById("closeQuickStatementModalBtn");
  const saveBtn = document.getElementById("saveQuickStatementBtn");
  const tbody = document.getElementById("quickStatementTableBody");

  const open = () => {
    renderQuickStatementTable();
    modal.classList.remove("hidden");
    setTimeout(() => {
      modal.classList.remove("opacity-0");
      card.classList.remove("scale-95");
    }, 10);
  };

  const close = () => {
    modal.classList.add("opacity-0");
    card.classList.add("scale-95");
    setTimeout(() => modal.classList.add("hidden"), 200);
  };

  openBtns.forEach(btn => { if (btn) btn.addEventListener("click", open); });
  if (closeBtn) closeBtn.addEventListener("click", close);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  function renderQuickStatementTable() {
    const monthExpenses = appState.expenses.filter(e => e.month === appState.currentMonth && (e.paymentType || "Card").toLowerCase() !== "non-card");
    const cur = appState.settings.currencySymbol || "₹";

    if (monthExpenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">No card transactions for this cycle.</td></tr>`;
      return;
    }

    tbody.innerHTML = monthExpenses.map(item => {
      const eff = ExpenseCalculator.calculateEffectiveAmount(item);
      const used = item.usedBy || 'Both';
      const p1 = appState.settings.person1 || "Kitkat";
      const p2 = appState.settings.person2 || "Rashu";
      return `
        <tr data-exp-id="${item.id}" class="hover:bg-slate-800/40">
          <td class="px-3 py-2 text-slate-400 whitespace-nowrap">${formatDisplayDate(item.date)}</td>
          <td class="px-3 py-2 text-white font-medium">${item.description}</td>
          <td class="px-3 py-2 text-center">
            <select class="quick-usedby-select px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-indigo-500 font-medium">
              <option value="${p1}" ${used === p1 ? 'selected' : ''}>${p1}</option>
              <option value="${p2}" ${used === p2 ? 'selected' : ''}>${p2}</option>
              <option value="Both" ${used === 'Both' ? 'selected' : ''}>Both</option>
            </select>
          </td>
          <td class="px-3 py-2 text-right font-mono text-slate-300">${cur}${(item.slipAmount || 0).toFixed(2)}</td>
          <td class="px-3 py-2 text-center">
            <input type="number" step="0.01" value="${item.statementAmount || ''}" placeholder="${item.slipAmount || '0.00'}" class="quick-stmt-input w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-center text-xs font-mono text-white focus:outline-none focus:border-indigo-500" />
          </td>
          <td class="px-3 py-2 text-center">
            <input type="number" step="0.01" value="${item.fuelWaiver || ''}" placeholder="0.00" class="quick-fuel-input w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-center text-xs font-mono text-amber-400 focus:outline-none focus:border-indigo-500" />
          </td>
          <td class="px-3 py-2 text-center">
            <input type="number" step="0.01" value="${item.refundAmount || ''}" placeholder="0.00" class="quick-ref-input w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-center text-xs font-mono text-emerald-400 focus:outline-none focus:border-indigo-500" />
          </td>
          <td class="px-3 py-2 text-right font-mono font-bold text-indigo-400">${cur}${eff.toFixed(2)}</td>
        </tr>
      `;
    }).join("");
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const rows = tbody.querySelectorAll("tr[data-exp-id]");
      rows.forEach(r => {
        const id = r.getAttribute("data-exp-id");
        const usedByVal = r.querySelector(".quick-usedby-select")?.value || "Both";
        const stmtVal = parseFloat(r.querySelector(".quick-stmt-input")?.value) || 0;
        const fuelVal = parseFloat(r.querySelector(".quick-fuel-input")?.value) || 0;
        const refVal = parseFloat(r.querySelector(".quick-ref-input")?.value) || 0;

        const tx = appState.expenses.find(x => x.id === id);
        if (tx) {
          tx.usedBy = usedByVal;
          tx.statementAmount = stmtVal;
          tx.fuelWaiver = fuelVal;
          tx.refundAmount = refVal;
        }
      });

      saveStateToStorage();
      renderApp();
      close();
      alert("Statement reconciliation values and user assignments saved successfully!");
    });
  }
}

// Payment & Advance Modal Setup
function setupPaymentModal() {
  const modal = document.getElementById("paymentModal");
  const card = document.getElementById("paymentModalCard");
  const openBtns = [
    document.getElementById("quickRecordPaymentBtn"), 
    document.getElementById("openRecordPaymentModalBtn"),
    document.getElementById("quickRecordAdvanceBtn")
  ];
  const closeBtn = document.getElementById("closePaymentModalBtn");
  const cancelBtn = document.getElementById("cancelPaymentModalBtn");
  const form = document.getElementById("paymentForm");
  const purposeSelect = document.getElementById("payPurposeInput");
  const amountInput = document.getElementById("payAmountInput");

  const open = (isAdvance = false) => {
    form.reset();
    document.getElementById("payMonthInput").value = appState.currentMonth;
    document.getElementById("payDateInput").value = new Date().toISOString().split('T')[0];
    
    if (purposeSelect) {
      purposeSelect.value = isAdvance ? "Advance Received Beforehand" : "Monthly Share Settlement";
    }

    modal.classList.remove("hidden");
    setTimeout(() => {
      modal.classList.remove("opacity-0");
      card.classList.remove("scale-95");
      if (amountInput) amountInput.focus();
    }, 10);
  };

  const close = () => {
    modal.classList.add("opacity-0");
    card.classList.add("scale-95");
    setTimeout(() => modal.classList.add("hidden"), 200);
  };

  const quickAdvBtn = document.getElementById("quickRecordAdvanceBtn");
  if (quickAdvBtn) {
    quickAdvBtn.addEventListener("click", () => open(true));
  }

  const payBtn1 = document.getElementById("quickRecordPaymentBtn");
  const payBtn2 = document.getElementById("openRecordPaymentModalBtn");
  if (payBtn1) payBtn1.addEventListener("click", () => open(false));
  if (payBtn2) payBtn2.addEventListener("click", () => open(false));

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const month = document.getElementById("payMonthInput").value;
    const rawDate = document.getElementById("payDateInput").value;
    const date = formatDisplayDate(rawDate);
    const person = document.getElementById("payPersonInput").value;
    const amount = parseFloat(document.getElementById("payAmountInput").value) || 0;
    const purpose = document.getElementById("payPurposeInput").value;
    const paymentMethod = document.getElementById("payMethodInput").value;
    const notes = document.getElementById("payNotesInput").value;

    appState.payments.push({
      id: `pay_${Date.now()}`,
      month,
      date,
      person,
      amount,
      purpose,
      paymentMethod,
      notes
    });

    saveStateToStorage();
    renderApp();
    close();
    alert(`Recorded ${appState.settings.currencySymbol || '₹'}${amount.toFixed(2)} received from ${person} for ${month}!`);
  });
}

function deletePayment(id) {
  if (confirm("Are you sure you want to delete this payment record?")) {
    appState.payments = appState.payments.filter(p => p.id !== id);
    saveStateToStorage();
    renderApp();
  }
}

// Statement Import Modal
function setupImportModal() {
  const modal = document.getElementById("importModal");
  const card = document.getElementById("importModalCard");
  const openBtn = document.getElementById("importStatementBtn");
  const closeBtn = document.getElementById("closeImportModalBtn");
  const cancelBtn = document.getElementById("cancelImportModalBtn");
  const fileInput = document.getElementById("statementFileInput");
  const dropZone = document.getElementById("dropZone");
  const importStatus = document.getElementById("importStatus");

  const open = () => {
    importStatus.classList.add("hidden");
    modal.classList.remove("hidden");
    setTimeout(() => {
      modal.classList.remove("opacity-0");
      card.classList.remove("scale-95");
    }, 10);
  };

  const close = () => {
    modal.classList.add("opacity-0");
    card.classList.add("scale-95");
    setTimeout(() => modal.classList.add("hidden"), 200);
  };

  if (openBtn) openBtn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);

  if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          importStatus.classList.remove("hidden");
          importStatus.innerHTML = `<span class="text-emerald-400 font-semibold">✓ Successfully parsed statement sheet!</span> Found ${rows.length} rows.`;
        } catch (err) {
          importStatus.classList.remove("hidden");
          importStatus.innerHTML = `<span class="text-red-400">Error reading statement file: ${err.message}</span>`;
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }
}

// Settings Form
function setupSettingsForm() {
  const form = document.getElementById("settingsForm");
  const person1Input = document.getElementById("settingsPerson1");
  const person2Input = document.getElementById("settingsPerson2");
  const currInput = document.getElementById("settingsCurrency");

  if (person1Input) person1Input.value = appState.settings.person1 || "Kitkat";
  if (person2Input) person2Input.value = appState.settings.person2 || "Rashu";
  if (currInput) currInput.value = appState.settings.currencySymbol || "₹";

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      appState.settings.person1 = person1Input.value.trim() || "Kitkat";
      appState.settings.person2 = person2Input.value.trim() || "Rashu";
      appState.settings.currencySymbol = currInput.value.trim() || "₹";
      saveStateToStorage();
      renderApp();
      alert("Settings updated successfully!");
    });
  }

  // Backup buttons
  const exportBtn = document.getElementById("exportJSONBackupBtn");
  const importInput = document.getElementById("importJSONInput");
  const resetBtn = document.getElementById("resetToExcelBtn");

  if (exportBtn) {
    exportBtn.addEventListener("click", () => StorageManager.exportJSONBackup());
  }

  if (importInput) {
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const res = StorageManager.importJSONBackup(evt.target.result);
        if (res.success) {
          loadStateFromStorage();
          renderApp();
          alert("Backup restored successfully!");
        } else {
          alert("Failed to restore backup: " + res.error);
        }
      };
      reader.readAsText(file);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset all data back to the exact initial Excel numbers (July & August 2026)?")) {
        StorageManager.resetToExcelData();
        loadStateFromStorage();
        renderApp();
        alert("Reset complete! Original Excel dataset loaded.");
      }
    });
  }
}

// Global scope helpers for onclick handlers
window.editExpense = editExpense;
window.deleteExpense = deleteExpense;
window.deletePayment = deletePayment;
