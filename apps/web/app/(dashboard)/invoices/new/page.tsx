'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Send, Save } from 'lucide-react';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Payment is due within 30 days of receipt.');
  const [taxRate, setTaxRate] = useState(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ]);

  function addLineItem() {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0 }]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  async function handleSave(sendImmediately: boolean) {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!membership) return;

      // Generate invoice number
      const { data: lastInvoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('organization_id', membership.organization_id)
        .order('created_at', { ascending: false })
        .limit(1);

      let invoiceNumber = 'INV-0001';
      if (lastInvoice?.length) {
        const match = lastInvoice[0].invoice_number.match(/(\d+)$/);
        if (match) {
          invoiceNumber = `INV-${String(parseInt(match[1], 10) + 1).padStart(4, '0')}`;
        }
      }

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          organization_id: membership.organization_id,
          invoice_number: invoiceNumber,
          client_name: clientName,
          client_email: clientEmail || null,
          client_company: clientCompany || null,
          client_address: clientAddress || null,
          status: sendImmediately ? 'sent' : 'draft',
          issue_date: new Date().toISOString().split('T')[0],
          due_date: dueDate,
          subtotal,
          tax_rate: taxRate / 100,
          tax_amount: taxAmount,
          total,
          amount_due: total,
          notes: notes || null,
          terms: terms || null,
          sent_at: sendImmediately ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (invoiceError || !invoice) {
        console.error('Failed to create invoice:', invoiceError);
        setLoading(false);
        return;
      }

      // Create line items
      const items = lineItems
        .filter((item) => item.description && item.unitPrice > 0)
        .map((item, i) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          amount: item.quantity * item.unitPrice,
          sort_order: i,
        }));

      if (items.length > 0) {
        await supabase.from('invoice_line_items').insert(items);
      }

      router.push(`/invoices/${invoice.id}`);
      router.refresh();
    } catch (error) {
      console.error('Error creating invoice:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
        <p className="text-gray-500">Create and send a professional invoice</p>
      </div>

      {/* Client Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="John Doe" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <Input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="Acme Corp" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="123 Main St, City, ST 12345" />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-500 uppercase">
              <div className="col-span-6">Description</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Rate</div>
              <div className="col-span-1 text-right">Amount</div>
              <div className="col-span-1"></div>
            </div>
            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-6">
                  <Input
                    value={item.description}
                    onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                    placeholder="Service description"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateLineItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-1 text-right text-sm font-medium">
                  ${(item.quantity * item.unitPrice).toFixed(2)}
                </div>
                <div className="col-span-1">
                  <Button variant="ghost" size="icon" onClick={() => removeLineItem(i)} disabled={lineItems.length <= 1}>
                    <Trash2 className="h-4 w-4 text-gray-400" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-1" /> Add Line Item
            </Button>
          </div>

          {/* Totals */}
          <div className="mt-6 border-t pt-4 space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm gap-3">
              <span className="text-gray-500">Tax %</span>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="w-20 h-8"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
              <span className="font-medium">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-2">
              <span>Total</span>
              <span className="text-indigo-600">${total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thank you for your business" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
            <Input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms..." />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => handleSave(false)} disabled={loading || !clientName}>
          <Save className="h-4 w-4 mr-2" />
          Save Draft
        </Button>
        <Button onClick={() => handleSave(true)} disabled={loading || !clientName}>
          <Send className="h-4 w-4 mr-2" />
          Save & Send
        </Button>
      </div>
    </div>
  );
}
