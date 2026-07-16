-- Operational table statuses and audit retention for cashier-safe status changes.
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_status_check;
ALTER TABLE tables ADD CONSTRAINT tables_status_check CHECK (status IN ('available','occupied','reserved','cleaning','out_of_service','closed'));
CREATE INDEX IF NOT EXISTS idx_activity_logs_table_status ON activity_logs (restaurant_id, entity_type, entity_id, created_at DESC);
