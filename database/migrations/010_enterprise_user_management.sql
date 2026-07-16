-- ============================================================
-- Enterprise User Management Migration (Phase 2 Hardening)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create permissions_registry & role_permissions_registry tables
CREATE TABLE IF NOT EXISTS public.permissions_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_deprecated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions_registry (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions_registry(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- Seed permissions registry
INSERT INTO public.permissions_registry (permission_key, module, description, is_system) VALUES
  ('users.read', 'roles', 'Can view list of staff users', true),
  ('users.create', 'roles', 'Can register new staff users', true),
  ('users.update', 'roles', 'Can modify staff users profiles', true),
  ('users.archive', 'roles', 'Can archive/soft-delete staff users', true),
  ('users.restore', 'roles', 'Can restore archived staff users', true),
  ('users.export', 'roles', 'Can export staff users config', true),
  ('users.import', 'roles', 'Can bulk import staff users config', true),
  ('menu.read', 'menu', 'Can view menu categories and items', true),
  ('menu.update', 'menu', 'Can edit menu categories and items', true),
  ('menu.images', 'menu', 'Can upload and manage menu item images', true),
  ('orders.manage', 'orders', 'Can create and process orders', true),
  ('payments.manage', 'orders', 'Can process payments', true),
  ('dashboard.view', 'dashboard', 'Can view dashboard analytics', true),
  ('reports.export', 'dashboard', 'Can export financial reports', true),
  ('settings.manage', 'settings', 'Can edit restaurant profile settings', true),
  ('tables.manage', 'tables', 'Can configure table layout and details', true),
  ('inventory.manage', 'menu', 'Can view and log inventory changes', true),
  ('printers.manage', 'settings', 'Can edit receipt printer options', true)
ON CONFLICT (permission_key) DO UPDATE SET 
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- 2. Session registry table
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    login_method TEXT,
    app_version TEXT,
    location_country TEXT,
    location_city TEXT,
    browser TEXT,
    operating_system TEXT,
    device_type TEXT,
    ip_address TEXT,
    user_agent TEXT,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID,
    logout_reason TEXT,
    is_suspicious BOOLEAN NOT NULL DEFAULT false,
    failed_refresh_attempts INTEGER NOT NULL DEFAULT 0,
    refresh_token_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Idempotency table
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    key TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    response_payload JSONB NOT NULL,
    request_status TEXT NOT NULL CHECK (request_status IN ('processing', 'completed', 'failed')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'revoked', 'resent')),
    invitation_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    UNIQUE(restaurant_id, email)
);

-- 5. Background jobs & imports tables
CREATE TABLE IF NOT EXISTS public.background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'validating', 'ready', 'processing', 'completed', 'completed_with_warnings', 'failed', 'cancelled')),
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    error_summary TEXT,
    rollback_on_failure BOOLEAN NOT NULL DEFAULT false,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retry_count INTEGER NOT NULL DEFAULT 3,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    execution_time INTERVAL,
    initiated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    upload_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    import_type TEXT NOT NULL,
    validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    successful_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    error_report_url TEXT
);

CREATE TABLE IF NOT EXISTS public.export_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    exported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    export_type TEXT NOT NULL,
    filters_applied JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_file_size INTEGER NOT NULL DEFAULT 0,
    download_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    expiration_timestamp TIMESTAMPTZ NOT NULL
);

-- 6. Observability Metrics
CREATE TABLE IF NOT EXISTS public.metrics_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    metric_key TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed permissions for existing roles dynamically
DO $$
DECLARE
  v_role RECORD;
  v_perm RECORD;
