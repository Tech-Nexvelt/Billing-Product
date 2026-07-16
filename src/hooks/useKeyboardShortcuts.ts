import { useEffect, useRef } from 'react';
import type { KeyboardShortcut } from '@/constants/shortcuts';

type ShortcutHandler = () => void;

interface RegisteredShortcut extends KeyboardShortcut {
  handler: ShortcutHandler;
}

const registry = new Map<string, RegisteredShortcut>();

function getShortcutKey(s: KeyboardShortcut): string {
  return `${s.ctrlKey ? 'ctrl+' : ''}${s.shiftKey ? 'shift+' : ''}${s.altKey ? 'alt+' : ''}${s.key.toLowerCase()}`;
}

let listenerAdded = false;

function handleKeyDown(e: KeyboardEvent) {
  // Don't fire in input/textarea unless it's Escape
  const tag = (e.target as HTMLElement)?.tagName;
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  
  const key = `${e.ctrlKey ? 'ctrl+' : ''}${e.shiftKey ? 'shift+' : ''}${e.altKey ? 'alt+' : ''}${e.key.toLowerCase()}`;
  const registered = registry.get(key);
  
  if (registered) {
    if (isInput && e.key !== 'Escape') return;
    e.preventDefault();
    registered.handler();
  }
}

export function useKeyboardShortcuts(
  shortcuts: Array<KeyboardShortcut & { handler: ShortcutHandler }>
) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const keys: string[] = [];
    
    shortcutsRef.current.forEach(s => {
      const key = getShortcutKey(s);
      registry.set(key, s);
      keys.push(key);
    });

    if (!listenerAdded) {
      document.addEventListener('keydown', handleKeyDown);
      listenerAdded = true;
    }

    return () => {
      keys.forEach(k => registry.delete(k));
      if (registry.size === 0) {
        document.removeEventListener('keydown', handleKeyDown);
        listenerAdded = false;
      }
    };
  }, []);
}
