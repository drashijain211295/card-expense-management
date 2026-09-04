/**
 * SpendWise LocalStorage and Data Persistence Manager
 */

const StorageManager = {
  STORAGE_KEY_EXPENSES: 'spendwise_expenses',
  STORAGE_KEY_PAYMENTS: 'spendwise_payments',
  STORAGE_KEY_SETTINGS: 'spendwise_settings',
  STORAGE_KEY_MONTHS: 'spendwise_months',

  // Initialize or retrieve state
  init() {
    if (!localStorage.getItem(this.STORAGE_KEY_EXPENSES)) {
      this.resetToExcelData();
    } else {
      // Ensure any newly configured default expenses (like September additions) are synced if missing
      const storedExpenses = this.getExpenses();
      let hasChanges = false;
      
      // Normalize dates in all stored expenses for consistent display
      storedExpenses.forEach(e => {
        const formatted = window.formatDisplayDate ? window.formatDisplayDate(e.date) : e.date;
        if (formatted && formatted !== e.date) {
          e.date = formatted;
          hasChanges = true;
        }
      });

      window.INITIAL_EXPENSES.forEach(initExp => {
        if (!storedExpenses.some(e => e.id === initExp.id)) {
          storedExpenses.push(initExp);
          hasChanges = true;
        }
      });
      if (hasChanges) {
        this.saveExpenses(storedExpenses);
      }

      // Ensure months list contains all available months
      const storedMonths = this.getMonths();
      window.AVAILABLE_MONTHS.forEach(m => {
        if (!storedMonths.includes(m)) {
          storedMonths.unshift(m);
        }
      });
      this.saveMonths(storedMonths);
    }
  },

  getExpenses() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_EXPENSES);
      return data ? JSON.parse(data) : [...window.INITIAL_EXPENSES];
    } catch (e) {
      console.error("Failed to read expenses from storage", e);
      return [...window.INITIAL_EXPENSES];
    }
  },

  saveExpenses(expenses) {
    localStorage.setItem(this.STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
  },

  getPayments() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_PAYMENTS);
      return data ? JSON.parse(data) : [...window.INITIAL_PAYMENTS];
    } catch (e) {
      console.error("Failed to read payments from storage", e);
      return [...window.INITIAL_PAYMENTS];
    }
  },

  savePayments(payments) {
    localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(payments));
  },

  getSettings() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_SETTINGS);
      return data ? JSON.parse(data) : { ...window.DEFAULT_SETTINGS };
    } catch (e) {
      console.error("Failed to read settings from storage", e);
      return { ...window.DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    localStorage.setItem(this.STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  },

  getMonths() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_MONTHS);
      return data ? JSON.parse(data) : [...window.AVAILABLE_MONTHS];
    } catch (e) {
      return [...window.AVAILABLE_MONTHS];
    }
  },

  saveMonths(months) {
    localStorage.setItem(this.STORAGE_KEY_MONTHS, JSON.stringify(months));
  },

  addMonthIfNew(monthName) {
    const months = this.getMonths();
    if (!months.includes(monthName)) {
      months.unshift(monthName);
      this.saveMonths(months);
    }
  },

  resetToExcelData() {
    localStorage.setItem(this.STORAGE_KEY_EXPENSES, JSON.stringify(window.INITIAL_EXPENSES));
    localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(window.INITIAL_PAYMENTS));
    localStorage.setItem(this.STORAGE_KEY_SETTINGS, JSON.stringify(window.DEFAULT_SETTINGS));
    localStorage.setItem(this.STORAGE_KEY_MONTHS, JSON.stringify(window.AVAILABLE_MONTHS));
  },

  // Export complete JSON backup
  exportJSONBackup() {
    const backupData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      settings: this.getSettings(),
      months: this.getMonths(),
      expenses: this.getExpenses(),
      payments: this.getPayments()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `spendwise_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  // Import JSON backup
  importJSONBackup(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.expenses && Array.isArray(parsed.expenses)) {
        this.saveExpenses(parsed.expenses);
      }
      if (parsed.payments && Array.isArray(parsed.payments)) {
        this.savePayments(parsed.payments);
      }
      if (parsed.settings) {
        this.saveSettings(parsed.settings);
      }
      if (parsed.months && Array.isArray(parsed.months)) {
        this.saveMonths(parsed.months);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // Export Expenses as CSV
  exportExpensesCSV(month = "ALL") {
    const expenses = this.getExpenses();
    const filtered = month === "ALL" ? expenses : expenses.filter(e => e.month === month);
    const settings = this.getSettings();

    const headers = [
      "Month",
      "Date",
      "Description",
      "Slip Amount",
      "Statement Amount",
      "Fuel Waiver",
      "Refund Amount",
      "Used By",
      "Payment Type",
      "Effective Amount",
      `${settings.person1} Share`,
      `${settings.person2} Share`,
      "Category",
      "Remarks"
    ];

    const rows = filtered.map(t => {
      const shares = ExpenseCalculator.calculateItemShares(t, settings.person1, settings.person2);
      return [
        `"${t.month}"`,
        `"${t.date}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.slipAmount || 0,
        t.statementAmount || 0,
        t.fuelWaiver || 0,
        t.refundAmount || 0,
        `"${t.usedBy}"`,
        `"${t.paymentType}"`,
        shares.effectiveAmount.toFixed(2),
        shares.person1Share.toFixed(2),
        shares.person2Share.toFixed(2),
        `"${t.category || ''}"`,
        `"${(t.remarks || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expenses_${month.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};

window.StorageManager = StorageManager;
