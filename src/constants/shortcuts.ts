export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  action: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { key: 'n', ctrlKey: true, description: 'New Order', action: 'NEW_ORDER' },
  { key: 'f', ctrlKey: true, description: 'Search', action: 'SEARCH' },
  { key: 's', ctrlKey: true, description: 'Save Draft', action: 'SAVE_DRAFT' },
  { key: 'Escape', description: 'Close / Clear', action: 'ESCAPE' },
];
