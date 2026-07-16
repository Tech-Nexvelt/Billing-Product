export const SYSTEM_TAG_SLUGS = [
  'popular', 'chef_special', 'spicy', 'kids', 'vegan',
  'recommended', 'best_seller', 'gluten_free'
] as const;

export type SystemTagSlug = typeof SYSTEM_TAG_SLUGS[number];

export const TAG_COLORS: Record<SystemTagSlug, string> = {
  popular: '#F59E0B',
  chef_special: '#0AB190',
  spicy: '#EF4444',
  kids: '#3B82F6',
  vegan: '#22C55E',
  recommended: '#8B5CF6',
  best_seller: '#F97316',
  gluten_free: '#EC4899',
};
