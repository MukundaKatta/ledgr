import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@ledgr/supabase';

export interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  amountDue: number;
  dueDate: string;
  daysOverdue: number;
  reminderCount: number;
  lastReminderAt: string | null;
}

export interface ReminderResult {
  invoiceId: string;
  sent: boolean;
  error?: string;
}

export class InvoiceTracker {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * Get all overdue invoices for an organization.
   */
  async getOverdueInvoices(organizationId: string): Promise<OverdueInvoice[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data: invoices } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('organization_id', organizationId)
      .in('status', ['sent', 'viewed', 'partial', 'overdue'])
      .lt('due_date', today)
      .gt('amount_due', 0)
      .order('due_date');

    if (!invoices?.length) return [];

    return invoices.map((inv) => {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        clientName: inv.client_name,
        clientEmail: inv.client_email,
        amountDue: Number(inv.amount_due),
        dueDate: inv.due_date,
        daysOverdue: Math.max(0, daysOverdue),
        reminderCount: inv.reminder_count,
        lastReminderAt: inv.last_reminder_at,
      };
    });
  }

  /**
   * Get invoices that need a reminder sent.
   * Logic: send first reminder after 1 day overdue, then every 7 days, max 5 reminders.
   */
  async getInvoicesNeedingReminders(organizationId: string): Promise<OverdueInvoice[]> {
    const overdue = await this.getOverdueInvoices(organizationId);
    const now = Date.now();

    return overdue.filter((inv) => {
      if (inv.reminderCount >= 5) return false;
      if (!inv.clientEmail) return false;

      if (inv.reminderCount === 0 && inv.daysOverdue >= 1) {
        return true;
      }

      if (inv.lastReminderAt) {
        const daysSinceReminder = Math.floor(
          (now - new Date(inv.lastReminderAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceReminder >= 7;
      }

      return inv.daysOverdue >= 1;
    });
  }

  /**
   * Mark overdue invoices with the 'overdue' status.
   */
  async updateOverdueStatuses(organizationId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const { data } = await this.supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .eq('organization_id', organizationId)
      .in('status', ['sent', 'viewed'])
      .lt('due_date', today)
      .gt('amount_due', 0)
      .select('id');

    return data?.length || 0;
  }

  /**
   * Get invoice aging summary.
   */
  async getAgingSummary(organizationId: string): Promise<{
    current: number;
    overdue1to30: number;
    overdue31to60: number;
    overdue61to90: number;
    overdue90plus: number;
    totalOutstanding: number;
  }> {
    const today = new Date();
    const day30 = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0];
    const day60 = new Date(today.getTime() - 60 * 86400000).toISOString().split('T')[0];
    const day90 = new Date(today.getTime() - 90 * 86400000).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const { data: invoices } = await this.supabase
      .from('invoices')
      .select('due_date, amount_due')
      .eq('organization_id', organizationId)
      .in('status', ['sent', 'viewed', 'partial', 'overdue'])
      .gt('amount_due', 0);

    if (!invoices?.length) {
      return { current: 0, overdue1to30: 0, overdue31to60: 0, overdue61to90: 0, overdue90plus: 0, totalOutstanding: 0 };
    }

    let current = 0;
    let overdue1to30 = 0;
    let overdue31to60 = 0;
    let overdue61to90 = 0;
    let overdue90plus = 0;

    for (const inv of invoices) {
      const amount = Number(inv.amount_due);
      const due = inv.due_date;

      if (due >= todayStr) {
        current += amount;
      } else if (due >= day30) {
        overdue1to30 += amount;
      } else if (due >= day60) {
        overdue31to60 += amount;
      } else if (due >= day90) {
        overdue61to90 += amount;
      } else {
        overdue90plus += amount;
      }
    }

    const r = (n: number) => Math.round(n * 100) / 100;

    return {
      current: r(current),
      overdue1to30: r(overdue1to30),
      overdue31to60: r(overdue31to60),
      overdue61to90: r(overdue61to90),
      overdue90plus: r(overdue90plus),
      totalOutstanding: r(current + overdue1to30 + overdue31to60 + overdue61to90 + overdue90plus),
    };
  }

  /**
   * Get metrics for the invoice dashboard.
   */
  async getInvoiceMetrics(organizationId: string, periodStart: string, periodEnd: string) {
    const { data: invoices } = await this.supabase
      .from('invoices')
      .select('status, total, amount_paid, amount_due, issue_date, paid_at')
      .eq('organization_id', organizationId)
      .gte('issue_date', periodStart)
      .lte('issue_date', periodEnd);

    if (!invoices?.length) {
      return {
        totalInvoiced: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        invoiceCount: 0,
        paidCount: 0,
        overdueCount: 0,
        collectionRate: 0,
        averageDaysToPayment: 0,
      };
    }

    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let paidCount = 0;
    let overdueCount = 0;
    let totalDaysToPayment = 0;
    let paidWithDates = 0;

    for (const inv of invoices) {
      totalInvoiced += Number(inv.total);
      totalCollected += Number(inv.amount_paid);
      totalOutstanding += Number(inv.amount_due);

      if (inv.status === 'paid') {
        paidCount++;
        if (inv.paid_at && inv.issue_date) {
          const days = Math.floor(
            (new Date(inv.paid_at).getTime() - new Date(inv.issue_date).getTime()) / 86400000
          );
          totalDaysToPayment += days;
          paidWithDates++;
        }
      } else if (inv.status === 'overdue') {
        overdueCount++;
      }
    }

    const r = (n: number) => Math.round(n * 100) / 100;

    return {
      totalInvoiced: r(totalInvoiced),
      totalCollected: r(totalCollected),
      totalOutstanding: r(totalOutstanding),
      invoiceCount: invoices.length,
      paidCount,
      overdueCount,
      collectionRate: totalInvoiced > 0 ? r((totalCollected / totalInvoiced) * 100) : 0,
      averageDaysToPayment: paidWithDates > 0 ? Math.round(totalDaysToPayment / paidWithDates) : 0,
    };
  }
}
