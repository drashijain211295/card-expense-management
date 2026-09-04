-- =============================================================================
-- SPENDWISE SUPABASE DATABASE SCHEMA & INITIAL DATA
-- =============================================================================
-- Copy and paste this entire script into your Supabase SQL Editor and click "Run".

-- 1. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    slip_amount NUMERIC(12, 2) DEFAULT 0,
    statement_amount NUMERIC(12, 2) DEFAULT 0,
    fuel_waiver NUMERIC(12, 2) DEFAULT 0,
    refund_amount NUMERIC(12, 2) DEFAULT 0,
    used_by TEXT NOT NULL DEFAULT 'Both',
    payment_type TEXT NOT NULL DEFAULT 'Card',
    category TEXT DEFAULT 'General',
    remarks TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PAYMENTS & ADVANCE TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    date TEXT NOT NULL,
    person TEXT NOT NULL,
    amount NUMERIC(12, 2) DEFAULT 0,
    purpose TEXT DEFAULT 'Advance Received Beforehand',
    payment_method TEXT DEFAULT 'UPI',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'global_config',
    person1 TEXT DEFAULT 'Kitkat',
    person2 TEXT DEFAULT 'Rashu',
    currency_symbol TEXT DEFAULT '₹',
    statement_day INTEGER DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MONTHS TABLE
CREATE TABLE IF NOT EXISTS public.months (
    name TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) & ALLOW PUBLIC ANON ACCESS
-- =============================================================================
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write/update/delete for personal tracker
DROP POLICY IF EXISTS "Allow public access to expenses" ON public.expenses;
CREATE POLICY "Allow public access to expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to payments" ON public.payments;
CREATE POLICY "Allow public access to payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to settings" ON public.settings;
CREATE POLICY "Allow public access to settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to months" ON public.months;
CREATE POLICY "Allow public access to months" ON public.months FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for all tables safely (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.months;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- =============================================================================
-- INSERT DEFAULT SETTINGS & MONTHS
-- =============================================================================
INSERT INTO public.settings (id, person1, person2, currency_symbol, statement_day)
VALUES ('global_config', 'Kitkat', 'Rashu', '₹', 24)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.months (name)
VALUES ('September 2026'), ('August 2026'), ('July 2026')
ON CONFLICT (name) DO NOTHING;
