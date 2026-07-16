import * as z from 'zod';

export const tableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(100),
  floorId: z.string().uuid('Invalid Floor selected'),
  tableType: z.enum(['dining', 'vip', 'outdoor', 'family', 'private']).default('dining'),
  tableShape: z.enum(['square', 'rectangle', 'circle']).default('square'),
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning', 'out_of_service', 'closed']).default('available'),
  positionX: z.number().optional().nullable(),
  positionY: z.number().optional().nullable(),
  displayOrder: z.number().int().default(0),
});

export type TableInput = z.infer<typeof tableSchema>;
