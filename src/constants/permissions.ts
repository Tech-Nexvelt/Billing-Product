export type PermissionModule = 'menu' | 'tables' | 'orders' | 'floors' | 'settings' | 'roles' | 'dashboard';
export type PermissionAction = 'view' | 'create' | 'update' | 'delete';

export interface ModulePermission {
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export const PERMISSION_MODULES: PermissionModule[] = [
  'menu', 'tables', 'orders', 'floors', 'settings', 'roles', 'dashboard'
];
