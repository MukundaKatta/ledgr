import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@ledgr/supabase';

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  // From organization
  fromName: string;
  fromAddress: string;
  fromEmail: string;
  fromPhone: string;
  logoUrl?: string;
  // Client
  clientName: string;
  clientCompany?: string;
  clientAddress?: string;
  clientEmail?: string;
  // Items
  lineItems: LineItem[];
  // Totals
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  // Optional
  notes?: string;
  terms?: string;
  footer?: string;
  currency: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  dateRow: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 1,
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  addressBlock: {
    marginBottom: 20,
  },
  addressText: {
    fontSize: 10,
    color: '#4b5563',
    marginBottom: 1,
  },
  billTo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  billToBlock: {
    flex: 1,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center' },
  colRate: { flex: 1, textAlign: 'right' },
  colAmount: { flex: 1, textAlign: 'right' },
  headerText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  cellText: {
    fontSize: 10,
  },
  totalsSection: {
    alignItems: 'flex-end',
    marginBottom: 30,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: 250,
    paddingVertical: 4,
  },
  totalLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 16,
    color: '#6b7280',
  },
  totalValue: {
    width: 100,
    textAlign: 'right',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: 250,
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: '#4f46e5',
    marginTop: 4,
  },
  grandTotalLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 16,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  grandTotalValue: {
    width: 100,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  notesSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
});

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function InvoicePDF({ data }: { data: InvoiceData }) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: styles.headerLeft },
          React.createElement(Text, { style: styles.title }, 'INVOICE'),
          React.createElement(Text, { style: styles.invoiceNumber }, `#${data.invoiceNumber}`)
        ),
        React.createElement(
          View,
          { style: styles.headerRight },
          React.createElement(Text, { style: styles.dateRow }, `Issue Date: ${data.issueDate}`),
          React.createElement(Text, { style: styles.dateRow }, `Due Date: ${data.dueDate}`),
          data.amountPaid > 0
            ? React.createElement(
                Text,
                { style: { ...styles.dateRow, color: '#059669', fontWeight: 'bold', marginTop: 4 } },
                `Paid: ${formatCurrency(data.amountPaid, data.currency)}`
              )
            : null
        )
      ),
      // Bill from / Bill to
      React.createElement(
        View,
        { style: styles.billTo },
        React.createElement(
          View,
          { style: styles.billToBlock },
          React.createElement(Text, { style: styles.sectionTitle }, 'FROM'),
          React.createElement(Text, { style: styles.companyName }, data.fromName),
          data.fromAddress
            ? React.createElement(Text, { style: styles.addressText }, data.fromAddress)
            : null,
          React.createElement(Text, { style: styles.addressText }, data.fromEmail),
          data.fromPhone
            ? React.createElement(Text, { style: styles.addressText }, data.fromPhone)
            : null
        ),
        React.createElement(
          View,
          { style: styles.billToBlock },
          React.createElement(Text, { style: styles.sectionTitle }, 'BILL TO'),
          React.createElement(Text, { style: styles.companyName }, data.clientName),
          data.clientCompany
            ? React.createElement(Text, { style: styles.addressText }, data.clientCompany)
            : null,
          data.clientAddress
            ? React.createElement(Text, { style: styles.addressText }, data.clientAddress)
            : null,
          data.clientEmail
            ? React.createElement(Text, { style: styles.addressText }, data.clientEmail)
            : null
        )
      ),
      // Table header
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: { ...styles.headerText, ...styles.colDescription } }, 'DESCRIPTION'),
          React.createElement(Text, { style: { ...styles.headerText, ...styles.colQty } }, 'QTY'),
          React.createElement(Text, { style: { ...styles.headerText, ...styles.colRate } }, 'RATE'),
          React.createElement(Text, { style: { ...styles.headerText, ...styles.colAmount } }, 'AMOUNT')
        ),
        // Table rows
        ...data.lineItems.map((item, i) =>
          React.createElement(
            View,
            { style: styles.tableRow, key: String(i) },
            React.createElement(Text, { style: { ...styles.cellText, ...styles.colDescription } }, item.description),
            React.createElement(Text, { style: { ...styles.cellText, ...styles.colQty } }, String(item.quantity)),
            React.createElement(
              Text,
              { style: { ...styles.cellText, ...styles.colRate } },
              formatCurrency(item.unitPrice, data.currency)
            ),
            React.createElement(
              Text,
              { style: { ...styles.cellText, ...styles.colAmount } },
              formatCurrency(item.amount, data.currency)
            )
          )
        )
      ),
      // Totals
      React.createElement(
        View,
        { style: styles.totalsSection },
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Subtotal'),
          React.createElement(Text, { style: styles.totalValue }, formatCurrency(data.subtotal, data.currency))
        ),
        data.taxRate > 0
          ? React.createElement(
              View,
              { style: styles.totalRow },
              React.createElement(Text, { style: styles.totalLabel }, `Tax (${(data.taxRate * 100).toFixed(1)}%)`),
              React.createElement(Text, { style: styles.totalValue }, formatCurrency(data.taxAmount, data.currency))
            )
          : null,
        data.discountAmount > 0
          ? React.createElement(
              View,
              { style: styles.totalRow },
              React.createElement(Text, { style: styles.totalLabel }, 'Discount'),
              React.createElement(
                Text,
                { style: { ...styles.totalValue, color: '#dc2626' } },
                `-${formatCurrency(data.discountAmount, data.currency)}`
              )
            )
          : null,
        React.createElement(
          View,
          { style: styles.grandTotal },
          React.createElement(Text, { style: styles.grandTotalLabel }, 'Amount Due'),
          React.createElement(Text, { style: styles.grandTotalValue }, formatCurrency(data.amountDue, data.currency))
        )
      ),
      // Notes
      data.notes || data.terms
        ? React.createElement(
            View,
            { style: styles.notesSection },
            data.notes
              ? React.createElement(
                  View,
                  { style: { marginBottom: data.terms ? 8 : 0 } },
                  React.createElement(Text, { style: styles.notesTitle }, 'Notes'),
                  React.createElement(Text, { style: styles.notesText }, data.notes)
                )
              : null,
            data.terms
              ? React.createElement(
                  View,
                  null,
                  React.createElement(Text, { style: styles.notesTitle }, 'Terms'),
                  React.createElement(Text, { style: styles.notesText }, data.terms)
                )
              : null
          )
        : null,
      // Footer
      data.footer
        ? React.createElement(Text, { style: styles.footer }, data.footer)
        : React.createElement(Text, { style: styles.footer }, 'Thank you for your business!')
    )
  );
}

