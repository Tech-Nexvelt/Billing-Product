import { supabase } from '@/lib/supabase';

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  suggestedAction?: 'checkout' | 'kitchen' | 'resume' | 'cancel' | 'none';
  errorMessage?: string;
  outstandingBalance?: number;
  activeOrderExists?: boolean;
  orderItemCount?: number;
  paymentStatus?: string;
}

export class TableStatusValidationService {
  async validateAvailable(tableId: string): Promise<ValidationResult> {
    try {
      const { data: table, error: tableErr } = await supabase
        .from('tables')
        .select(`
          id,
          table_number,
          status,
          current_bill,
          orders (
            id,
            status,
            grand_total,
            order_items (
              id
            ),
            payments (
              amount
            )
          )
        `)
        .eq('id', tableId)
        .single();

      if (tableErr || !table) {
        return {
          allowed: false,
          outstandingBalance: 0,
          activeOrderExists: false,
          orderItemCount: 0,
          paymentStatus: 'Unknown',
          reason: 'Table details not found',
          errorMessage: 'The selected table details could not be loaded.',
          suggestedAction: 'none'
        };
      }

      // Filter active orders
      const activeOrders = ((table as any).orders || []).filter((o: any) =>
        ['draft', 'pending', 'preparing', 'ready', 'hold'].includes(o.status)
      );
      const activeOrder = activeOrders[0] || null;

      const activeOrderExists = !!activeOrder;
      const orderItemCount = activeOrder ? (activeOrder.order_items?.length || 0) : 0;
      const grandTotal = activeOrder ? Number(activeOrder.grand_total) || 0 : 0;
      const paidAmount = activeOrder ? (activeOrder.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0) : 0;
      const outstandingBalance = activeOrderExists ? Math.max(0, grandTotal - paidAmount) : 0;
      const paymentStatus = activeOrderExists && outstandingBalance > 0 ? 'Unpaid' : 'Paid';

      // Validation Checks
      if (activeOrderExists) {
        if (activeOrder.status === 'hold') {
          return {
            allowed: false,
            outstandingBalance,
            activeOrderExists,
            orderItemCount,
            paymentStatus,
            reason: 'Held Bill',
            errorMessage: 'This table contains a held order. Resume or cancel the held bill first.',
            suggestedAction: 'resume'
          };
        }

        // Only block mark available if there are active order items
        if (orderItemCount > 0) {
          const hasKitchenActive = ['pending', 'preparing'].includes(activeOrder.status);
          if (hasKitchenActive) {
            return {
              allowed: false,
              outstandingBalance,
              activeOrderExists,
              orderItemCount,
              paymentStatus,
              reason: 'Kitchen Order Active',
              errorMessage: 'Some items are still being prepared. Complete kitchen workflow before freeing this table.',
              suggestedAction: 'kitchen'
            };
          }

          if (outstandingBalance > 0 && paymentStatus !== 'Paid') {
            return {
              allowed: false,
              outstandingBalance,
              activeOrderExists,
              orderItemCount,
              paymentStatus,
              reason: 'Payment Required',
              errorMessage: `This table has an unpaid order of ₹${outstandingBalance}. Please complete checkout before marking the table as Available.`,
              suggestedAction: 'checkout'
            };
          }
        }
      }

      if (table.status === 'reserved') {
        return {
          allowed: false,
          outstandingBalance: 0,
          activeOrderExists,
          orderItemCount,
          paymentStatus,
          reason: 'Table Reserved',
          errorMessage: 'Release or update reservation status before making the table available.',
          suggestedAction: 'none'
        };
      }

      return {
        allowed: true,
        outstandingBalance,
        activeOrderExists,
        orderItemCount,
        paymentStatus,
        reason: 'Success'
      };
    } catch (err: any) {
      return {
        allowed: false,
        outstandingBalance: 0,
        activeOrderExists: false,
        orderItemCount: 0,
        paymentStatus: 'Error',
        reason: 'System error',
        errorMessage: err.message,
        suggestedAction: 'none'
      };
    }
  }

