/**
 * SpendWise Data Persistence & Multi-Device Synchronization Engine
 * Triple-Layer Engine: LocalStorage (Offline Cache) + Node/MongoDB Server REST API + Supabase Cloud
 */

const StorageManager = {
  STORAGE_KEY_EXPENSES: 'spendwise_expenses',
  STORAGE_KEY_UPI_EXPENSES: 'spendwise_upi_expenses',
  STORAGE_KEY_PAYMENTS: 'spendwise_payments',
  STORAGE_KEY_SETTINGS: 'spendwise_settings',
  STORAGE_KEY_MONTHS: 'spendwise_months',
  STORAGE_KEY_TRASH: 'spendwise_trash',
  STORAGE_KEY_DELETED_IDS: 'spendwise_deleted_ids',
  
  eventSource: null,

  // Initialize or retrieve state
  init(onSyncCallback) {
    const deletedIds = this.getDeletedIds();

    // 1. Initial LocalStorage baseline boot
    if (!localStorage.getItem(this.STORAGE_KEY_EXPENSES)) {
      this.resetToExcelData();
    } else {
      let storedExpenses = this.getExpenses();
      let hasChanges = false;
      
      // Filter out any previously deleted IDs
      if (deletedIds.length > 0) {
        const filtered = storedExpenses.filter(e => !deletedIds.includes(e.id));
        if (filtered.length !== storedExpenses.length) {
          storedExpenses = filtered;
          hasChanges = true;
        }
      }

      // Normalize dates and fuel waivers for display
      storedExpenses.forEach(e => {
        const formatted = window.formatDisplayDate ? window.formatDisplayDate(e.date) : e.date;
        if (formatted && formatted !== e.date) {
          e.date = formatted;
          hasChanges = true;
        }

        const isFuel = (e.category === 'Fuel') || /petrol|fuel|filling|fuels|sharma|misrod|kanta/i.test(e.description || '');
        if (isFuel && (!e.fuelWaiver || e.fuelWaiver === 0) && e.slipAmount > 0 && e.statementAmount > e.slipAmount) {
          e.fuelWaiver = parseFloat((e.statementAmount - e.slipAmount).toFixed(2));
          e.category = 'Fuel';
          hasChanges = true;
        }
      });

      const DATA_VERSION = 'spendwise_v3.0_full_data_reset_sync';
      const currentVersion = localStorage.getItem('spendwise_version');

      if (currentVersion !== DATA_VERSION) {
        // Force baseline sync for all expenses, upi spends, and payments on fresh release
        (window.INITIAL_EXPENSES || []).forEach(initExp => {
          if (deletedIds.includes(initExp.id)) return;
          const idx = storedExpenses.findIndex(e => e.id === initExp.id);
          if (idx !== -1) {
            storedExpenses[idx] = { ...initExp };
          } else {
            storedExpenses.push(initExp);
          }
        });
        hasChanges = true;

        let storedUpi = this.getUpiExpenses();
        (window.INITIAL_UPI_EXPENSES || []).forEach(initUpi => {
          if (deletedIds.includes(initUpi.id)) return;
          const idx = storedUpi.findIndex(u => u.id === initUpi.id);
          if (idx !== -1) {
            storedUpi[idx] = { ...initUpi };
          } else {
            storedUpi.push(initUpi);
          }
        });
        this.saveUpiExpenses(storedUpi);

        let storedPayments = this.getPayments();
        (window.INITIAL_PAYMENTS || []).forEach(initPay => {
          if (deletedIds.includes(initPay.id)) return;
          const idx = storedPayments.findIndex(p => p.id === initPay.id);
          if (idx !== -1) {
            storedPayments[idx] = { ...initPay };
          } else {
            storedPayments.push(initPay);
          }
        });
        this.savePayments(storedPayments);

        localStorage.setItem('spendwise_version', DATA_VERSION);
      }

      if (hasChanges) {
        this.saveExpenses(storedExpenses);
      }

      // Check UPI expenses
      if (!localStorage.getItem(this.STORAGE_KEY_UPI_EXPENSES)) {
        const upiFiltered = (window.INITIAL_UPI_EXPENSES || []).filter(u => !deletedIds.includes(u.id));
        this.saveUpiExpenses(upiFiltered);
      } else {
        let storedUpi = this.getUpiExpenses();
        let upiChanges = false;
        if (deletedIds.length > 0) {
          const filtered = storedUpi.filter(u => !deletedIds.includes(u.id));
          if (filtered.length !== storedUpi.length) {
            storedUpi = filtered;
            upiChanges = true;
          }
        }
        if (upiChanges) {
          this.saveUpiExpenses(storedUpi);
        }
      }

      const storedMonths = this.getMonths();
      (window.AVAILABLE_MONTHS || []).forEach(m => {
        if (!storedMonths.includes(m)) {
          storedMonths.push(m);
        }
      });
      this.saveMonths(storedMonths);
    }

    // 2. Start Node/MongoDB Server API sync & Server-Sent Events (SSE) listener
    this.initServerSync(onSyncCallback);

    // 3. Initialize Supabase Cloud Connection in background
    this.initCloud(onSyncCallback);
  },

  // ==========================================
  // SERVER API & REAL-TIME MULTI-DEVICE SYNC
  // ==========================================
  async initServerSync(onSyncCallback) {
    try {
      // Fetch state from server
      const res = await fetch('/api/data').catch(() => null);
      if (res && res.ok) {
        const serverData = await res.json();
        if (serverData && !serverData.error) {
          this.mergeServerData(serverData);
          console.log('📡 Merged multi-device server data into local storage');
          if (typeof onSyncCallback === 'function') onSyncCallback('server_connected', serverData);
        }
      } else {
        // Server might be static or unreachable, push local baseline to server
        this.pushFullSyncToServer();
      }
    } catch (e) {
      console.warn('Server API sync notice:', e.message);
    }

    // Connect Server-Sent Events (SSE) for instant cross-device updates (Phone <-> Desktop)
    this.connectServerSSE(onSyncCallback);

    // Background polling fallback every 8 seconds for Vercel serverless cloud sync
    if (!window._spendwise_poll_timer) {
      window._spendwise_poll_timer = setInterval(async () => {
        try {
          const res = await fetch('/api/data').catch(() => null);
          if (res && res.ok) {
            const fresh = await res.json();
            if (fresh && !fresh.error) {
              this.mergeServerData(fresh);
              if (typeof onSyncCallback === 'function') onSyncCallback('realtime', fresh);
            }
          }
        } catch (e) {}
      }, 8000);
    }
  },

  connectServerSSE(onSyncCallback) {
    if (typeof window.EventSource === 'undefined') return;
    try {
      if (this.eventSource) this.eventSource.close();
      this.eventSource = new EventSource('/api/events');

      this.eventSource.onmessage = async (e) => {
        try {
          const payload = JSON.parse(e.data);
          console.log('⚡ Server Realtime Push Received:', payload.type);
          if (payload.type !== 'connected') {
            // Re-fetch latest server state & re-render app
            const res = await fetch('/api/data').catch(() => null);
            if (res && res.ok) {
              const freshData = await res.json();
              this.mergeServerData(freshData);
              if (typeof onSyncCallback === 'function') onSyncCallback('realtime', freshData);
            }
          }
        } catch (err) {
          console.error('SSE message parse error:', err);
        }
      };

      this.eventSource.onerror = (e) => {
        // Silent reconnect attempt
      };
    } catch (e) {
      console.warn('SSE connection warning:', e);
    }
  },

  mergeServerData(serverData) {
    const deletedIds = Array.from(new Set([...this.getDeletedIds(), ...(serverData.deletedIds || [])]));
    this.saveDeletedIds(deletedIds);

    if (serverData.expenses && Array.isArray(serverData.expenses)) {
      const validExpenses = serverData.expenses.filter(e => !deletedIds.includes(e.id));
      this.saveExpenses(validExpenses);
    }
    if (serverData.upiExpenses && Array.isArray(serverData.upiExpenses)) {
      const validUpi = serverData.upiExpenses.filter(u => !deletedIds.includes(u.id));
      this.saveUpiExpenses(validUpi);
    }
    if (serverData.payments && Array.isArray(serverData.payments)) {
      const validPayments = serverData.payments.filter(p => !deletedIds.includes(p.id));
      this.savePayments(validPayments);
    }
    if (serverData.settings && Object.keys(serverData.settings).length > 0) {
      this.saveSettings(serverData.settings);
    }
    if (serverData.months && Array.isArray(serverData.months) && serverData.months.length > 0) {
      this.saveMonths(serverData.months);
    }
    if (serverData.trash && Array.isArray(serverData.trash)) {
      this.saveTrash(serverData.trash);
    }
  },

  async pushFullSyncToServer() {
    try {
      const payload = {
        expenses: this.getExpenses(),
        upiExpenses: this.getUpiExpenses(),
        payments: this.getPayments(),
        settings: this.getSettings(),
        months: this.getMonths(),
        trash: this.getTrash(),
        deletedIds: this.getDeletedIds()
      };
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => null);
    } catch (e) {
      // Ignore background sync errors
    }
  },

  // ==========================================
  // SUPABASE CLOUD CONNECTION
  // ==========================================
  async initCloud(onCloudSyncCallback) {
    if (typeof SupabaseService === 'undefined') return;

    const initialized = SupabaseService.init();
    if (!initialized) {
      if (typeof onCloudSyncCallback === 'function') onCloudSyncCallback('local');
      return;
    }

    try {
      const cloudExpenses = await SupabaseService.fetchExpenses();
      const cloudUpi = await SupabaseService.fetchUpiExpenses();
      const cloudPayments = await SupabaseService.fetchPayments();
      const cloudSettings = await SupabaseService.fetchSettings();
      const cloudMonths = await SupabaseService.fetchMonths();

      const deletedIds = this.getDeletedIds();

      if (cloudExpenses && cloudExpenses.length > 0) {
        const filteredExpenses = cloudExpenses.filter(e => !deletedIds.includes(e.id));
        this.saveExpenses(filteredExpenses);
        if (cloudUpi && cloudUpi.length > 0) {
          const filteredUpi = cloudUpi.filter(u => !deletedIds.includes(u.id));
          this.saveUpiExpenses(filteredUpi);
        }
        if (cloudPayments) {
          const filteredPay = cloudPayments.filter(p => !deletedIds.includes(p.id));
          this.savePayments(filteredPay);
        }
        if (cloudSettings) this.saveSettings(cloudSettings);
        if (cloudMonths && cloudMonths.length > 0) this.saveMonths(cloudMonths);
        console.log(`☁️ Synced ${filteredExpenses.length} card expenses & ${cloudUpi ? cloudUpi.length : 0} UPI spends from Supabase Cloud`);
      } else if (cloudExpenses && cloudExpenses.length === 0) {
        console.log('☁️ Supabase is empty. Seeding baseline data to Cloud...');
        await SupabaseService.syncLocalToCloud(
          this.getExpenses(),
          this.getPayments(),
          this.getMonths(),
          this.getSettings(),
          this.getUpiExpenses()
        );
      }

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

  // ==========================================
  // DELETED IDS LEDGER (PREVENTS RESURRECTION)
  // ==========================================
  getDeletedIds() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_DELETED_IDS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveDeletedIds(ids) {
    const unique = Array.from(new Set(ids || []));
    localStorage.setItem(this.STORAGE_KEY_DELETED_IDS, JSON.stringify(unique));
  },

  recordDeletedId(id) {
    if (!id) return;
    const deletedIds = this.getDeletedIds();
    if (!deletedIds.includes(id)) {
      deletedIds.push(id);
      this.saveDeletedIds(deletedIds);
    }
  },

  // ==========================================
  // CARD EXPENSES
  // ==========================================
  getExpenses() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_EXPENSES);
      const expenses = data ? JSON.parse(data) : [...(window.INITIAL_EXPENSES || [])];
      const deletedIds = this.getDeletedIds();
      return expenses.filter(e => !deletedIds.includes(e.id));
    } catch (e) {
      console.error("Failed to read expenses from storage", e);
      return [...(window.INITIAL_EXPENSES || [])];
    }
  },

  saveExpenses(expenses) {
    const deletedIds = this.getDeletedIds();
    const filtered = (expenses || []).filter(e => !deletedIds.includes(e.id));
    localStorage.setItem(this.STORAGE_KEY_EXPENSES, JSON.stringify(filtered));
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

    // Push to Server API (MongoDB / Local File DB)
    fetch('/api/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense)
    }).catch(() => null);

    // Push to Supabase Cloud if configured
    if (window.SupabaseService && window.SupabaseService.isConnected) {
      await window.SupabaseService.upsertExpense(expense);
    }
  },

  async deleteExpenseAsync(id) {
    this.recordDeletedId(id);
    const expenses = this.getExpenses();
    const item = expenses.find(x => x.id === id);
    if (item) {
      this.moveToTrash('Card', item);
    }
    const filtered = expenses.filter(x => x.id !== id);
    this.saveExpenses(filtered);

    // Server API DELETE
    fetch(`/api/expense/${id}`, { method: 'DELETE' }).catch(() => null);

    // Supabase Cloud DELETE
    if (window.SupabaseService && window.SupabaseService.isConnected) {
      await window.SupabaseService.deleteExpense(id);
    }
  },

  // ==========================================
  // UPI / BANK ACCOUNT EXPENSES
  // ==========================================
  getUpiExpenses() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_UPI_EXPENSES);
      const upiList = data ? JSON.parse(data) : [...(window.INITIAL_UPI_EXPENSES || [])];
      const deletedIds = this.getDeletedIds();
      return upiList.filter(u => !deletedIds.includes(u.id));
    } catch (e) {
      console.error("Failed to read UPI expenses from storage", e);
      return [...(window.INITIAL_UPI_EXPENSES || [])];
    }
  },

  saveUpiExpenses(expenses) {
    const deletedIds = this.getDeletedIds();
    const filtered = (expenses || []).filter(u => !deletedIds.includes(u.id));
    localStorage.setItem(this.STORAGE_KEY_UPI_EXPENSES, JSON.stringify(filtered));
  },

  async saveUpiExpenseAsync(expense) {
    const upiList = this.getUpiExpenses();
    const idx = upiList.findIndex(x => x.id === expense.id);
    if (idx !== -1) {
      upiList[idx] = expense;
    } else {
      upiList.push(expense);
    }
    this.saveUpiExpenses(upiList);

    fetch('/api/upi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense)
    }).catch(() => null);

    if (window.SupabaseService && window.SupabaseService.isConnected) {
      await window.SupabaseService.upsertUpiExpense(expense);
    }
  },

  async deleteUpiExpenseAsync(id) {
    this.recordDeletedId(id);
    const upiList = this.getUpiExpenses();
    const item = upiList.find(x => x.id === id);
    if (item) {
      this.moveToTrash('UPI', item);
    }
    const filtered = upiList.filter(x => x.id !== id);
    this.saveUpiExpenses(filtered);

    fetch(`/api/upi/${id}`, { method: 'DELETE' }).catch(() => null);

    if (window.SupabaseService && window.SupabaseService.isConnected) {
      await window.SupabaseService.deleteUpiExpense(id);
    }
  },

  // ==========================================
  // PAYMENTS & ADVANCE
  // ==========================================
  getPayments() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_PAYMENTS);
      const payments = data ? JSON.parse(data) : [...(window.INITIAL_PAYMENTS || [])];
      const deletedIds = this.getDeletedIds();
      return payments.filter(p => !deletedIds.includes(p.id));
    } catch (e) {
      console.error("Failed to read payments from storage", e);
      return [...(window.INITIAL_PAYMENTS || [])];
    }
  },

  savePayments(payments) {
    const deletedIds = this.getDeletedIds();
    const filtered = (payments || []).filter(p => !deletedIds.includes(p.id));
    localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(filtered));
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

    fetch('/api/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment)
    }).catch(() => null);

    if (window.SupabaseService && window.SupabaseService.isConnected) {
      await window.SupabaseService.upsertPayment(payment);
    }
  },

  async deletePaymentAsync(id) {
    this.recordDeletedId(id);
    const payments = this.getPayments();
    const item = payments.find(p => p.id === id);
    if (item) {
      this.moveToTrash('Payment', item);
    }
    const filtered = payments.filter(p => p.id !== id);
    this.savePayments(filtered);

    fetch(`/api/payment/${id}`, { method: 'DELETE' }).catch(() => null);

    if (window.SupabaseService && window.SupabaseService.isConnected) {
      await window.SupabaseService.deletePayment(id);
    }
  },

  // ==========================================
  // TRASH / RECYCLE BIN (DELETED ITEMS)
  // ==========================================
  getTrash() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_TRASH);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to read trash from storage", e);
      return [];
    }
  },

  saveTrash(trashList) {
    localStorage.setItem(this.STORAGE_KEY_TRASH, JSON.stringify(trashList || []));
  },

  moveToTrash(type, item) {
    if (!item) return null;
    const trash = this.getTrash();
    const trashEntry = {
      trashId: `trash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: type, // 'Card' | 'UPI' | 'Payment'
      deletedAt: new Date().toISOString(),
      item: { ...item }
    };
    trash.unshift(trashEntry);
    this.saveTrash(trash);
    return trashEntry;
  },

  restoreFromTrash(trashId) {
    const trash = this.getTrash();
    const entryIndex = trash.findIndex(t => t.trashId === trashId);
    if (entryIndex === -1) return null;

    const entry = trash[entryIndex];
    trash.splice(entryIndex, 1);
    this.saveTrash(trash);

    // Remove item ID from deletedIds array
    if (entry.item && entry.item.id) {
      const deletedIds = this.getDeletedIds().filter(id => id !== entry.item.id);
      this.saveDeletedIds(deletedIds);
    }

    // Restore to appropriate collection
    if (entry.type === 'Card') {
      const expenses = this.getExpenses();
      if (!expenses.some(e => e.id === entry.item.id)) {
        expenses.push(entry.item);
        this.saveExpenses(expenses);
        this.saveExpenseAsync(entry.item);
      }
    } else if (entry.type === 'UPI') {
      const upiList = this.getUpiExpenses();
      if (!upiList.some(u => u.id === entry.item.id)) {
        upiList.push(entry.item);
        this.saveUpiExpenses(upiList);
        this.saveUpiExpenseAsync(entry.item);
      }
    } else if (entry.type === 'Payment') {
      const payments = this.getPayments();
      if (!payments.some(p => p.id === entry.item.id)) {
        payments.push(entry.item);
        this.savePayments(payments);
        this.savePaymentAsync(entry.item);
      }
    }

    return entry;
  },

  restoreAllTrash() {
    const trash = this.getTrash();
    let restoredCount = 0;
    trash.forEach(entry => {
      if (entry.trashId) {
        this.restoreFromTrash(entry.trashId);
        restoredCount++;
      }
    });
    return restoredCount;
  },

  async emptyTrash() {
    const trash = this.getTrash();
    
    // Mark all item IDs as permanently deleted
    trash.forEach(entry => {
      if (entry.item && entry.item.id) {
        this.recordDeletedId(entry.item.id);
        
        // Permanent deletion from Supabase Cloud
        if (window.SupabaseService && window.SupabaseService.isConnected) {
          if (entry.type === 'Card') window.SupabaseService.deleteExpense(entry.item.id);
          if (entry.type === 'UPI') window.SupabaseService.deleteUpiExpense(entry.item.id);
          if (entry.type === 'Payment') window.SupabaseService.deletePayment(entry.item.id);
        }
      }
    });

    this.saveTrash([]);

    // Permanent deletion on Server API
    fetch('/api/trash/empty', { method: 'POST' }).catch(() => null);
  },

  async deleteFromTrashPermanently(trashId) {
    const trash = this.getTrash();
    const entry = trash.find(t => t.trashId === trashId);
    
    if (entry && entry.item && entry.item.id) {
      this.recordDeletedId(entry.item.id);

      // Cloud deletion
      if (window.SupabaseService && window.SupabaseService.isConnected) {
        if (entry.type === 'Card') await window.SupabaseService.deleteExpense(entry.item.id);
        if (entry.type === 'UPI') await window.SupabaseService.deleteUpiExpense(entry.item.id);
        if (entry.type === 'Payment') await window.SupabaseService.deletePayment(entry.item.id);
      }
    }

    const filtered = trash.filter(t => t.trashId !== trashId);
    this.saveTrash(filtered);

    // Server API DELETE
    fetch(`/api/trash/${trashId}`, { method: 'DELETE' }).catch(() => null);
  },

  // ==========================================
  // SETTINGS & MONTHS
  // ==========================================
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

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(() => null);

    if (window.SupabaseService && window.SupabaseService.isConnected) {
      window.SupabaseService.saveSettings(settings);
    }
  },

  getMonths() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_MONTHS);
      const months = data ? JSON.parse(data) : [...(window.AVAILABLE_MONTHS || [])];
      return typeof ExpenseCalculator !== 'undefined' && ExpenseCalculator.sortMonthsChronologically 
        ? ExpenseCalculator.sortMonthsChronologically(months, true)
        : months;
    } catch (e) {
      return typeof ExpenseCalculator !== 'undefined' && ExpenseCalculator.sortMonthsChronologically 
        ? ExpenseCalculator.sortMonthsChronologically(window.AVAILABLE_MONTHS || [], true)
        : [...(window.AVAILABLE_MONTHS || [])];
    }
  },

  saveMonths(months) {
    const sorted = typeof ExpenseCalculator !== 'undefined' && ExpenseCalculator.sortMonthsChronologically 
      ? ExpenseCalculator.sortMonthsChronologically(months, true)
      : months;
    localStorage.setItem(this.STORAGE_KEY_MONTHS, JSON.stringify(sorted));
  },

  addMonthIfNew(monthName) {
    if (!monthName || monthName === "ALL") return;
    const months = this.getMonths();
    if (!months.includes(monthName)) {
      months.push(monthName);
      this.saveMonths(months);
      if (window.SupabaseService && window.SupabaseService.isConnected) {
        window.SupabaseService.insertMonth(monthName);
      }
    }
  },

  resetToExcelData() {
    localStorage.setItem(this.STORAGE_KEY_EXPENSES, JSON.stringify(window.INITIAL_EXPENSES || []));
    localStorage.setItem(this.STORAGE_KEY_UPI_EXPENSES, JSON.stringify(window.INITIAL_UPI_EXPENSES || []));
    localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(window.INITIAL_PAYMENTS || []));
    localStorage.setItem(this.STORAGE_KEY_SETTINGS, JSON.stringify(window.DEFAULT_SETTINGS || {}));
    localStorage.setItem(this.STORAGE_KEY_MONTHS, JSON.stringify(window.AVAILABLE_MONTHS || []));
    localStorage.setItem(this.STORAGE_KEY_DELETED_IDS, JSON.stringify([]));
  },

  // Export complete JSON backup
  exportJSONBackup() {
    const backupData = {
      version: '1.2',
      exportDate: new Date().toISOString(),
      settings: this.getSettings(),
      months: this.getMonths(),
      expenses: this.getExpenses(),
      upiExpenses: this.getUpiExpenses(),
      payments: this.getPayments(),
      trash: this.getTrash(),
      deletedIds: this.getDeletedIds()
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
      if (parsed.upiExpenses && Array.isArray(parsed.upiExpenses)) {
        this.saveUpiExpenses(parsed.upiExpenses);
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
      if (parsed.deletedIds && Array.isArray(parsed.deletedIds)) {
        this.saveDeletedIds(parsed.deletedIds);
      }
      this.pushFullSyncToServer();
      return { success: true };
    } catch (e) {
      console.error("Invalid backup file", e);
      return { success: false, error: e.message };
    }
  },

  // Export CSV of current filtered data
  exportExpensesCSV(currentMonth) {
    const expenses = this.getExpenses();
    const settings = this.getSettings();
    const filtered = currentMonth === "ALL" ? expenses : expenses.filter(e => e.month === currentMonth);
    const sorted = [...filtered].sort((a, b) => {
      const dateA = typeof ExpenseCalculator !== 'undefined' ? ExpenseCalculator.parseToISODate(a.date) : a.date;
      const dateB = typeof ExpenseCalculator !== 'undefined' ? ExpenseCalculator.parseToISODate(b.date) : b.date;
      return String(dateA).localeCompare(String(dateB));
    });

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

    const rows = sorted.map(t => {
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
    link.setAttribute("download", `spendwise_card_expenses_${currentMonth.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // Export CSV of UPI Expenses
  exportUpiCSV(currentMonth) {
    const upiList = this.getUpiExpenses();
    const settings = this.getSettings();
    const filtered = currentMonth === "ALL" ? upiList : upiList.filter(u => u.month === currentMonth);
    const sorted = [...filtered].sort((a, b) => {
      const dateA = typeof ExpenseCalculator !== 'undefined' ? ExpenseCalculator.parseToISODate(a.date) : a.date;
      const dateB = typeof ExpenseCalculator !== 'undefined' ? ExpenseCalculator.parseToISODate(b.date) : b.date;
      return String(dateA).localeCompare(String(dateB));
    });

    const headers = [
      "Month",
      "Date",
      "Description",
      "UPI Amount",
      "Used By",
      "Paid By",
      `${settings.person1} Share`,
      `${settings.person2} Share`,
      "Category",
      "Remarks"
    ];

    const rows = filtered.map(u => {
      const shares = ExpenseCalculator.calculateUpiItemShares(u, settings.person1, settings.person2);
      return [
        `"${u.month}"`,
        `"${window.formatDisplayDate ? window.formatDisplayDate(u.date) : u.date}"`,
        `"${(u.description || '').replace(/"/g, '""')}"`,
        u.amount || 0,
        `"${u.usedBy}"`,
        `"${u.paidBy || 'Rashu'}"`,
        shares.person1Share.toFixed(2),
        shares.person2Share.toFixed(2),
        `"${u.category || 'General'}"`,
        `"${(u.remarks || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `spendwise_upi_expenses_${currentMonth.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};

window.StorageManager = StorageManager;