export class InvoiceGenerator {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * Generate a PDF buffer for the given invoice.
   */
  async generatePDF(invoiceId: string): Promise<Buffer> {
    const data = await this.getInvoiceData(invoiceId);
    const element = React.createElement(InvoicePDF, { data });
    const buffer = await renderToBuffer(element);
    return Buffer.from(buffer);
  }

  /**
   * Generate PDF and upload to Supabase Storage.
   */
  async generateAndUpload(invoiceId: string, organizationId: string): Promise<string> {
    const pdfBuffer = await this.generatePDF(invoiceId);
    const fileName = `invoices/${organizationId}/${invoiceId}.pdf`;

    const { error: uploadError } = await this.supabase.storage
      .from('documents')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    const { data: urlData } = this.supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    const pdfUrl = urlData.publicUrl;

    // Update invoice with PDF URL
    await this.supabase
      .from('invoices')
      .update({ pdf_url: pdfUrl })
      .eq('id', invoiceId);

    return pdfUrl;
  }

  /**
   * Get the next invoice number for the organization.
   */
  async getNextInvoiceNumber(organizationId: string): Promise<string> {
    const { data } = await this.supabase
      .from('invoices')
      .select('invoice_number')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data?.length) {
      return 'INV-0001';
    }

    const lastNumber = data[0].invoice_number;
    const match = lastNumber.match(/(\d+)$/);

    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      const prefix = lastNumber.slice(0, -match[1].length);
      return `${prefix}${String(nextNum).padStart(match[1].length, '0')}`;
    }

    return `INV-${Date.now()}`;
  }

  private async getInvoiceData(invoiceId: string): Promise<InvoiceData> {
    const { data: invoice, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      throw new Error(`Invoice not found: ${error?.message}`);
    }

    const { data: lineItems } = await this.supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order');

    const { data: org } = await this.supabase
      .from('organizations')
      .select('*')
      .eq('id', invoice.organization_id)
      .single();

    const fromAddress = org
      ? [org.address_line1, org.address_line2, `${org.city || ''}, ${org.state || ''} ${org.zip || ''}`.trim()]
          .filter(Boolean)
          .join('\n')
      : '';

    return {
      invoiceNumber: invoice.invoice_number,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      fromName: org?.name || 'Your Business',
      fromAddress,
      fromEmail: org?.email || '',
      fromPhone: org?.phone || '',
      logoUrl: org?.logo_url || undefined,
      clientName: invoice.client_name,
      clientCompany: invoice.client_company || undefined,
      clientAddress: invoice.client_address || undefined,
      clientEmail: invoice.client_email || undefined,
      lineItems: (lineItems || []).map((li) => ({
        description: li.description,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unit_price),
        amount: Number(li.amount),
      })),
      subtotal: Number(invoice.subtotal),
      taxRate: Number(invoice.tax_rate),
      taxAmount: Number(invoice.tax_amount),
      discountAmount: Number(invoice.discount_amount),
      total: Number(invoice.total),
      amountPaid: Number(invoice.amount_paid),
      amountDue: Number(invoice.amount_due),
      notes: invoice.notes || undefined,
      terms: invoice.terms || undefined,
      footer: invoice.footer || undefined,
      currency: invoice.currency,
    };
  }
}
