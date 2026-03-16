'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Send, Download, FileText } from 'lucide-react';

interface Props {
  invoiceId: string;
  status: string;
}

export function InvoiceActions({ invoiceId, status }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        console.error('Send failed:', data.error);
      }
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setSending(false);
    }
  }

  function handleDownloadPDF() {
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
        <Download className="h-4 w-4 mr-2" />
        PDF
      </Button>
      {['draft', 'sent', 'viewed', 'overdue'].includes(status) && (
        <Button size="sm" onClick={handleSend} disabled={sending}>
          <Send className="h-4 w-4 mr-2" />
          {sending ? 'Sending...' : status === 'draft' ? 'Send Invoice' : 'Resend'}
        </Button>
      )}
    </div>
  );
}