BEGIN
  FOR v_role IN SELECT id, name FROM public.roles LOOP
    FOR v_perm IN SELECT id, permission_key FROM public.permissions_registry LOOP
      -- Owner gets everything
      IF v_role.name = 'Owner' THEN
        INSERT INTO public.role_permissions_registry (role_id, permission_id) VALUES (v_role.id, v_perm.id) ON CONFLICT DO NOTHING;
      -- Manager permissions mapping
      ELSIF v_role.name = 'Manager' AND v_perm.permission_key IN (
        'users.read', 'users.export', 'menu.read', 'menu.update', 'menu.images', 
        'orders.manage', 'payments.manage', 'dashboard.view', 'reports.export', 
        'tables.manage', 'inventory.manage', 'printers.manage'
      ) THEN
        INSERT INTO public.role_permissions_registry (role_id, permission_id) VALUES (v_role.id, v_perm.id) ON CONFLICT DO NOTHING;
      -- Cashier permissions mapping
      ELSIF v_role.name = 'Cashier' AND v_perm.permission_key IN (
        'users.read', 'menu.read', 'orders.manage', 'payments.manage', 
        'tables.manage', 'dashboard.view'
      ) THEN
        INSERT INTO public.role_permissions_registry (role_id, permission_id) VALUES (v_role.id, v_perm.id) ON CONFLICT DO NOTHING;
      -- Kitchen permissions mapping
      ELSIF v_role.name = 'Kitchen' AND v_perm.permission_key IN (
        'orders.manage', 'dashboard.view'
      ) THEN
        INSERT INTO public.role_permissions_registry (role_id, permission_id) VALUES (v_role.id, v_perm.id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 7. Define helper functions
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.users AS u
    JOIN public.roles AS r ON r.id = u.role_id
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.deleted_at IS NULL
      AND r.name = 'Owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_role(p_role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.roles 
    WHERE id = p_role_id 
      AND name IN ('Manager', 'Cashier', 'Kitchen')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_last_owner(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (COUNT(*) = 1)
  FROM public.users AS u
  JOIN public.roles AS r ON r.id = u.role_id
  WHERE u.restaurant_id = p_restaurant_id
    AND u.is_active = true
    AND u.deleted_at IS NULL
    AND r.name = 'Owner';
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
  v_role_name text;
  v_has boolean;
BEGIN
  -- Get user profile
  SELECT role_id INTO v_role_id 
  FROM public.users 
  WHERE id = auth.uid() 
    AND is_active = true 
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Owner bypass
  SELECT name INTO v_role_name FROM public.roles WHERE id = v_role_id;
  IF v_role_name = 'Owner' THEN
    RETURN true;
  END IF;

  -- Check permissions registry
  SELECT EXISTS (
    SELECT 1 
    FROM public.role_permissions_registry AS rp
    JOIN public.permissions_registry AS p ON p.id = rp.permission_id
    WHERE rp.role_id = v_role_id 
      AND p.permission_key = p_permission_key
      AND p.is_deprecated = false
  ) INTO v_has;

  RETURN COALESCE(v_has, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_activity(
  p_action text,
  p_module text,
  p_entity text,
  p_entity_id uuid,
  p_restaurant_id uuid,
  p_actor_id uuid,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (
    restaurant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_restaurant_id,
    p_actor_id,
    p_action,
    p_entity,
    p_entity_id,
    jsonb_build_object(
      'action', p_action,
      'module', p_module,
      'old_values', p_old_values,
      'new_values', p_new_values,
      'browser', p_metadata->>'browser',
      'operating_system', p_metadata->>'operating_system',
      'device', p_metadata->>'device',
      'ip_address', p_metadata->>'ip_address',
      'request_id', p_metadata->>'request_id',
      'correlation_id', p_metadata->>'correlation_id'
    )
  );
END;
$$;

-- Session functions
CREATE OR REPLACE FUNCTION public.register_user_session(
  p_session_id text,
  p_login_method text,
  p_app_version text,
  p_location_country text,
  p_location_city text,
  p_browser text,
  p_operating_system text,
  p_device_type text,
  p_ip_address text,
  p_user_agent text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  SELECT restaurant_id INTO v_restaurant_id 
  FROM public.users 
  WHERE id = auth.uid();

  IF v_restaurant_id IS NOT NULL THEN
    INSERT INTO public.user_sessions (
      session_id,
      user_id,
      restaurant_id,
      login_method,
      app_version,
      location_country,
      location_city,
      browser,
      operating_system,
      device_type,
      ip_address,
      user_agent,
      expires_at
    ) VALUES (
      p_session_id,
      auth.uid(),
      v_restaurant_id,
      p_login_method,
      p_app_version,
      p_location_country,
      p_location_city,
      p_browser,
      p_operating_system,
      p_device_type,
      p_ip_address,
      p_user_agent,
      now() + interval '7 days'
    )
    ON CONFLICT (session_id) DO UPDATE SET
      last_seen = now(),
      ip_address = EXCLUDED.ip_address,
      user_agent = EXCLUDED.user_agent;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.session_heartbeat(p_session_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_sessions 
  SET last_seen = now() 
  WHERE session_id = p_session_id 
    AND revoked_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.revoke_user_session(p_session_id uuid, p_reason text DEFAULT 'revoked_by_owner')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  IF NOT public.has_permission('users.update') THEN
    RAISE EXCEPTION 'AUTH_PERMISSION_DENIED';
  END IF;

  v_restaurant_id := public.current_restaurant_id();

  UPDATE public.user_sessions 
  SET 
    revoked_at = now(),
    revoked_by = auth.uid(),
    logout_reason = p_reason
  WHERE id = p_session_id 
    AND restaurant_id = v_restaurant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_other_user_sessions(p_current_session_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_sessions
  SET 
    revoked_at = now(),
    revoked_by = auth.uid(),
    logout_reason = 'session_revoked_by_user'
  WHERE user_id = auth.uid() 
    AND session_id != p_current_session_id 
    AND revoked_at IS NULL;
$$;

-- 8. Staff management RPCs
CREATE OR REPLACE FUNCTION public.update_staff(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_role_id uuid,
  p_is_active boolean,
  p_version integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_old_row public.users%ROWTYPE;
  v_old_role_name text;
  v_new_role_name text;
BEGIN
  -- 1. Validate permissions
  IF NOT public.has_permission('users.update') THEN
    RETURN jsonb_build_object('success', false, 'code', 'AUTH_PERMISSION_DENIED', 'message', 'Only Owners or Managers can edit staff.');
  END IF;

  v_restaurant_id := public.current_restaurant_id();

  -- 2. Fetch target user profile and assert same restaurant
  SELECT * INTO v_old_row FROM public.users 
  WHERE id = p_user_id AND restaurant_id = v_restaurant_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'User not found in this restaurant.');
  END IF;

  -- Concurrency check
  IF v_old_row.version != p_version THEN
    RETURN jsonb_build_object('success', false, 'code', 'VERSION_CONFLICT', 'message', 'This record has changed. Please refresh.');
  END IF;

  -- 3. Assert target is NOT Owner
  SELECT name INTO v_old_role_name FROM public.roles WHERE id = v_old_row.role_id;
  IF v_old_role_name = 'Owner' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ROLE_NOT_ALLOWED', 'message', 'Cannot edit Owner accounts.');
  END IF;

  -- 4. Assert new role is NOT Owner
  SELECT name INTO v_new_role_name FROM public.roles WHERE id = p_role_id AND restaurant_id = v_restaurant_id;
  IF v_new_role_name = 'Owner' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ROLE_NOT_ALLOWED', 'message', 'Cannot assign Owner role.');
  END IF;

  -- 5. Perform Update
  UPDATE public.users 
  SET 
    full_name = p_full_name,
    phone = p_phone,
    role_id = p_role_id,
    is_active = p_is_active
  WHERE id = p_user_id;

  -- 6. Log activity
  PERFORM public.log_activity(
    'UPDATE_USER',
    'users',
    'users',
    p_user_id,
    v_restaurant_id,
    auth.uid(),
    jsonb_build_object(
      'full_name', v_old_row.full_name,
      'phone', v_old_row.phone,
      'role_id', v_old_row.role_id,
      'is_active', v_old_row.is_active
    ),
    jsonb_build_object(
      'full_name', p_full_name,
      'phone', p_phone,
      'role_id', p_role_id,
      'is_active', p_is_active
    ),
    p_metadata
  );

  RETURN jsonb_build_object('success', true, 'code', 'USER_UPDATED', 'message', 'Staff updated successfully.');
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_staff(
  p_user_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_old_row public.users%ROWTYPE;
  v_old_role_name text;
BEGIN
  -- 1. Validate permissions
  IF NOT public.has_permission('users.archive') THEN
    RETURN jsonb_build_object('success', false, 'code', 'AUTH_PERMISSION_DENIED', 'message', 'Only Owners can archive staff.');
  END IF;

  v_restaurant_id := public.current_restaurant_id();

  -- 2. Fetch target user
  SELECT * INTO v_old_row FROM public.users 
  WHERE id = p_user_id AND restaurant_id = v_restaurant_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'User not found in this restaurant.');
  END IF;

  -- 3. Assert target is NOT Owner
  SELECT name INTO v_old_role_name FROM public.roles WHERE id = v_old_row.role_id;
  IF v_old_role_name = 'Owner' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ROLE_NOT_ALLOWED', 'message', 'Cannot archive Owner accounts.');
  END IF;

  -- 4. Archive staff user
  UPDATE public.users 
  SET 
    is_active = false,
    deleted_at = now(),
    deleted_by = auth.uid()
  WHERE id = p_user_id;

  -- 5. Revoke all active sessions
  UPDATE public.user_sessions 
  SET 
    revoked_at = now(),
    revoked_by = auth.uid(),
    logout_reason = 'staff_archived'
  WHERE user_id = p_user_id 
    AND revoked_at IS NULL;

  -- 6. Log activity
  PERFORM public.log_activity(
    'ARCHIVE_USER',
    'users',
    'users',
    p_user_id,
    v_restaurant_id,
    auth.uid(),
    jsonb_build_object('is_active', v_old_row.is_active, 'deleted_at', v_old_row.deleted_at),
    jsonb_build_object('is_active', false, 'deleted_at', now()),
    p_metadata
  );

  RETURN jsonb_build_object('success', true, 'code', 'USER_ARCHIVED', 'message', 'Staff archived successfully.');
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_staff(
  p_user_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_old_row public.users%ROWTYPE;
BEGIN
  -- 1. Validate permissions
  IF NOT public.has_permission('users.restore') THEN
    RETURN jsonb_build_object('success', false, 'code', 'AUTH_PERMISSION_DENIED', 'message', 'Only Owners can restore staff.');
  END IF;

  v_restaurant_id := public.current_restaurant_id();

  -- 2. Fetch target user (even if deleted)
  SELECT * INTO v_old_row FROM public.users 
  WHERE id = p_user_id AND restaurant_id = v_restaurant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'User not found.');
  END IF;

  -- 3. Restore staff user
  UPDATE public.users 
  SET 
    is_active = true,
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = p_user_id;

  -- 4. Log activity
  PERFORM public.log_activity(
    'RESTORE_USER',
    'users',
    'users',
    p_user_id,
    v_restaurant_id,
    auth.uid(),
    jsonb_build_object('is_active', v_old_row.is_active, 'deleted_at', v_old_row.deleted_at),
    jsonb_build_object('is_active', true, 'deleted_at', null),
    p_metadata
  );

  RETURN jsonb_build_object('success', true, 'code', 'USER_RESTORED', 'message', 'Staff restored successfully.');
END;
$$;

-- 9. Disaster Recovery backup/restore RPCs
CREATE OR REPLACE FUNCTION public.backup_staff_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_backup_data jsonb;
BEGIN
  IF NOT public.has_permission('users.export') THEN
    RAISE EXCEPTION 'AUTH_PERMISSION_DENIED';
  END IF;

  v_restaurant_id := public.current_restaurant_id();

  -- Build encrypted/encoded JSON backup
  SELECT jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'backup_time', now(),
    'users', (
      SELECT json_agg(u.*) 
      FROM public.users u 
      WHERE u.restaurant_id = v_restaurant_id AND u.deleted_at IS NULL
    ),
    'invitations', (
      SELECT json_agg(i.*) 
      FROM public.invitations i 
      WHERE i.restaurant_id = v_restaurant_id AND i.status = 'pending'
    ),
    'permissions', (
      SELECT json_agg(rp.*) 
      FROM public.role_permissions_registry rp
      JOIN public.roles r ON r.id = rp.role_id
      WHERE r.restaurant_id = v_restaurant_id
    )
  ) INTO v_backup_data;

  RETURN v_backup_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_staff_config(p_backup_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_backup_restaurant_id uuid;
  v_user RECORD;
BEGIN
  IF NOT public.has_permission('users.import') THEN
    RETURN jsonb_build_object('success', false, 'code', 'AUTH_PERMISSION_DENIED', 'message', 'Only Owners can restore configs.');
  END IF;

  v_restaurant_id := public.current_restaurant_id();
  v_backup_restaurant_id := (p_backup_payload->>'restaurant_id')::uuid;

  -- Verify tenant isolation
  IF v_restaurant_id != v_backup_restaurant_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_RESTAURANT', 'message', 'Tenant isolation conflict. Backup file belongs to another restaurant.');
  END IF;

  -- Restore users profile details (loop and upsert)
  FOR v_user IN SELECT * FROM jsonb_to_recordset(p_backup_payload->'users') AS (
    id uuid, full_name text, phone text, role_id uuid, is_active boolean
  ) LOOP
    -- Only update if user already exists in public.users to prevent auth or orphan accounts
    UPDATE public.users 
    SET 
      full_name = v_user.full_name,
      phone = v_user.phone,
      role_id = v_user.role_id,
      is_active = v_user.is_active
    WHERE id = v_user.id AND restaurant_id = v_restaurant_id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'code', 'RESTORE_COMPLETE', 'message', 'Staff configuration restored successfully.');
END;
$$;

-- 10. Rebuild RLS Policies
DROP POLICY IF EXISTS tenant_select ON public.users;
DROP POLICY IF EXISTS tenant_insert ON public.users;
DROP POLICY IF EXISTS tenant_update ON public.users;
DROP POLICY IF EXISTS tenant_delete ON public.users;

CREATE POLICY tenant_select ON public.users FOR SELECT USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);
CREATE POLICY tenant_insert ON public.users FOR INSERT WITH CHECK (false); -- Edge function only
CREATE POLICY tenant_update ON public.users FOR UPDATE 
  USING (
    restaurant_id = public.current_restaurant_id()
    AND (id = auth.uid() OR public.has_permission('users.update'))
  )
  WITH CHECK (
    restaurant_id = public.current_restaurant_id()
    AND (
      (id = auth.uid() AND deleted_at IS NULL AND is_active = true AND role_id = (SELECT role_id FROM public.users WHERE id = auth.uid()))
      OR (id != auth.uid() AND public.has_permission('users.update'))
    )
  );
CREATE POLICY tenant_delete ON public.users FOR DELETE USING (false); -- Disable direct delete

-- Reapply on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_sessions_restaurant_isolation ON public.user_sessions;
CREATE POLICY user_sessions_restaurant_isolation ON public.user_sessions FOR ALL
  USING (restaurant_id = public.current_restaurant_id());

-- Reapply on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invitations_restaurant_isolation ON public.invitations;
CREATE POLICY invitations_restaurant_isolation ON public.invitations FOR ALL
  USING (restaurant_id = public.current_restaurant_id());

-- Reapply on background_jobs
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS background_jobs_restaurant_isolation ON public.background_jobs;
CREATE POLICY background_jobs_restaurant_isolation ON public.background_jobs FOR ALL
  USING (restaurant_id = public.current_restaurant_id());

-- 11. Additional RPCs called by frontend
CREATE OR REPLACE FUNCTION public.get_active_sessions()
RETURNS TABLE (
  id uuid,
  session_id text,
  browser text,
  operating_system text,
  device_type text,
  ip_address text,
  last_seen timestamptz,
  created_at timestamptz,
  users jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission('users.read') THEN
    RAISE EXCEPTION 'AUTH_PERMISSION_DENIED';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.session_id,
    s.browser,
    s.operating_system,
    s.device_type,
    s.ip_address,
    s.last_seen,
    s.created_at,
    jsonb_build_object('full_name', u.full_name) AS users
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.restaurant_id = public.current_restaurant_id()
    AND s.revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_batch_import_job(
  p_job_type text,
  p_total_rows integer,
  p_rollback_on_failure boolean
)
RETURNS public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_job public.background_jobs;
BEGIN
  IF NOT public.has_permission('users.import') THEN
    RAISE EXCEPTION 'AUTH_PERMISSION_DENIED';
  END IF;

  v_restaurant_id := public.current_restaurant_id();

  INSERT INTO public.background_jobs (
    restaurant_id,
    job_type,
    status,
    total_rows,
    rollback_on_failure,
    initiated_by
  ) VALUES (
    v_restaurant_id,
    p_job_type,
    'processing',
    p_total_rows,
    p_rollback_on_failure,
    auth.uid()
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;
