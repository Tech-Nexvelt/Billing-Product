-- =============================================================
-- NexVelt POS — Phase 2 Schema Migration
-- Run after: 001_initial_schema.sql, 002_seed_data.sql
-- =============================================================

-- ============================================================
-- 1. TAX PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  tax_type TEXT NOT NULL DEFAULT 'cgst_sgst' CHECK (tax_type IN ('cgst_sgst', 'igst', 'custom', 'none')),
  cgst NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (cgst >= 0 AND cgst <= 100),
  sgst NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (sgst >= 0 AND sgst <= 100),
  igst NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (igst >= 0 AND igst <= 100),
  custom_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (custom_rate >= 0 AND custom_rate <= 100),
  is_inclusive BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one default per restaurant
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_profiles_default_unique
  ON tax_profiles(restaurant_id)
  WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tax_profiles_restaurant
  ON tax_profiles(restaurant_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_tax_profiles_updated_at
  BEFORE UPDATE ON tax_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. PAYMENT METHODS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  display_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT 'credit-card',
  is_active BOOLEAN NOT NULL DEFAULT true,
  supports_partial BOOLEAN NOT NULL DEFAULT true,
  supports_split BOOLEAN NOT NULL DEFAULT true,
  supports_refund BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_methods_name UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_restaurant
  ON payment_methods(restaurant_id, display_order)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. FEATURE FLAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL CHECK (feature_key ~ '^[a-z0-9_]+$'),
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_feature_flags_key UNIQUE (restaurant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_restaurant
  ON feature_flags(restaurant_id);

CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. PRINTERS (extended)
-- ============================================================
CREATE TABLE IF NOT EXISTS printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  connection_type TEXT NOT NULL DEFAULT 'browser' CHECK (connection_type IN ('usb', 'bluetooth', 'network', 'browser')),
  ip_address TEXT CHECK (ip_address IS NULL OR ip_address ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'),
  port INTEGER CHECK (port IS NULL OR (port > 0 AND port < 65536)),
  paper_size TEXT NOT NULL DEFAULT '80mm' CHECK (paper_size IN ('58mm', '80mm')),
  dpi INTEGER NOT NULL DEFAULT 203 CHECK (dpi IN (203, 300, 600)),
  characters_per_line INTEGER NOT NULL DEFAULT 42 CHECK (characters_per_line > 0 AND characters_per_line <= 80),
  auto_cut BOOLEAN NOT NULL DEFAULT true,
  cash_drawer BOOLEAN NOT NULL DEFAULT false,
  copies INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 1 AND copies <= 5),
  encoding TEXT NOT NULL DEFAULT 'UTF-8',
  default_template TEXT NOT NULL DEFAULT 'customer' CHECK (default_template IN ('kitchen', 'customer', 'restaurant')),
  printer_status TEXT NOT NULL DEFAULT 'online' CHECK (printer_status IN ('online', 'offline', 'error', 'unknown')),
  is_default_billing BOOLEAN NOT NULL DEFAULT false,
  is_default_kitchen BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_printers_name UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_printers_restaurant
  ON printers(restaurant_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_printers_updated_at
  BEFORE UPDATE ON printers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. PRINTER JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS printer_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('kot', 'customer_receipt', 'restaurant_receipt', 'test')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printing', 'completed', 'failed', 'cancelled')),
  copies INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 1 AND copies <= 5),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  error TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_printer_jobs_printer
  ON printer_jobs(printer_id, status);
CREATE INDEX IF NOT EXISTS idx_printer_jobs_restaurant
  ON printer_jobs(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_printer_jobs_order
  ON printer_jobs(order_id);

CREATE TRIGGER trg_printer_jobs_updated_at
  BEFORE UPDATE ON printer_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. CUSTOMERS (extended)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  phone TEXT CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{7,15}$'),
  email TEXT CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  gst_number TEXT CHECK (gst_number IS NULL OR gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
  address TEXT,
  notes TEXT,
  dob DATE,
  anniversary DATE,
  food_preferences TEXT,
  allergies TEXT,
  customer_type TEXT NOT NULL DEFAULT 'regular' CHECK (customer_type IN ('vip', 'regular', 'corporate', 'blocked')),
  tags TEXT[] DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_customers_phone UNIQUE (restaurant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_restaurant
  ON customers(restaurant_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON customers(restaurant_id, phone)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_type
  ON customers(restaurant_id, customer_type)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name_fts
  ON customers USING gin(to_tsvector('english', name));

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. RECEIPT CUSTOMIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS receipt_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  show_logo BOOLEAN NOT NULL DEFAULT true,
  header_text TEXT,
  footer_text TEXT,
  thank_you_message TEXT NOT NULL DEFAULT 'Thank you for dining with us!',
  terms_and_conditions TEXT,
  receipt_width TEXT NOT NULL DEFAULT '80mm' CHECK (receipt_width IN ('58mm', '80mm')),
  margin_top INTEGER NOT NULL DEFAULT 4 CHECK (margin_top >= 0 AND margin_top <= 50),
  margin_bottom INTEGER NOT NULL DEFAULT 4 CHECK (margin_bottom >= 0 AND margin_bottom <= 50),
  margin_left INTEGER NOT NULL DEFAULT 4 CHECK (margin_left >= 0 AND margin_left <= 20),
  margin_right INTEGER NOT NULL DEFAULT 4 CHECK (margin_right >= 0 AND margin_right <= 20),
  font_size TEXT NOT NULL DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  show_qr_code BOOLEAN NOT NULL DEFAULT false,
  show_order_number BOOLEAN NOT NULL DEFAULT true,
  show_table_number BOOLEAN NOT NULL DEFAULT true,
  show_cashier_name BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_receipt_customizations_updated_at
  BEFORE UPDATE ON receipt_customizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 8. RECEIPT NUMBER RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS receipt_number_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('bill', 'invoice', 'kot')),
  prefix TEXT NOT NULL DEFAULT 'BILL' CHECK (prefix ~ '^[A-Z0-9-]+$'),
  starting_number INTEGER NOT NULL DEFAULT 1 CHECK (starting_number >= 1),
  current_number INTEGER NOT NULL DEFAULT 0 CHECK (current_number >= 0),
  reset_frequency TEXT NOT NULL DEFAULT 'never' CHECK (reset_frequency IN ('daily', 'monthly', 'yearly', 'never')),
  last_reset_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_receipt_number_rules UNIQUE (restaurant_id, rule_type)
);

CREATE TRIGGER trg_receipt_number_rules_updated_at
  BEFORE UPDATE ON receipt_number_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 9. KOTS (Kitchen Order Tickets index)
-- ============================================================
CREATE TABLE IF NOT EXISTS kots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token_number INTEGER NOT NULL,
  items_printed JSONB NOT NULL DEFAULT '[]',
  is_reprint BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_kots_token UNIQUE (restaurant_id, order_id, token_number)
);

CREATE INDEX IF NOT EXISTS idx_kots_order
  ON kots(order_id);
CREATE INDEX IF NOT EXISTS idx_kots_restaurant
  ON kots(restaurant_id, created_at DESC);

-- ============================================================
-- 10. INVENTORY EVENTS (Phase 3 Preparation — No Deductions)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  event_type TEXT NOT NULL DEFAULT 'order_sale' CHECK (event_type IN ('order_sale', 'order_void', 'order_refund')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_events_restaurant
  ON inventory_events(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_events_order
  ON inventory_events(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_events_item
  ON inventory_events(menu_item_id);

-- ============================================================
-- 11. DISCOUNT ROLE LIMITS
-- ============================================================
CREATE TABLE IF NOT EXISTS discount_role_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  max_discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00
    CHECK (max_discount_percentage >= 0 AND max_discount_percentage <= 100),
  requires_approval_above NUMERIC(5,2) NOT NULL DEFAULT 0.00
    CHECK (requires_approval_above >= 0 AND requires_approval_above <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_discount_role_limits UNIQUE (restaurant_id, role_id)
);

CREATE TRIGGER trg_discount_role_limits_updated_at
  BEFORE UPDATE ON discount_role_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 12. PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  payment_method_name TEXT NOT NULL, -- snapshot
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'pending', 'failed', 'refunded', 'partially_refunded')),
  transaction_reference TEXT,
  refund_amount NUMERIC(12,2) CHECK (refund_amount IS NULL OR refund_amount >= 0),
  refund_method TEXT,
  refund_status TEXT CHECK (refund_status IS NULL OR refund_status IN ('pending', 'completed', 'failed')),
  refund_reason TEXT,
  refund_notes TEXT,
  refunded_at TIMESTAMPTZ,
  refunded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  refund_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order
  ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_restaurant
  ON payments(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments(restaurant_id, status);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 13. ALTER EXISTING TABLES
-- ============================================================

-- 13a. orders: Add Phase 2 columns
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bill_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IS NULL OR discount_type IN ('flat', 'percentage', 'item')),
  ADD COLUMN IF NOT EXISTS discount_rate NUMERIC(10,2) CHECK (discount_rate IS NULL OR (discount_rate >= 0 AND discount_rate <= 100)),
  ADD COLUMN IF NOT EXISTS discount_reason TEXT,
  ADD COLUMN IF NOT EXISTS discount_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS void_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- 13b. menu_items: Add tax_profile_id
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS tax_profile_id UUID REFERENCES tax_profiles(id) ON DELETE SET NULL;

-- 13c. categories: Add tax_profile_id
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS tax_profile_id UUID REFERENCES tax_profiles(id) ON DELETE SET NULL;

-- 13d. Add index for orders.payment_status
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders(restaurant_id, payment_status)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 14. RECEIPT NEXT NUMBER FUNCTION (thread-safe)
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_receipt_number(
  p_restaurant_id UUID,
  p_rule_type TEXT
) RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
  v_reset_freq TEXT;
  v_last_reset DATE;
  v_result TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('receipt_number_' || p_restaurant_id::text || p_rule_type));

  SELECT prefix, current_number, reset_frequency, last_reset_date
    INTO v_prefix, v_number, v_reset_freq, v_last_reset
    FROM receipt_number_rules
    WHERE restaurant_id = p_restaurant_id AND rule_type = p_rule_type;

  IF NOT FOUND THEN
    -- Auto-create default rule
    INSERT INTO receipt_number_rules(restaurant_id, rule_type, prefix, starting_number, current_number)
    VALUES (p_restaurant_id, p_rule_type,
      CASE p_rule_type WHEN 'bill' THEN 'BILL' WHEN 'invoice' THEN 'INV' ELSE 'KOT' END,
      1, 0)
    ON CONFLICT DO NOTHING;

    SELECT prefix, current_number, reset_frequency, last_reset_date
      INTO v_prefix, v_number, v_reset_freq, v_last_reset
      FROM receipt_number_rules
      WHERE restaurant_id = p_restaurant_id AND rule_type = p_rule_type;
  END IF;

  -- Check if reset needed
  IF (v_reset_freq = 'daily' AND (v_last_reset IS NULL OR v_last_reset < current_date)) OR
     (v_reset_freq = 'monthly' AND (v_last_reset IS NULL OR date_trunc('month', v_last_reset) < date_trunc('month', current_date))) OR
     (v_reset_freq = 'yearly' AND (v_last_reset IS NULL OR date_trunc('year', v_last_reset) < date_trunc('year', current_date))) THEN
    UPDATE receipt_number_rules
      SET current_number = (SELECT starting_number FROM receipt_number_rules WHERE restaurant_id = p_restaurant_id AND rule_type = p_rule_type) - 1,
          last_reset_date = current_date
      WHERE restaurant_id = p_restaurant_id AND rule_type = p_rule_type;
    SELECT current_number INTO v_number FROM receipt_number_rules WHERE restaurant_id = p_restaurant_id AND rule_type = p_rule_type;
  END IF;

  v_number := v_number + 1;

  UPDATE receipt_number_rules
    SET current_number = v_number
    WHERE restaurant_id = p_restaurant_id AND rule_type = p_rule_type;

  v_result := v_prefix || '-' || to_char(now(), 'YYYY') || '-' || LPAD(v_number::TEXT, 6, '0');
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 15. FUNCTION: Create inventory events on order complete
-- ============================================================
CREATE OR REPLACE FUNCTION create_inventory_events_on_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO inventory_events(restaurant_id, order_id, order_item_id, menu_item_id, quantity, event_type)
    SELECT
      oi.restaurant_id,
      oi.order_id,
      oi.id,
      oi.menu_item_id,
      oi.quantity,
      'order_sale'
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.menu_item_id IS NOT NULL
      AND oi.deleted_at IS NULL;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    INSERT INTO inventory_events(restaurant_id, order_id, order_item_id, menu_item_id, quantity, event_type)
    SELECT
      oi.restaurant_id,
      oi.order_id,
      oi.id,
      oi.menu_item_id,
      oi.quantity,
      'order_void'
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.menu_item_id IS NOT NULL
      AND oi.deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_inventory_events
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION create_inventory_events_on_complete();

-- ============================================================
-- 16. RLS POLICIES — All new tables
-- ============================================================

ALTER TABLE tax_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_profiles_restaurant_isolation ON tax_profiles
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_methods_restaurant_isolation ON payment_methods
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY feature_flags_restaurant_isolation ON feature_flags
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
CREATE POLICY printers_restaurant_isolation ON printers
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE printer_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY printer_jobs_restaurant_isolation ON printer_jobs
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_restaurant_isolation ON customers
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE receipt_customizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipt_customizations_restaurant_isolation ON receipt_customizations
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE receipt_number_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipt_number_rules_restaurant_isolation ON receipt_number_rules
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE kots ENABLE ROW LEVEL SECURITY;
CREATE POLICY kots_restaurant_isolation ON kots
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE inventory_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_events_restaurant_isolation ON inventory_events
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE discount_role_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY discount_role_limits_restaurant_isolation ON discount_role_limits
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_restaurant_isolation ON payments
  USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