  async validateStatusChange(
    tableId: string,
    newStatus: string,
    restaurantId: string,
    user?: { id: string; full_name?: string | null }
  ): Promise<ValidationResult> {
    try {
      if (newStatus === 'available') {
        const check = await this.validateAvailable(tableId);
        
        // Log to activity_logs if not allowed
        if (!check.allowed && user) {
          await supabase.from('activity_logs').insert({
            restaurant_id: restaurantId,
            user_id: user.id,
            action: 'validation_failed',
            resource_type: 'table',
            resource_id: tableId,
            metadata: {
              requested_status: newStatus,
              reason: check.reason,
              cashier: user.full_name || 'Cashier',
              timestamp: new Date().toISOString()
            }
          });
        }
        
        return check;
      }

      // 1. Fetch table and its active orders for other status transitions
      const { data: table, error: tableErr } = await supabase
        .from('tables')
        .select(`
          id,
          table_number,
          status,
          current_bill,
          orders (
            id,
            status,
            grand_total
          )
        `)
        .eq('id', tableId)
        .single();

      if (tableErr || !table) {
        return { 
          allowed: false, 
          reason: 'Table details not found', 
          errorMessage: 'The selected table details could not be loaded from the database.',
          suggestedAction: 'none'
        };
      }

      const activeOrders = ((table as any).orders || []).filter((o: any) => 
        ['draft', 'pending', 'preparing', 'ready', 'hold'].includes(o.status)
      );
      const hasKitchenActive = activeOrders.some((o: any) => 
        ['pending', 'preparing'].includes(o.status)
      );

      let allowed = true;
      let reasonText = '';
      let errorMsg = '';
      let suggestedAction: 'checkout' | 'kitchen' | 'resume' | 'cancel' | 'none' = 'none';

      if (newStatus === 'cleaning') {
        if (hasKitchenActive) {
          allowed = false;
          reasonText = 'Kitchen Order Active';
          errorMsg = 'Please wait for all food preparation to finish before cleaning.';
          suggestedAction = 'kitchen';
        }
      } else if (newStatus === 'reserved') {
        if (table.status === 'occupied') {
          allowed = false;
          reasonText = 'Table Occupied';
          errorMsg = 'Occupied tables cannot be directly reserved.';
          suggestedAction = 'none';
        }
      } else if (newStatus === 'out_of_service') {
        // Out of service is always allowed — it is an admin/manager override.
        // No blocking validation for this status.
      }

      if (!allowed) {
        if (user) {
          await supabase.from('activity_logs').insert({
            restaurant_id: restaurantId,
            user_id: user.id,
            action: 'validation_failed',
            resource_type: 'table',
            resource_id: tableId,
            metadata: {
              requested_status: newStatus,
              current_status: table.status,
              reason: reasonText,
              cashier: user.full_name || 'Cashier',
              timestamp: new Date().toISOString()
            }
          });
        }

        return {
          allowed: false,
          reason: reasonText,
          errorMessage: errorMsg,
          suggestedAction
        };
      }

      return { allowed: true };
    } catch (err: any) {
      return { allowed: false, reason: 'System error', errorMessage: err.message, suggestedAction: 'none' };
    }
  }

  async canMarkAvailable(
    tableId: string,
    restaurantId: string,
    user?: { id: string; full_name?: string | null }
  ): Promise<ValidationResult> {
    return this.validateStatusChange(tableId, 'available', restaurantId, user);
  }

  async canMarkCleaning(
    tableId: string,
    restaurantId: string,
    user?: { id: string; full_name?: string | null }
  ): Promise<ValidationResult> {
    return this.validateStatusChange(tableId, 'cleaning', restaurantId, user);
  }

  async canMarkReserved(
    tableId: string,
    restaurantId: string,
    user?: { id: string; full_name?: string | null }
  ): Promise<ValidationResult> {
    return this.validateStatusChange(tableId, 'reserved', restaurantId, user);
  }

  async canMarkOccupied(
    tableId: string,
    restaurantId: string,
    user?: { id: string; full_name?: string | null }
  ): Promise<ValidationResult> {
    return this.validateStatusChange(tableId, 'occupied', restaurantId, user);
  }

  async canMarkOutOfService(
    tableId: string,
    restaurantId: string,
    user?: { id: string; full_name?: string | null }
  ): Promise<ValidationResult> {
    return this.validateStatusChange(tableId, 'out_of_service', restaurantId, user);
  }
}

export const tableStatusValidationService = new TableStatusValidationService();
