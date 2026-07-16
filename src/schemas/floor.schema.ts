import * as z from 'zod';

export const floorSchema = z.object({
  name: z.string().min(1, 'Floor name is required'),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type FloorInput = z.infer<typeof floorSchema>;
