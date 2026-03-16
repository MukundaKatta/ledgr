import sgMail from '@sendgrid/mail';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ledgr/supabase';

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class InvoiceSender {
  private supabase: SupabaseClient<Database>;
  private fromEmail: string;

  constructor(
    supabase: SupabaseClient<Database>,
    sendgridApiKey: string,
    fromEmail: string
  ) {
    this.supabase = supabase;
    this.fromEmail = fromEmail;
    sgMail.setApiKey(sendgridApiKey);
  }

  /**
   * Send an invoice to the client via email.
   */
  async sendInvoice(invoiceId: string): Promise<SendResult> {
    const { data: invoice, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return { success: false, error: `Invoice not found: ${error?.message}` };
    }

    if (!invoice.client_email) {
      return { success: false, error: 'No client email address on invoice' };
    }

    const { data: org } = await this.supabase
      .from('organizations')
      .select('name, email')
      .eq('id', invoice.organization_id)
      .single();

    const orgName = org?.name || 'Ledgr';
    const currency = invoice.currency || 'USD';
    const formattedTotal = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(Number(invoice.amount_due));

    // Build email
    const subject = `Invoice #${invoice.invoice_number} from ${orgName} - ${formattedTotal}`;

    const htmlContent = this.buildEmailHtml({
      orgName,
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client_name,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      amountDue: formattedTotal,
      notes: invoice.notes || undefined,
      pdfUrl: invoice.pdf_url || undefined,
      viewUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ledgr.io'}/invoices/view/${invoiceId}`,
    });

    const msg: sgMail.MailDataRequired = {
      to: invoice.client_email,
      from: {
        email: this.fromEmail,
        name: orgName,
      },
      replyTo: org?.email || this.fromEmail,
      subject,
      html: htmlContent,
      trackingSettings: {
        openTracking: { enable: true },
        clickTracking: { enable: true },
      },
    };

    // Attach PDF if available
    if (invoice.pdf_url) {
      try {
        const pdfResponse = await fetch(invoice.pdf_url);
        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer();
          const base64 = Buffer.from(pdfBuffer).toString('base64');
          msg.attachments = [
            {
              content: base64,
              filename: `invoice-${invoice.invoice_number}.pdf`,
              type: 'application/pdf',
              disposition: 'attachment',
            },
          ];
        }
      } catch (err) {
        console.warn('Could not attach PDF:', err);
      }
    }

    try {
      const [response] = await sgMail.send(msg);

      // Update invoice status
      await this.supabase
        .from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      return {
        success: true,
        messageId: response.headers['x-message-id'] as string,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown email error';
      console.error('SendGrid error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send a payment reminder for an overdue invoice.
   */
  async sendReminder(invoiceId: string): Promise<SendResult> {
    const { data: invoice, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return { success: false, error: `Invoice not found: ${error?.message}` };
    }

    if (!invoice.client_email) {
      return { success: false, error: 'No client email address' };
    }

    const { data: org } = await this.supabase
      .from('organizations')
      .select('name, email')
      .eq('id', invoice.organization_id)
      .single();

    const orgName = org?.name || 'Ledgr';
    const currency = invoice.currency || 'USD';
    const formattedDue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(Number(invoice.amount_due));

    const daysOverdue = Math.floor(
      (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    const subject = `Reminder: Invoice #${invoice.invoice_number} - ${formattedDue} overdue`;

    const htmlContent = this.buildReminderHtml({
      orgName,
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client_name,
      dueDate: invoice.due_date,
      amountDue: formattedDue,
      daysOverdue: Math.max(0, daysOverdue),
      viewUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ledgr.io'}/invoices/view/${invoiceId}`,
    });

    const msg: sgMail.MailDataRequired = {
      to: invoice.client_email,
      from: { email: this.fromEmail, name: orgName },
      replyTo: org?.email || this.fromEmail,
      subject,
      html: htmlContent,
    };

    try {
      await sgMail.send(msg);

      await this.supabase
        .from('invoices')
        .update({
          last_reminder_at: new Date().toISOString(),
          reminder_count: (invoice.reminder_count || 0) + 1,
          status: 'overdue',
        })
        .eq('id', invoiceId);

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Send failed' };
    }
  }

  private buildEmailHtml(params: {
    orgName: string;
    invoiceNumber: string;
    clientName: string;
    issueDate: string;
    dueDate: string;
    amountDue: string;
    notes?: string;
    pdfUrl?: string;
    viewUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#4f46e5;padding:32px;color:#fff;">
        <h1 style="margin:0;font-size:24px;">${params.orgName}</h1>
        <p style="margin:8px 0 0;opacity:0.9;">Invoice #${params.invoiceNumber}</p>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 16px;color:#374151;">Hi ${params.clientName},</p>
        <p style="margin:0 0 24px;color:#374151;">
          Please find your invoice details below. Payment is due by <strong>${params.dueDate}</strong>.
        </p>
        <div style="background:#f9fafb;border-radius:8px;padding:24px;margin:0 0 24px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#6b7280;">Invoice Date</span>
            <span style="color:#111827;font-weight:500;">${params.issueDate}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#6b7280;">Due Date</span>
            <span style="color:#111827;font-weight:500;">${params.dueDate}</span>
          </div>
          <div style="border-top:1px solid #e5e7eb;margin:12px 0;"></div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#111827;font-weight:600;font-size:16px;">Amount Due</span>
            <span style="color:#4f46e5;font-weight:700;font-size:20px;">${params.amountDue}</span>
          </div>
        </div>
        ${params.notes ? `<p style="margin:0 0 24px;color:#6b7280;font-size:14px;"><em>${params.notes}</em></p>` : ''}
        <a href="${params.viewUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;">
          View Invoice
        </a>
      </div>
      <div style="padding:16px 32px;background:#f9fafb;text-align:center;color:#9ca3af;font-size:12px;">
        Sent via Ledgr
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private buildReminderHtml(params: {
    orgName: string;
    invoiceNumber: string;
    clientName: string;
    dueDate: string;
    amountDue: string;
    daysOverdue: number;
    viewUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#dc2626;padding:32px;color:#fff;">
        <h1 style="margin:0;font-size:24px;">Payment Reminder</h1>
        <p style="margin:8px 0 0;opacity:0.9;">Invoice #${params.invoiceNumber} is ${params.daysOverdue} days overdue</p>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 16px;color:#374151;">Hi ${params.clientName},</p>
        <p style="margin:0 0 24px;color:#374151;">
          This is a friendly reminder that invoice #${params.invoiceNumber} for <strong>${params.amountDue}</strong>
          was due on <strong>${params.dueDate}</strong> and is now ${params.daysOverdue} days past due.
        </p>
        <p style="margin:0 0 24px;color:#374151;">
          If you have already sent payment, please disregard this notice. Otherwise, we would appreciate prompt payment.
        </p>
        <a href="${params.viewUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;">
          View &amp; Pay Invoice
        </a>
      </div>
      <div style="padding:16px 32px;background:#f9fafb;text-align:center;color:#9ca3af;font-size:12px;">
        Sent via Ledgr on behalf of ${params.orgName}
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}
