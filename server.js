if (!globalThis.crypto) {
  try {
    const { webcrypto } = require('crypto');
    if (webcrypto) globalThis.crypto = webcrypto;
  } catch (e) {}
}

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Global state / MongoDB connection setup
let mongoClient = null;
let db = null;
let isMongoConnected = false;
let mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spendwise';

// Server-Sent Events (SSE) active clients for real-time push
const sseClients = new Set();

function broadcastEvent(eventType, payload) {
  const data = JSON.stringify({ type: eventType, data: payload, timestamp: Date.now() });
  for (const client of sseClients) {
    client.res.write(`data: ${data}\n\n`);
  }
}

// Local JSON File Database helper (Fallback when MongoDB is offline)
function readLocalDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = {
        expenses: [],
        upiExpenses: [],
        payments: [],
        settings: { person1: 'Kitkat', person2: 'Rashu', currencySymbol: '₹', statementDay: 24, paymentDueDay: 13 },
        months: ['September 2026', 'August 2026', 'July 2026'],
        trash: [],
        deletedIds: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local db.json:', err);
    return { expenses: [], upiExpenses: [], payments: [], settings: {}, months: [], trash: [], deletedIds: [] };
  }
}

function writeLocalDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing local db.json:', err);
  }
}

// Try connecting to MongoDB asynchronously
async function connectMongoDB(uri) {
  if (uri) mongoUri = uri;
  try {
    if (mongoClient) {
      await mongoClient.close().catch(() => {});
    }
    mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 3000 });
    await mongoClient.connect();
    db = mongoClient.db();
    isMongoConnected = true;
    console.log(`🍃 Connected to MongoDB successfully at: ${mongoUri}`);
    return { success: true, message: `Connected to MongoDB at ${mongoUri}` };
  } catch (err) {
    isMongoConnected = false;
    db = null;
    console.warn(`⚠️ MongoDB connection failed (${err.message}). Using local JSON file storage (data/db.json).`);
    return { success: false, message: `MongoDB offline (${err.message}). Using local DB fallback.` };
  }
}

// Auto connect to MongoDB on startup
connectMongoDB(mongoUri);

// ==========================================
// REAL-TIME SERVER-SENT EVENTS (SSE) ROUTE
// ==========================================
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const clientId = Date.now() + Math.random().toString(36).slice(2, 7);
  const newClient = { id: clientId, res };
  sseClients.add(newClient);

  res.write(`data: ${JSON.stringify({ type: 'connected', isMongoConnected })}\n\n`);

  req.on('close', () => {
    sseClients.delete(newClient);
  });
});

// Status Endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    isMongoConnected,
    mongoUri: isMongoConnected ? mongoUri : null,
    storageType: isMongoConnected ? 'MongoDB' : 'Local File DB (data/db.json)',
    activeClients: sseClients.size
  });
});

// Configure MongoDB URI endpoint
app.post('/api/config/mongo', async (req, res) => {
  const { uri } = req.body;
  if (!uri) {
    return res.status(400).json({ success: false, message: 'MongoDB URI is required' });
  }
  const result = await connectMongoDB(uri);
  res.json(result);
});

// ==========================================
// DATA API ENDPOINTS
// ==========================================

