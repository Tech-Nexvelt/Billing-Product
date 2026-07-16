import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { Payment, PaymentMethod, ProcessPaymentInput, RefundInput } from '@/types/payment.types';

export class PaymentService extends BaseService {
  async getMethods(restaurantId: string): Promise<ApiResponse<PaymentMethod[]>> {
    return this.handleCall(
      supabase
        .from('payment_methods')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order')
    );
  }

  async createMethod(
    restaurantId: string,
    data: Omit<PaymentMethod, 'id' | 'restaurant_id' | 'version' | 'deleted_at' | 'created_at' | 'updated_at'>
  ): Promise<ApiResponse<PaymentMethod>> {
    return this.handleCall(
      supabase
        .from('payment_methods')
        .insert({ ...data, restaurant_id: restaurantId })
        .select()
        .single()
    );
  }

  async updateMethod(
    id: string,
    data: Partial<PaymentMethod>,
    currentVersion: number
  ): Promise<ApiResponse<PaymentMethod>> {
    return this.handleCall(
      supabase
        .from('payment_methods')
        .update({ ...data, version: currentVersion + 1 })
        .eq('id', id)
        .eq('version', currentVersion)
        .select()
        .single()
    );
  }

  async deleteMethod(id: string, userId: string): Promise<ApiResponse<null>> {
    const { error } = await supabase
      .from('payment_methods')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', id);
    if (error) return this.createClientError(error.message);
    return { success: true, message: 'Payment method deleted', data: null, error: null };
  }

  async getOrderPayments(orderId: string): Promise<ApiResponse<Payment[]>> {
    return this.handleCall(
      supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at')
    );
  }

  async processPayment(input: ProcessPaymentInput, userId: string): Promise<ApiResponse<Payment[]>> {
    const payments: Omit<Payment, 'id' | 'version' | 'created_at' | 'updated_at'>[] = input.splits.map(split => ({
      restaurant_id: '' as string, // will be filled by RLS
      order_id: input.order_id,
      payment_method_id: split.payment_method_id,
      payment_method_name: split.payment_method_name,
      amount: split.amount,
      status: 'success' as const,
      transaction_reference: null,
      refund_amount: null,
      refund_method: null,
      refund_status: null,
      refund_reason: null,
      refund_notes: null,
      refunded_at: null,
      refunded_by: null,
      refund_approved_by: null,
      created_by: userId,
    }));

    const paidAmount = input.splits.reduce((sum, s) => sum + s.amount, 0);
    const paymentStatus = paidAmount >= input.total_amount ? 'paid' : 'partially_paid';

    // Insert payments
    const { data: paymentData, error: paymentError } = await supabase
      .from('payments')
      .insert(payments)
      .select();

    if (paymentError) return this.createClientError(paymentError.message);

    // Update order payment status and complete if fully paid
    const orderUpdate: Record<string, unknown> = { payment_status: paymentStatus };
    if (paymentStatus === 'paid') {
      orderUpdate.status = 'completed';
    }

    await supabase.from('orders').update(orderUpdate).eq('id', input.order_id);

    return { success: true, message: 'Payment processed', data: paymentData, error: null };
  }

  async processRefund(input: RefundInput, userId: string): Promise<ApiResponse<Payment>> {
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', input.payment_id)
      .single();

    if (fetchError || !payment) return this.createClientError('Payment not found', 'NOT_FOUND');
    if (!['success'].includes(payment.status)) return this.createClientError('Payment is not eligible for refund');

    return this.handleCall(
      supabase
        .from('payments')
        .update({
          status: input.refund_amount >= payment.amount ? 'refunded' : 'partially_refunded',
          refund_amount: input.refund_amount,
          refund_method: input.refund_method,
          refund_status: 'completed',
          refund_reason: input.refund_reason,
          refund_notes: input.refund_notes ?? null,
          refunded_at: new Date().toISOString(),
          refunded_by: userId,
          refund_approved_by: input.approved_by ?? null,
        })
        .eq('id', input.payment_id)
        .select()
        .single()
    );
  }
}

export const paymentService = new PaymentService();
