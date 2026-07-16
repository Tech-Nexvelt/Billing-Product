export const DEFAULT_ROLES = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  KITCHEN: 'Kitchen',
} as const;

export type DefaultRoleName = typeof DEFAULT_ROLES[keyof typeof DEFAULT_ROLES];
