/**
 * SpendWise Supabase Cloud Data Client
 * Enables real-time synchronization between Localhost and Vercel Live Deployment
 */

const SupabaseService = {
  client: null,
  isConnected: false,
  realtimeChannel: null,

  // Automatically sanitize and format Supabase URLs (including dashboard URLs)
  cleanUrl(url) {
    if (!url) return '';
    let cleaned = url.trim();
    // If user pasted dashboard URL: https://supabase.com/dashboard/project/<project-ref>
    const dashMatch = cleaned.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/i);
    if (dashMatch) {
      cleaned = `https://${dashMatch[1]}.supabase.co`;
    }
    // Remove trailing slashes and common subpaths
    cleaned = cleaned.replace(/\/+$/, '');
    cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
    cleaned = cleaned.replace(/\/settings\/api\/?$/i, '');
    if (!/^https?:\/\//i.test(cleaned)) {
      cleaned = 'https://' + cleaned;
    }
    return cleaned;
  },

  // Get current credentials (from config.js or localStorage)
  getCredentials() {
    const localUrl = localStorage.getItem('spendwise_supabase_url');
    const localKey = localStorage.getItem('spendwise_supabase_key');
    const configUrl = window.SUPABASE_CONFIG?.url;
    const configKey = window.SUPABASE_CONFIG?.anonKey;

    const rawUrl = localUrl || configUrl || '';
    const rawKey = localKey || configKey || '';

    return {
      url: this.cleanUrl(rawUrl),
      key: rawKey.trim()
    };
  },

  // Save credentials to localStorage
  saveCredentials(url, key) {
    const cleanedUrl = this.cleanUrl(url);
    if (cleanedUrl) localStorage.setItem('spendwise_supabase_url', cleanedUrl);
    else localStorage.removeItem('spendwise_supabase_url');

    if (key) localStorage.setItem('spendwise_supabase_key', key.trim());
    else localStorage.removeItem('spendwise_supabase_key');
  },

  // Initialize Supabase Client
  init() {
    const { url, key } = this.getCredentials();
    if (!url || !key || typeof window.supabase === 'undefined') {
      this.client = null;
      this.isConnected = false;
      return false;
    }

    try {
      this.client = window.supabase.createClient(url, key, {
        auth: { persistSession: false }
      });
      this.isConnected = true;
      console.log('⚡ Supabase Cloud Client Initialized successfully for', url);
      return true;
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      this.client = null;
      this.isConnected = false;
      return false;
    }
  },

  // Test connection to Supabase
  async testConnection(url, key) {
    const cleanedUrl = this.cleanUrl(url);
    const cleanedKey = (key || '').trim();

    if (!cleanedUrl || !cleanedKey) {
      return { success: false, message: 'Both Project URL and Anon Key are required.' };
    }
    if (typeof window.supabase === 'undefined') {
      return { success: false, message: 'Supabase JS library not loaded. Check internet connection.' };
    }

    try {
      const testClient = window.supabase.createClient(cleanedUrl, cleanedKey, {
        auth: { persistSession: false }
      });
      const { data, error } = await testClient.from('settings').select('*').limit(1);
      if (error) {
        return { success: false, message: `Database error: ${error.message}` };
      }
      return { success: true, message: 'Connected successfully to Supabase!' };
    } catch (e) {
      return { success: false, message: e.message || 'Connection failed' };
    }
  },

  // Model mappers: JS camelCase <-> Supabase snake_case
  mapExpenseToCloud(exp) {
    return {
      id: exp.id,
      month: exp.month,
      date: exp.date,
      description: exp.description || '',
      slip_amount: parseFloat(exp.slipAmount) || 0,
      statement_amount: parseFloat(exp.statementAmount) || 0,
      fuel_waiver: parseFloat(exp.fuelWaiver) || 0,
      refund_amount: parseFloat(exp.refundAmount) || 0,
      used_by: exp.usedBy || 'Both',
      payment_type: exp.paymentType || 'Card',
      category: exp.category || 'General',
      remarks: exp.remarks || '',
      updated_at: new Date().toISOString()
    };
  },

  mapExpenseFromCloud(row) {
    return {
      id: row.id,
      month: row.month,
      date: row.date,
      description: row.description || '',
      slipAmount: parseFloat(row.slip_amount) || 0,
      statementAmount: parseFloat(row.statement_amount) || 0,
      fuelWaiver: parseFloat(row.fuel_waiver) || 0,
      refundAmount: parseFloat(row.refund_amount) || 0,
      usedBy: row.used_by || 'Both',
      paymentType: row.payment_type || 'Card',
      category: row.category || 'General',
      remarks: row.remarks || ''
    };
  },

  mapPaymentToCloud(pay) {
    return {
      id: pay.id,
      month: pay.month,
      date: pay.date,
      person: pay.person,
      amount: parseFloat(pay.amount) || 0,
      purpose: pay.purpose || 'Advance Received Beforehand',
      payment_method: pay.paymentMethod || 'UPI',
      notes: pay.notes || ''
    };
  },

  mapPaymentFromCloud(row) {
    return {
      id: row.id,
      month: row.month,
      date: row.date,
      person: row.person,
      amount: parseFloat(row.amount) || 0,
      purpose: row.purpose || 'Advance Received Beforehand',
      paymentMethod: row.payment_method || 'UPI',
      notes: row.notes || ''
    };
  },

  // ==========================================
  // EXPENSES CRUD
  // ==========================================
  async fetchExpenses() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from('expenses').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(r => this.mapExpenseFromCloud(r));
    } catch (e) {
      console.error('Supabase fetchExpenses error:', e);
      return null;
    }
  },

  async upsertExpense(exp) {
    if (!this.isConnected || !this.client) return false;
    try {
      const payload = this.mapExpenseToCloud(exp);
      const { error } = await this.client.from('expenses').upsert(payload);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Supabase upsertExpense error:', e);
      return false;
    }
  },

  async deleteExpense(id) {
    if (!this.isConnected || !this.client) return false;
    try {
      const { error } = await this.client.from('expenses').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Supabase deleteExpense error:', e);
      return false;
    }
  },

  // ==========================================
  // PAYMENTS CRUD
  // ==========================================
  async fetchPayments() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from('payments').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(r => this.mapPaymentFromCloud(r));
    } catch (e) {
      console.error('Supabase fetchPayments error:', e);
      return null;
    }
  },

  async upsertPayment(pay) {
    if (!this.isConnected || !this.client) return false;
    try {
      const payload = this.mapPaymentToCloud(pay);
      const { error } = await this.client.from('payments').upsert(payload);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Supabase upsertPayment error:', e);
      return false;
    }
  },

  async deletePayment(id) {
    if (!this.isConnected || !this.client) return false;
    try {
      const { error } = await this.client.from('payments').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Supabase deletePayment error:', e);
      return false;
    }
  },

  // ==========================================
  // SETTINGS & MONTHS
  // ==========================================
  async fetchSettings() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from('settings').select('*').eq('id', 'global_config').maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        person1: data.person1 || 'Kitkat',
        person2: data.person2 || 'Rashu',
        currencySymbol: data.currency_symbol || '₹',
        statementDay: data.statement_day || 24
      };
    } catch (e) {
      console.error('Supabase fetchSettings error:', e);
      return null;
    }
  },

  async saveSettings(settings) {
    if (!this.isConnected || !this.client) return false;
    try {
      const { error } = await this.client.from('settings').upsert({
        id: 'global_config',
        person1: settings.person1,
        person2: settings.person2,
        currency_symbol: settings.currencySymbol,
        statement_day: parseInt(settings.statementDay, 10) || 24,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Supabase saveSettings error:', e);
      return false;
    }
  },

  async fetchMonths() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client.from('months').select('name').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(m => m.name);
    } catch (e) {
      console.error('Supabase fetchMonths error:', e);
      return null;
    }
  },

  async insertMonth(monthName) {
    if (!this.isConnected || !this.client) return false;
    try {
      const { error } = await this.client.from('months').upsert({ name: monthName });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Supabase insertMonth error:', e);
      return false;
    }
  },

  // ==========================================
  // ONE-CLICK SYNC: UPLOAD LOCAL DATA TO CLOUD
  // ==========================================
  async syncLocalToCloud(localExpenses, localPayments, localMonths, localSettings) {
    if (!this.isConnected || !this.client) {
      return { success: false, message: 'Not connected to Supabase' };
    }

    try {
      // 1. Sync Settings
      if (localSettings) {
        await this.saveSettings(localSettings);
      }

      // 2. Sync Months
      if (localMonths && localMonths.length > 0) {
        for (const m of localMonths) {
          await this.client.from('months').upsert({ name: m });
        }
      }

      // 3. Batch Upsert Expenses
      if (localExpenses && localExpenses.length > 0) {
        const cloudExpenses = localExpenses.map(e => this.mapExpenseToCloud(e));
        // Upsert in chunks of 50
        for (let i = 0; i < cloudExpenses.length; i += 50) {
          const chunk = cloudExpenses.slice(i, i + 50);
          const { error } = await this.client.from('expenses').upsert(chunk);
          if (error) throw error;
        }
      }

      // 4. Batch Upsert Payments
      if (localPayments && localPayments.length > 0) {
        const cloudPayments = localPayments.map(p => this.mapPaymentToCloud(p));
        const { error } = await this.client.from('payments').upsert(cloudPayments);
        if (error) throw error;
      }

      return {
        success: true,
        message: `Synced ${localExpenses.length} expenses and ${localPayments.length} payments to Supabase Cloud!`
      };
    } catch (e) {
      console.error('Sync to cloud error:', e);
      return { success: false, message: `Sync failed: ${e.message}` };
    }
  },

  // ==========================================
  // REAL-TIME SUBSCRIPTION
  // ==========================================
  subscribeToRealtime(onChangeCallback) {
    if (!this.isConnected || !this.client || typeof onChangeCallback !== 'function') return;

    try {
      if (this.realtimeChannel) {
        this.client.removeChannel(this.realtimeChannel);
      }

      this.realtimeChannel = this.client
        .channel('spendwise_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
          console.log('⚡ Realtime Expense Change:', payload);
          onChangeCallback('expenses', payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, (payload) => {
          console.log('⚡ Realtime Payment Change:', payload);
          onChangeCallback('payments', payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
          console.log('⚡ Realtime Settings Change:', payload);
          onChangeCallback('settings', payload);
        })
        .subscribe((status) => {
          console.log('⚡ Supabase Realtime Subscription Status:', status);
        });
    } catch (e) {
      console.warn('Realtime subscription warning:', e);
    }
  }
};

window.SupabaseService = SupabaseService;
