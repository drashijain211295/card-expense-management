const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

if (!globalThis.crypto) {
  try {
    const { webcrypto } = require('crypto');
    if (webcrypto) globalThis.crypto = webcrypto;
  } catch (e) {}
}

const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { INITIAL_EXPENSES, INITIAL_UPI_EXPENSES, INITIAL_PAYMENTS, DEFAULT_SETTINGS, AVAILABLE_MONTHS } = require('../js/data.js');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://drashijain211295_db_user:TAlFcYkMi67Wun8A@cluster0.fbeiqmc.mongodb.net/spendwise?retryWrites=true&w=majority&appName=Cluster0';

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb && cachedClient) {
    return cachedDb;
  }
  try {
    cachedClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await cachedClient.connect();
    cachedDb = cachedClient.db();
    return cachedDb;
  } catch (err) {
    console.error('MongoDB Atlas Connection Error in Serverless Function:', err);
    throw err;
  }
}

// Status Endpoint
app.get('/api/status', async (req, res) => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    res.json({
      status: 'ok',
      isMongoConnected: true,
      storageType: 'MongoDB Atlas Cloud (Vercel Serverless)',
      environment: 'Vercel'
    });
  } catch (err) {
    res.json({
      status: 'error',
      isMongoConnected: false,
      error: err.message
    });
  }
});

// Get All Data with Fail-Safe Auto-Seed & Fallback
app.get('/api/data', async (req, res) => {
  try {
    const db = await getDb();
    let expenses = await db.collection('expenses').find({}).toArray();
    let upiExpenses = await db.collection('upi_expenses').find({}).toArray();
    let payments = await db.collection('payments').find({}).toArray();
    let settingsDoc = await db.collection('settings').findOne({ _id: 'global_config' });
    let monthsDocs = await db.collection('months').find({}).toArray();
    const trash = await db.collection('trash').find({}).toArray();
    const deletedDocs = await db.collection('deleted_ids').find({}).toArray();

    // Auto-seed if database is brand new / empty
    if (!expenses || expenses.length === 0) {
      console.log('🌱 Auto-seeding MongoDB Atlas Cloud with initial baseline dataset...');
      for (const exp of INITIAL_EXPENSES) {
        await db.collection('expenses').replaceOne({ id: exp.id }, exp, { upsert: true });
      }
      for (const upi of INITIAL_UPI_EXPENSES) {
        await db.collection('upi_expenses').replaceOne({ id: upi.id }, upi, { upsert: true });
      }
      for (const pay of INITIAL_PAYMENTS) {
        await db.collection('payments').replaceOne({ id: pay.id }, pay, { upsert: true });
      }
      await db.collection('settings').replaceOne({ _id: 'global_config' }, { _id: 'global_config', value: DEFAULT_SETTINGS }, { upsert: true });
      for (const m of AVAILABLE_MONTHS) {
        await db.collection('months').replaceOne({ name: m }, { name: m }, { upsert: true });
      }
      expenses = INITIAL_EXPENSES;
      upiExpenses = INITIAL_UPI_EXPENSES;
      payments = INITIAL_PAYMENTS;
      settingsDoc = { value: DEFAULT_SETTINGS };
      monthsDocs = AVAILABLE_MONTHS.map(m => ({ name: m }));
    }

    res.json({
      expenses: expenses.map(e => { delete e._id; return e; }),
      upiExpenses: upiExpenses.map(u => { delete u._id; return u; }),
      payments: payments.map(p => { delete p._id; return p; }),
      settings: settingsDoc ? settingsDoc.value : DEFAULT_SETTINGS,
      months: monthsDocs.length > 0 ? monthsDocs.map(m => m.name) : AVAILABLE_MONTHS,
      trash: trash.map(t => { delete t._id; return t; }),
      deletedIds: deletedDocs.map(d => d.id)
    });
  } catch (err) {
    console.error('Error in GET /api/data (Returning Fail-Safe Baseline):', err.message);
    res.json({
      expenses: INITIAL_EXPENSES,
      upiExpenses: INITIAL_UPI_EXPENSES,
      payments: INITIAL_PAYMENTS,
      settings: DEFAULT_SETTINGS,
      months: AVAILABLE_MONTHS,
      trash: [],
      deletedIds: []
    });
  }
});

// Batch Sync Data
app.post('/api/sync', async (req, res) => {
  try {
    const db = await getDb();
    const { expenses, upiExpenses, payments, settings, months, trash, deletedIds } = req.body;

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

    res.json({ success: true, message: 'Data synced successfully to MongoDB Atlas Cloud' });
  } catch (err) {
    console.error('Error in POST /api/sync:', err);
    res.status(500).json({ error: err.message });
  }
});

// Single Expense Upsert & Delete
app.post('/api/expense', async (req, res) => {
  try {
    const db = await getDb();
    const expense = req.body;
    if (!expense || !expense.id) return res.status(400).json({ error: 'Invalid expense object' });

    await db.collection('expenses').replaceOne({ id: expense.id }, expense, { upsert: true });
    res.json({ success: true, expense });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expense/:id', async (req, res) => {
  try {
    const db = await getDb();
    const id = req.params.id;
    await db.collection('expenses').deleteOne({ id });
    await db.collection('deleted_ids').replaceOne({ id }, { id }, { upsert: true });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single UPI Expense Upsert & Delete
app.post('/api/upi', async (req, res) => {
  try {
    const db = await getDb();
    const upi = req.body;
    if (!upi || !upi.id) return res.status(400).json({ error: 'Invalid UPI expense object' });

    await db.collection('upi_expenses').replaceOne({ id: upi.id }, upi, { upsert: true });
    res.json({ success: true, upi });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/upi/:id', async (req, res) => {
  try {
    const db = await getDb();
    const id = req.params.id;
    await db.collection('upi_expenses').deleteOne({ id });
    await db.collection('deleted_ids').replaceOne({ id }, { id }, { upsert: true });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single Payment Upsert & Delete
app.post('/api/payment', async (req, res) => {
  try {
    const db = await getDb();
    const payment = req.body;
    if (!payment || !payment.id) return res.status(400).json({ error: 'Invalid payment object' });

    await db.collection('payments').replaceOne({ id: payment.id }, payment, { upsert: true });
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payment/:id', async (req, res) => {
  try {
    const db = await getDb();
    const id = req.params.id;
    await db.collection('payments').deleteOne({ id });
    await db.collection('deleted_ids').replaceOne({ id }, { id }, { upsert: true });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings Update
app.post('/api/settings', async (req, res) => {
  try {
    const db = await getDb();
    const settings = req.body;
    await db.collection('settings').replaceOne({ _id: 'global_config' }, { _id: 'global_config', value: settings }, { upsert: true });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trash Operations
app.delete('/api/trash/:trashId', async (req, res) => {
  try {
    const db = await getDb();
    const trashId = req.params.trashId;
    const trashItem = await db.collection('trash').findOne({ trashId });
    if (trashItem && trashItem.item && trashItem.item.id) {
      await db.collection('deleted_ids').replaceOne({ id: trashItem.item.id }, { id: trashItem.item.id }, { upsert: true });
      if (trashItem.type === 'Card') await db.collection('expenses').deleteOne({ id: trashItem.item.id });
      if (trashItem.type === 'UPI') await db.collection('upi_expenses').deleteOne({ id: trashItem.item.id });
      if (trashItem.type === 'Payment') await db.collection('payments').deleteOne({ id: trashItem.item.id });
    }
    await db.collection('trash').deleteOne({ trashId });
    res.json({ success: true, trashId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trash/empty', async (req, res) => {
  try {
    const db = await getDb();
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
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
