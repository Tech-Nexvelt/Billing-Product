import { SelectedModifier } from '@/types/order.types';

/**
 * Computes a deterministic 32-character hexadecimal hash for a configured cart item payload.
 * Used for O(1) cart line-item matching and merging.
 */
export function computeCartItemHash(
  menuItemId: string,
  variantId?: string | null,
  selectedModifiers: SelectedModifier[] = [],
  specialNotes: string = ''
): string {
  // Sort modifiers deterministically by group_id and option_id/text_value
  const sortedModifiers = [...selectedModifiers].sort((a, b) => {
    const keyA = `${a.group_id}_${a.option_id || a.text_value || ''}`;
    const keyB = `${b.group_id}_${b.option_id || b.text_value || ''}`;
    return keyA.localeCompare(keyB);
  });

  const payload = JSON.stringify({
    item: menuItemId,
    variant: variantId || null,
    modifiers: sortedModifiers.map(m => ({
      g: m.group_id,
      o: m.option_id || null,
      q: m.quantity || 1,
      t: (m.text_value || '').trim().toLowerCase()
    })),
    notes: (specialNotes || '').trim().toLowerCase()
  });

  return fnv1a32Hex(payload);
}

/**
 * Fast 32-bit FNV-1a hash algorithm returning an 8-character hex string per round,
 * concatenated into a deterministic 32-character composite key.
 */
function fnv1a32Hex(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code;
    h2 = Math.imul(h2, 0x811c9dc5);
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const hex4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');

  return `${hex1}${hex2}${hex3}${hex4}`;
}
