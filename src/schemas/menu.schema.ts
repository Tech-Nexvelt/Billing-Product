import * as z from 'zod';

export const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional().or(z.literal('')),
  imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
  icon: z.string().optional().or(z.literal('')),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().or(z.literal('')),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const menuItemSchema = z.object({
  categoryId: z.string().uuid('Invalid category selected'),
  name: z.string().min(2, 'Item name must be at least 2 characters'),
  description: z.string().optional().or(z.literal('')),
  costPrice: z.number().min(0, 'Cost price must be positive').optional().nullable(),
  sellingPrice: z.number().min(0, 'Selling price must be positive'),
  imageUrl: z.string().min(1, 'Image is required'),
  isVeg: z.boolean().default(false),
  prepTime: z.number().int().min(1, 'Preparation time must be at least 1 minute').optional().nullable(),
  availabilityStatus: z.enum(['available', 'out_of_stock', 'hidden', 'seasonal']).default('available'),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  displayOrder: z.number().int().default(0),
  tags: z.array(z.string()).default([]), // array of tag IDs
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
