-- =============================================================
-- NexVelt POS — Phase 3: Kitchen Display Timestamps
-- =============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;
