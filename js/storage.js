/**
 * SpendWise Data Persistence Manager
 * Hybrid Engine: LocalStorage (Offline Cache) + Supabase Cloud (Live Sync)
 */

const StorageManager = {
  STORAGE_KEY_EXPENSES: 'spendwise_expenses',
  STORAGE_KEY_PAYMENTS: 'spendwise_payments',
  STORAGE_KEY_SETTINGS: 'spendwise_settings',
  STORAGE_KEY_MONTHS: 'spendwise_months',

  // Initialize or retrieve state
  init(onCloudSyncCallback) {
    // 1. Initial LocalStorage baseline boot
    if (!localStorage.getItem(this.STORAGE_KEY_EXPENSES)) {
      this.resetToExcelData();
    } else {
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

      const storedMonths = this.getMonths();
      window.AVAILABLE_MONTHS.forEach(m => {
        if (!storedMonths.includes(m)) {
          storedMonths.unshift(m);
        }
      });
      this.saveMonths(storedMonths);
    }

    // 2. Initialize Cloud Connection in background if credentials exist
    this.initCloud(onCloudSyncCallback);
  },

  async initCloud(onCloudSyncCallback) {
    if (typeof SupabaseService === 'undefined') return;

    const initialized = SupabaseService.init();
    if (!initialized) {
      if (typeof onCloudSyncCallback === 'function') onCloudSyncCallback('local');
      return;
    }

    try {
      // Check cloud data
      const cloudExpenses = await SupabaseService.fetchExpenses();
      const cloudPayments = await SupabaseService.fetchPayments();
      const cloudSettings = await SupabaseService.fetchSettings();
      const cloudMonths = await SupabaseService.fetchMonths();

      if (cloudExpenses && cloudExpenses.length > 0) {
        // Cloud has data -> update local storage cache with cloud truth
        this.saveExpenses(cloudExpenses);
        if (cloudPayments) this.savePayments(cloudPayments);
        if (cloudSettings) this.saveSettings(cloudSettings);
        if (cloudMonths && cloudMonths.length > 0) this.saveMonths(cloudMonths);
        console.log(`☁️ Synced ${cloudExpenses.length} expenses from Supabase Cloud`);
      } else if (cloudExpenses && cloudExpenses.length === 0) {
        // Cloud is empty -> auto seed cloud with our local baseline data
        console.log('☁️ Supabase is empty. Seeding baseline data to Cloud...');
        await SupabaseService.syncLocalToCloud(
          this.getExpenses(),
          this.getPayments(),
          this.getMonths(),
          this.getSettings()
        );
      }

      // Subscribe to real-time changes
      SupabaseService.subscribeToRealtime((table, payload) => {
        if (typeof onCloudSyncCallback === 'function') {
          onCloudSyncCallback('realtime', { table, payload });
        }
      });

      if (typeof onCloudSyncCallback === 'function') {
        onCloudSyncCallback('connected');
      }
    } catch (e) {
      console.warn('Could not sync with Supabase cloud on boot:', e);
      if (typeof onCloudSyncCallback === 'function') onCloudSyncCallback('error', e);
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

  async saveExpenseAsync(expense) {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex(x => x.id === expense.id);
    if (idx !== -1) {
      expenses[idx] = expense;
    } else {
      expenses.push(expense);
    }
    this.saveExpenses(expenses);

    if (window.SupabaseService && window.SupabaseService.isConnected) {
      await window.SupabaseService.upsertExpense(expense);
    }
  },

  async deleteExpenseAsync(id) {
    const expenses = this.getExpenses().filter(x => x.id !== id);
    this.saveExpenses(expenses);

    if (window.SupabaseService && window.SupabaseService.isConnected) {
      await window.SupabaseService.deleteExpense(id);
    }
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

  async savePaymentAsync(payment) {
    const payments = this.getPayments();
    const idx = payments.findIndex(p => p.id === payment.id);
    if (idx !== -1) {
      payments[idx] = payment;
    } else {
      payments.push(payment);
    }
    this.savePayments(payments);

    if (window.SupabaseService && window.SupabaseService.isConnected) {
      await window.SupabaseService.upsertPayment(payment);
    }
  },

  async deletePaymentAsync(id) {
    const payments = this.getPayments().filter(p => p.id !== id);
    this.savePayments(payments);

    if (window.SupabaseService && window.SupabaseService.isConnected) {
      await window.SupabaseService.deletePayment(id);
    }
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
    if (window.SupabaseService && window.SupabaseService.isConnected) {
      window.SupabaseService.saveSettings(settings);
    }
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
      if (window.SupabaseService && window.SupabaseService.isConnected) {
        window.SupabaseService.insertMonth(monthName);
      }
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
      return true;
    } catch (e) {
      console.error("Invalid backup file", e);
      return false;
    }
  },

  // Export CSV of current filtered data
  exportExpensesCSV(currentMonth) {
    const expenses = this.getExpenses();
    const settings = this.getSettings();
    const filtered = currentMonth === "ALL" ? expenses : expenses.filter(e => e.month === currentMonth);

    const headers = [
      "Month",
      "Date",
      "Description",
      "Slip Amount",
      "Statement Amount",
      "Fuel Surcharge Waiver",
      "Refund Amount",
      "Used By",
      "Payment Type",
      "Effective Spend",
      `${settings.person1} Share`,
      `${settings.person2} Share`,
      "Category",
      "Remarks"
    ];

    const rows = filtered.map(t => {
      const shares = ExpenseCalculator.calculateItemShares(t, settings.person1, settings.person2);
      return [
        `"${t.month}"`,
        `"${window.formatDisplayDate ? window.formatDisplayDate(t.date) : t.date}"`,
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
    link.setAttribute("download", `spendwise_expenses_${currentMonth.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};

window.StorageManager = StorageManager;
