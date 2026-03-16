import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@ledgr/supabase';

export interface ReconciliationMatch {
  invoiceId: string;
  transactionId: string;
  confidence: number;
  matchType: 'exact_amount' | 'partial_amount' | 'reference_match' | 'client_match';
  suggestedAmount: number;
}

export class PaymentReconciler {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * Find potential invoice matches for unreconciled income transactions.
   */
  async findMatches(organizationId: string): Promise<ReconciliationMatch[]> {
    // Get unreconciled income transactions
    const { data: transactions } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_reconciled', false)
      .eq('is_excluded', false)
      .gt('amount', 0)
      .order('date', { ascending: false })
      .limit(200);

    if (!transactions?.length) return [];

    // Get outstanding invoices
    const { data: invoices } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('organization_id', organizationId)
      .in('status', ['sent', 'viewed', 'partial', 'overdue'])
      .order('due_date');

    if (!invoices?.length) return [];

    const matches: ReconciliationMatch[] = [];

    for (const tx of transactions) {
      for (const invoice of invoices) {
        const matchResult = this.scoreMatch(tx, invoice);
        if (matchResult && matchResult.confidence >= 0.5) {
          matches.push(matchResult);
        }
      }
    }

    // Sort by confidence descending, deduplicate (one match per transaction)
    matches.sort((a, b) => b.confidence - a.confidence);

    const usedTransactions = new Set<string>();
    const usedInvoices = new Set<string>();
    const dedupedMatches: ReconciliationMatch[] = [];

    for (const match of matches) {
      if (!usedTransactions.has(match.transactionId) && !usedInvoices.has(match.invoiceId)) {
        dedupedMatches.push(match);
        usedTransactions.add(match.transactionId);
        // Allow multiple transactions to match one invoice (partial payments)
        if (match.matchType === 'exact_amount') {
          usedInvoices.add(match.invoiceId);
        }
      }
    }

    return dedupedMatches;
  }

  private scoreMatch(
    transaction: Tables<'transactions'>,
    invoice: Tables<'invoices'>
  ): ReconciliationMatch | null {
    let confidence = 0;
    let matchType: ReconciliationMatch['matchType'] = 'client_match';
    const txAmount = Number(transaction.amount);
    const invoiceAmountDue = Number(invoice.amount_due);

    if (invoiceAmountDue <= 0) return null;

    // Exact amount match (strongest signal)
    if (Math.abs(txAmount - invoiceAmountDue) < 0.01) {
      confidence += 0.6;
      matchType = 'exact_amount';
    } else if (Math.abs(txAmount - Number(invoice.total)) < 0.01) {
      confidence += 0.55;
      matchType = 'exact_amount';
    } else if (txAmount > 0 && txAmount <= invoiceAmountDue) {
      // Partial payment
      confidence += 0.3;
      matchType = 'partial_amount';
    } else {
      return null; // Amount doesn't make sense for this invoice
    }

    // Reference match - check if transaction contains invoice number
    const desc = (transaction.description + ' ' + (transaction.original_description || '')).toLowerCase();
    const invoiceNum = invoice.invoice_number.toLowerCase();

    if (desc.includes(invoiceNum)) {
      confidence += 0.3;
      matchType = 'reference_match';
    }

    // Client name match
    const clientName = invoice.client_name.toLowerCase();
    const merchantName = (transaction.merchant_name || '').toLowerCase();

    if (merchantName && clientName.includes(merchantName)) {
      confidence += 0.15;
    } else if (desc.includes(clientName.split(' ')[0])) {
      confidence += 0.1;
    }

    // Date proximity (closer to due date = slightly higher confidence)
    const txDate = new Date(transaction.date);
    const dueDate = new Date(invoice.due_date);
    const daysDiff = Math.abs(txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 7) confidence += 0.1;
    else if (daysDiff <= 30) confidence += 0.05;

    if (confidence < 0.5) return null;

    return {
      invoiceId: invoice.id,
      transactionId: transaction.id,
      confidence: Math.min(confidence, 1),
      matchType,
      suggestedAmount: Math.min(txAmount, invoiceAmountDue),
    };
  }

  /**
   * Apply a reconciliation match: create invoice payment, mark transaction reconciled.
   */
  async applyMatch(match: ReconciliationMatch): Promise<void> {
    const { data: transaction } = await this.supabase
      .from('transactions')
      .select('date, amount')
      .eq('id', match.transactionId)
      .single();

    if (!transaction) throw new Error('Transaction not found');

    // Create invoice payment
    const { error: paymentError } = await this.supabase
      .from('invoice_payments')
      .insert({
        invoice_id: match.invoiceId,
        transaction_id: match.transactionId,
        amount: match.suggestedAmount,
        payment_date: transaction.date,
        payment_method: 'bank_transfer',
        notes: `Auto-reconciled (confidence: ${Math.round(match.confidence * 100)}%)`,
      });

    if (paymentError) throw new Error(`Failed to create payment: ${paymentError.message}`);

    // Mark transaction as reconciled
    const { error: txError } = await this.supabase
      .from('transactions')
      .update({
        is_reconciled: true,
        reconciled_invoice_id: match.invoiceId,
      })
      .eq('id', match.transactionId);

    if (txError) throw new Error(`Failed to update transaction: ${txError.message}`);
  }

  /**
   * Auto-reconcile all high-confidence matches.
   */
  async autoReconcile(organizationId: string, minConfidence: number = 0.85): Promise<ReconciliationMatch[]> {
    const matches = await this.findMatches(organizationId);
    const applied: ReconciliationMatch[] = [];

    for (const match of matches) {
      if (match.confidence >= minConfidence) {
        try {
          await this.applyMatch(match);
          applied.push(match);
        } catch (error) {
          console.error(`Failed to apply match for invoice ${match.invoiceId}:`, error);
        }
      }
    }

    return applied;
  }
}