// Get All Data
app.get('/api/data', async (req, res) => {
  try {
    if (isMongoConnected && db) {
      const expenses = await db.collection('expenses').find({}).toArray();
      const upiExpenses = await db.collection('upi_expenses').find({}).toArray();
      const payments = await db.collection('payments').find({}).toArray();
      const settingsDoc = await db.collection('settings').findOne({ _id: 'global_config' });
      const monthsDocs = await db.collection('months').find({}).toArray();
      const trash = await db.collection('trash').find({}).toArray();
      const deletedDocs = await db.collection('deleted_ids').find({}).toArray();

      res.json({
        expenses: expenses.map(e => { delete e._id; return e; }),
        upiExpenses: upiExpenses.map(u => { delete u._id; return u; }),
        payments: payments.map(p => { delete p._id; return p; }),
        settings: settingsDoc ? settingsDoc.value : null,
        months: monthsDocs.map(m => m.name),
        trash: trash.map(t => { delete t._id; return t; }),
        deletedIds: deletedDocs.map(d => d.id)
      });
    } else {
      const localData = readLocalDb();
      res.json(localData);
    }
  } catch (err) {
    console.error('Error in GET /api/data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Batch Sync Data (Phone / Desktop Push)
app.post('/api/sync', async (req, res) => {
  try {
    const { expenses, upiExpenses, payments, settings, months, trash, deletedIds } = req.body;

    if (isMongoConnected && db) {
      if (expenses && Array.isArray(expenses)) {
        for (const exp of expenses) {
          if (exp.id) await db.collection('expenses').replaceOne({ id: exp.id }, exp, { upsert: true });
        }
      }
      if (upiExpenses && Array.isArray(upiExpenses)) {
        for (const upi of upiExpenses) {
          if (upi.id) await db.collection('upi_expenses').replaceOne({ id: upi.id }, upi, { upsert: true });
        }
      }
      if (payments && Array.isArray(payments)) {
        for (const pay of payments) {
          if (pay.id) await db.collection('payments').replaceOne({ id: pay.id }, pay, { upsert: true });
        }
      }
      if (settings) {
        await db.collection('settings').replaceOne({ _id: 'global_config' }, { _id: 'global_config', value: settings }, { upsert: true });
      }
      if (months && Array.isArray(months)) {
        for (const m of months) {
          await db.collection('months').replaceOne({ name: m }, { name: m }, { upsert: true });
        }
      }
      if (trash && Array.isArray(trash)) {
        for (const t of trash) {
          if (t.trashId) await db.collection('trash').replaceOne({ trashId: t.trashId }, t, { upsert: true });
        }
      }
      if (deletedIds && Array.isArray(deletedIds)) {
        for (const id of deletedIds) {
          await db.collection('deleted_ids').replaceOne({ id }, { id }, { upsert: true });
        }
      }
    } else {
      const localData = readLocalDb();
      if (expenses && Array.isArray(expenses)) localData.expenses = expenses;
      if (upiExpenses && Array.isArray(upiExpenses)) localData.upiExpenses = upiExpenses;
      if (payments && Array.isArray(payments)) localData.payments = payments;
      if (settings) localData.settings = settings;
      if (months && Array.isArray(months)) localData.months = months;
      if (trash && Array.isArray(trash)) localData.trash = trash;
      if (deletedIds && Array.isArray(deletedIds)) localData.deletedIds = Array.from(new Set([...(localData.deletedIds || []), ...deletedIds]));
      writeLocalDb(localData);
    }

    broadcastEvent('sync', { message: 'Data synced across devices' });
    res.json({ success: true, message: 'Data synced successfully' });
  } catch (err) {
    console.error('Error in POST /api/sync:', err);
    res.status(500).json({ error: err.message });
  }
});

// Single Expense Upsert & Delete
app.post('/api/expense', async (req, res) => {
  try {
    const expense = req.body;
    if (!expense || !expense.id) return res.status(400).json({ error: 'Invalid expense object' });

    if (isMongoConnected && db) {
      await db.collection('expenses').replaceOne({ id: expense.id }, expense, { upsert: true });
    } else {
      const local = readLocalDb();
      const idx = local.expenses.findIndex(e => e.id === expense.id);
      if (idx !== -1) local.expenses[idx] = expense;
      else local.expenses.push(expense);
      writeLocalDb(local);
    }

    broadcastEvent('expense_update', expense);
    res.json({ success: true, expense });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expense/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoConnected && db) {
      await db.collection('expenses').deleteOne({ id });
      await db.collection('deleted_ids').replaceOne({ id }, { id }, { upsert: true });
    } else {
      const local = readLocalDb();
      local.expenses = local.expenses.filter(e => e.id !== id);
      if (!local.deletedIds) local.deletedIds = [];
      if (!local.deletedIds.includes(id)) local.deletedIds.push(id);
      writeLocalDb(local);
    }

    broadcastEvent('expense_delete', { id });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single UPI Expense Upsert & Delete
app.post('/api/upi', async (req, res) => {
  try {
    const upi = req.body;
    if (!upi || !upi.id) return res.status(400).json({ error: 'Invalid UPI expense object' });

    if (isMongoConnected && db) {
      await db.collection('upi_expenses').replaceOne({ id: upi.id }, upi, { upsert: true });
    } else {
      const local = readLocalDb();
      const idx = local.upiExpenses.findIndex(u => u.id === upi.id);
      if (idx !== -1) local.upiExpenses[idx] = upi;
      else local.upiExpenses.push(upi);
      writeLocalDb(local);
    }

    broadcastEvent('upi_update', upi);
    res.json({ success: true, upi });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/upi/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoConnected && db) {
      await db.collection('upi_expenses').deleteOne({ id });
      await db.collection('deleted_ids').replaceOne({ id }, { id }, { upsert: true });
    } else {
      const local = readLocalDb();
      local.upiExpenses = local.upiExpenses.filter(u => u.id !== id);
      if (!local.deletedIds) local.deletedIds = [];
      if (!local.deletedIds.includes(id)) local.deletedIds.push(id);
      writeLocalDb(local);
    }

    broadcastEvent('upi_delete', { id });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single Payment Upsert & Delete
app.post('/api/payment', async (req, res) => {
  try {
    const payment = req.body;
    if (!payment || !payment.id) return res.status(400).json({ error: 'Invalid payment object' });

    if (isMongoConnected && db) {
      await db.collection('payments').replaceOne({ id: payment.id }, payment, { upsert: true });
    } else {
      const local = readLocalDb();
      const idx = local.payments.findIndex(p => p.id === payment.id);
      if (idx !== -1) local.payments[idx] = payment;
      else local.payments.push(payment);
      writeLocalDb(local);
    }

    broadcastEvent('payment_update', payment);
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payment/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoConnected && db) {
      await db.collection('payments').deleteOne({ id });
      await db.collection('deleted_ids').replaceOne({ id }, { id }, { upsert: true });
    } else {
      const local = readLocalDb();
      local.payments = local.payments.filter(p => p.id !== id);
      if (!local.deletedIds) local.deletedIds = [];
      if (!local.deletedIds.includes(id)) local.deletedIds.push(id);
      writeLocalDb(local);
    }

    broadcastEvent('payment_delete', { id });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings Update
app.post('/api/settings', async (req, res) => {
  try {
    const settings = req.body;
    if (isMongoConnected && db) {
      await db.collection('settings').replaceOne({ _id: 'global_config' }, { _id: 'global_config', value: settings }, { upsert: true });
    } else {
      const local = readLocalDb();
      local.settings = settings;
      writeLocalDb(local);
    }
    broadcastEvent('settings_update', settings);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trash Operations
app.delete('/api/trash/:trashId', async (req, res) => {
  try {
    const trashId = req.params.trashId;
    if (isMongoConnected && db) {
      // Find item before removing from trash to record deletedId
      const trashItem = await db.collection('trash').findOne({ trashId });
      if (trashItem && trashItem.item && trashItem.item.id) {
        await db.collection('deleted_ids').replaceOne({ id: trashItem.item.id }, { id: trashItem.item.id }, { upsert: true });
        // Delete from main collections as well to be 100% sure
        if (trashItem.type === 'Card') await db.collection('expenses').deleteOne({ id: trashItem.item.id });
        if (trashItem.type === 'UPI') await db.collection('upi_expenses').deleteOne({ id: trashItem.item.id });
        if (trashItem.type === 'Payment') await db.collection('payments').deleteOne({ id: trashItem.item.id });
      }
      await db.collection('trash').deleteOne({ trashId });
    } else {
      const local = readLocalDb();
      const trashItem = (local.trash || []).find(t => t.trashId === trashId);
      if (trashItem && trashItem.item && trashItem.item.id) {
        if (!local.deletedIds) local.deletedIds = [];
        if (!local.deletedIds.includes(trashItem.item.id)) local.deletedIds.push(trashItem.item.id);
        if (trashItem.type === 'Card') local.expenses = local.expenses.filter(e => e.id !== trashItem.item.id);
        if (trashItem.type === 'UPI') local.upiExpenses = local.upiExpenses.filter(u => u.id !== trashItem.item.id);
        if (trashItem.type === 'Payment') local.payments = local.payments.filter(p => p.id !== trashItem.item.id);
      }
      local.trash = (local.trash || []).filter(t => t.trashId !== trashId);
      writeLocalDb(local);
    }
    broadcastEvent('trash_update', { trashId });
    res.json({ success: true, trashId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trash/empty', async (req, res) => {
  try {
    if (isMongoConnected && db) {
      const allTrash = await db.collection('trash').find({}).toArray();
      for (const t of allTrash) {
        if (t.item && t.item.id) {
          await db.collection('deleted_ids').replaceOne({ id: t.item.id }, { id: t.item.id }, { upsert: true });
          if (t.type === 'Card') await db.collection('expenses').deleteOne({ id: t.item.id });
          if (t.type === 'UPI') await db.collection('upi_expenses').deleteOne({ id: t.item.id });
          if (t.type === 'Payment') await db.collection('payments').deleteOne({ id: t.item.id });
        }
      }
      await db.collection('trash').deleteMany({});
    } else {
      const local = readLocalDb();
      if (!local.deletedIds) local.deletedIds = [];
      (local.trash || []).forEach(t => {
        if (t.item && t.item.id && !local.deletedIds.includes(t.item.id)) {
          local.deletedIds.push(t.item.id);
        }
        if (t.type === 'Card') local.expenses = local.expenses.filter(e => e.id !== t.item.id);
        if (t.type === 'UPI') local.upiExpenses = local.upiExpenses.filter(u => u.id !== t.item.id);
        if (t.type === 'Payment') local.payments = local.payments.filter(p => p.id !== t.item.id);
      });
      local.trash = [];
      writeLocalDb(local);
    }
    broadcastEvent('trash_empty', {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// STATIC FILE SERVING
// ==========================================
app.use(express.static(__dirname));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  next();
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 SpendWise Multi-Device Server running at http://localhost:${PORT}`);
});
