-- =============================================================
-- NexVelt POS — Phase 2: Receipt Print History
-- =============================================================

CREATE TABLE IF NOT EXISTS receipt_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('kot', 'customer', 'restaurant')),
  receipt_number TEXT NOT NULL,
  printer_name TEXT,
  printer_type TEXT NOT NULL DEFAULT 'browser',
  printed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  printed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  print_duration_ms INTEGER NOT NULL DEFAULT 0,
  print_status TEXT NOT NULL DEFAULT 'success' CHECK (print_status IN ('success', 'failed')),
  is_reprint BOOLEAN NOT NULL DEFAULT false,
  reprint_reason TEXT,
  copies INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_receipt_print_history_order ON receipt_print_history(order_id);
CREATE INDEX IF NOT EXISTS idx_receipt_print_history_restaurant ON receipt_print_history(restaurant_id, printed_at DESC);

ALTER TABLE receipt_print_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select" ON receipt_print_history;
CREATE POLICY "tenant_select" ON receipt_print_history FOR SELECT 
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

DROP POLICY IF EXISTS "tenant_insert" ON receipt_print_history;
CREATE POLICY "tenant_insert" ON receipt_print_history FOR INSERT 
  WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
