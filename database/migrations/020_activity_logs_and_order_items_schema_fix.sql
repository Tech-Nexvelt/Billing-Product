-- Migration 020: Schema Alignment for activity_logs and order_items
-- Fixes PGRST204 errors when deleting/updating order items and logging activity events

-- 1. Ensure order_items has deleted_by column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'order_items' 
          AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Ensure activity_logs supports both resource_type/resource_id AND entity_type/entity_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'activity_logs' 
          AND column_name = 'entity_type'
    ) THEN
        ALTER TABLE public.activity_logs ADD COLUMN entity_type TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'activity_logs' 
          AND column_name = 'entity_id'
    ) THEN
        ALTER TABLE public.activity_logs ADD COLUMN entity_id UUID;
    END IF;
END $$;

-- 3. Create index for fast activity log lookups on entity_type and entity_id
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_lookup 
ON public.activity_logs (restaurant_id, entity_type, entity_id, created_at DESC);
