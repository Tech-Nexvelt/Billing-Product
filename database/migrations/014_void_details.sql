-- =============================================================
-- NexVelt POS — Phase 3: Void Audit columns
-- =============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_approved_by UUID REFERENCES users(id);
