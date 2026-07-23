import { MenuItemWithVariantsAndModifiers, ProductVariant } from '@/types/menu.types';

export interface ExtractedVariantInfo {
  isVariant: boolean;
  isModifierCandidate: boolean;
  baseName: string;
  variantTitle: string;
  variantType: 'size' | 'weight' | 'volume' | 'cup' | 'portion' | 'bottle' | 'scoop_patty' | 'unknown';
  modifierReason?: string;
}

/**
 * Enterprise product name normalization function.
 * Normalizes spaces, hyphens, underscores, brackets (), [], {} and punctuation.
 * e.g. "Chocolate Fudge", "Chocolate-Fudge", "Chocolate_Fudge", "Chocolate (Fudge)" -> "chocolate fudge"
 */
export function normalizeProductName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[\(\[\{\}\]\)]/g, ' ')
    .replace(/[_\-\.,;:!@#$%^&*+=\|\\\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VARIANT_PATTERNS: { type: ExtractedVariantInfo['variantType']; regex: RegExp }[] = [
  // 1. Size in inches / dimensions: e.g. 6", 8", 10", 12", (6"), (8 Inch), 10 inches
  { type: 'size', regex: /\s*[\(\[\{-]?\s*(\d+(?:\.\d+)?\s*(?:"|inch|inches|''|cm))\s*[\)\]\}]?$/i },

  // 2. Weight: e.g. ½ Kg, 1/2 Kg, 1 Kg, 500 g, 250g, (1.5 Kg), 1kilo, 500gm
  { type: 'weight', regex: /\s*[\(\[\{-]?\s*(½|1\/2|\d+(?:\.\d+)?)\s*(?:kg|g|gm|grams|kilo|kilos)\s*[\)\]\}]?$/i },

  // 3. Volume: e.g. 250ml, 500 ml, 1L, 2 L, 1.5L, (750 ml), 1liter, 1litre
  { type: 'volume', regex: /\s*[\(\[\{-]?\s*(\d+(?:\.\d+)?)\s*(?:ml|l|liter|liters|litre|litres)\s*[\)\]\}]?$/i },

  // 4. Cup & Beverage Sizes: Small, Medium, Large, Regular, XL, XXL, Mini, Jumbo
  { type: 'cup', regex: /\s*[\(\[\{-]?\s*(small|medium|large|regular|xl|xxl|mini|jumbo)\s*[\)\]\}]?$/i },

  // 5. Serving Portions: Single, Double, Family, Half, Full, Quarter
  { type: 'portion', regex: /\s*[\(\[\{-]?\s*(single|double|family|half|full|quarter)\s*[\)\]\}]?$/i },

  // 6. Bottle Sizes: e.g. 250ml Bottle, 500ml Bottle, 1L Bottle
  { type: 'bottle', regex: /\s*[\(\[\{-]?\s*(\d+(?:\.\d+)?\s*(?:ml|l)\s*(?:bottle)?)\s*[\)\]\}]?$/i },

  // 7. Scoops & Patty Sizes: e.g. 1 Scoop, 2 Scoops, Single Patty, Double Patty
  { type: 'scoop_patty', regex: /\s*[\(\[\{-]?\s*(\d+\s*scoops?|\d+\s*patties|single\s*patty|double\s*patty)\s*[\)\]\}]?$/i },
];

/** Modifier keywords that must NOT be converted to variants automatically */
const MODIFIER_KEYWORDS_REGEX = /\b(egg|eggless|veg|non-veg|chicken|mutton|paneer|extra|whipped|cheese|chocolate|candles|gift wrap|photo print|message|special)\b/i;

/**
 * Extracts generic variant information from a product name.
 * e.g. "Chocolate Cake (1 Kg)" -> baseName: "Chocolate Cake", variantTitle: "1 Kg", isVariant: true
 */
export function extractVariantInfo(itemName: string): ExtractedVariantInfo {
  const trimmed = itemName.trim();

  // 1. Check for recognized Variant Patterns
  for (const pattern of VARIANT_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      const rawVariant = match[1] || match[0];
      const baseName = trimmed.replace(pattern.regex, '').trim();

      if (baseName.length >= 2) {
        return {
          isVariant: true,
          isModifierCandidate: false,
          baseName,
          variantTitle: capitalizeVariant(rawVariant),
          variantType: pattern.type
        };
      }
    }
  }

  // 2. Check if product is a potential Modifier Candidate (Egg/Eggless, Veg/Chicken, etc.)
  if (MODIFIER_KEYWORDS_REGEX.test(trimmed)) {
    return {
      isVariant: false,
      isModifierCandidate: true,
      baseName: trimmed,
      variantTitle: '',
      variantType: 'unknown',
      modifierReason: 'Contains preparation choice or modifier keyword (Egg, Veg, Extra, etc.)'
    };
  }

  return {
    isVariant: false,
    isModifierCandidate: false,
    baseName: trimmed,
    variantTitle: '',
    variantType: 'unknown'
  };
}

function capitalizeVariant(str: string): string {
  const s = str.trim().replace(/^[\(\[\{-]+|[\)\]\}]+$/g, '').trim();
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Consolidates legacy menu items with size/weight/volume suffixes into unified parent items with product variants.
 * Uses enterprise normalization for parent key grouping.
 */
export function consolidateLegacyVariantItems(
  items: MenuItemWithVariantsAndModifiers[],
  restaurantId: string
): MenuItemWithVariantsAndModifiers[] {
  const parentMap = new Map<string, MenuItemWithVariantsAndModifiers>();
  const variantClusters = new Map<string, MenuItemWithVariantsAndModifiers[]>();

  // Group items by normalized baseName if they match variant patterns
  for (const item of items) {
    // Skip items already marked as hidden migrated children or child items with parent_menu_item_id
    if ((item as any).is_migrated_legacy_variant || (item as any).deleted_at || (item as any).parent_menu_item_id != null) continue;

    const info = extractVariantInfo(item.name);

    if (info.isVariant && (!item.variants || item.variants.length === 0)) {
      const key = `${item.category_id}_${normalizeProductName(info.baseName)}`;
      if (!variantClusters.has(key)) {
        variantClusters.set(key, []);
      }
      variantClusters.get(key)!.push(item);
    } else {
      parentMap.set(item.id, { ...item });
    }
  }

  // Convert clusters into consolidated parent items
  for (const [_key, cluster] of variantClusters.entries()) {
    if (cluster.length >= 1) {
      const first = cluster[0];
      const info = extractVariantInfo(first.name);
      const parentId = `parent-${first.id}`;

      const generatedVariants: ProductVariant[] = cluster.map((child, idx) => {
        const childInfo = extractVariantInfo(child.name);
        return {
          id: `var-${child.id}`,
          restaurant_id: restaurantId,
          menu_item_id: parentId,
          name: childInfo.variantTitle || `Option ${idx + 1}`,
          sku: child.sku,
          barcode: child.barcode,
          price_override: child.selling_price,
          cost_price: child.cost_price,
          is_active: child.availability_status === 'available',
          display_order: idx + 1
        };
      });

      const consolidatedParent: MenuItemWithVariantsAndModifiers = {
        ...first,
        id: parentId,
        name: info.baseName,
        variants: generatedVariants,
        modifier_groups: first.modifier_groups || [],
      };
      (consolidatedParent as any).is_variant_parent = true;

      parentMap.set(parentId, consolidatedParent);
    } else {
      for (const item of cluster) {
        parentMap.set(item.id, { ...item });
      }
    }
  }

  return Array.from(parentMap.values());
}
