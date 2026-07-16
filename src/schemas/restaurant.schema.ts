import * as z from 'zod';

export const restaurantOnboardingSchema = z.object({
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number'),
  email: z.string().email('Invalid email address'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST format (e.g. 29ABCDE1234F1Z5)').optional().or(z.literal('')),
  currency: z.string(),
  timezone: z.string(),
  businessType: z.string(),
  numFloors: z.number().int().min(1).max(5),
  numTables: z.number().int().min(1).max(50),
});

export const restaurantSettingsSchema = z.object({
  name: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number').optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST format').optional().or(z.literal('')),
  currency: z.string(),
  timezone: z.string(),
  taxRate: z.number().min(0).max(100),
  serviceCharge: z.number().min(0).max(100),
  currencySymbol: z.string().default('₹'),
  decimalPlaces: z.number().int().min(0).max(4).default(2),
});

export type RestaurantOnboardingInput = z.infer<typeof restaurantOnboardingSchema>;
export type RestaurantSettingsInput = z.infer<typeof restaurantSettingsSchema>;
