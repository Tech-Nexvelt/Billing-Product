-- Tenant identity must come from the server-side user profile, not mutable JWT metadata.
-- This function is SECURITY DEFINER so policies on public.users do not recurse while
-- resolving the currently authenticated user's restaurant.
CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.restaurant_id
  FROM public.users AS u
  WHERE u.id = auth.uid()
    AND u.is_active = true
    AND u.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_restaurant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_restaurant_id() TO authenticated;

-- Authentication/profile bootstrap
ALTER POLICY "tenant_select" ON public.users
  USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);

ALTER POLICY "tenant_select" ON public.roles
  USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);

-- Tables page dependencies
ALTER POLICY "tenant_select" ON public.restaurants
  USING (id = public.current_restaurant_id() AND deleted_at IS NULL);

ALTER POLICY "tenant_select" ON public.restaurant_settings
  USING (restaurant_id = public.current_restaurant_id());

ALTER POLICY "tenant_select" ON public.floors
  USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);

ALTER POLICY "tenant_select" ON public.tables
  USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);

ALTER POLICY "tenant_select" ON public.orders
  USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);

-- Table management operations
ALTER POLICY "tenant_insert" ON public.tables
  WITH CHECK (restaurant_id = public.current_restaurant_id());

ALTER POLICY "tenant_update" ON public.tables
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

ALTER POLICY "tenant_insert" ON public.floors
  WITH CHECK (restaurant_id = public.current_restaurant_id());

ALTER POLICY "tenant_update" ON public.floors
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
