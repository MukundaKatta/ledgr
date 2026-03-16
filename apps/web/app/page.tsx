import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <span className="text-xl font-bold text-gray-900">Ledgr</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/auth/signup">
            <Button>Start Free Trial</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 tracking-tight">
            Your AI
            <span className="text-indigo-600"> Financial Controller</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
            Ledgr automates bookkeeping, tax estimation, and financial reporting for solopreneurs
            and micro-businesses. Connect your bank, and let AI handle the rest.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/auth/signup">
              <Button size="lg" className="h-12 px-8 text-base">
                Start 14-Day Free Trial
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              title: 'Auto-Categorize',
              description: 'AI reads every transaction and categorizes it to the right expense bucket. Learn from your corrections.',
            },
            {
              title: 'Tax Estimates',
              description: 'Quarterly estimated tax calculations with Schedule C mapping. Never be surprised by a tax bill again.',
            },
            {
              title: 'Cash Flow Forecast',
              description: 'AI-powered predictions of your cash flow 30, 60, 90 days out based on your patterns and invoices.',
            },
            {
              title: 'Smart Invoicing',
              description: 'Create, send, and track professional invoices. Auto-reconcile payments when they hit your bank.',
            },
            {
              title: 'Deduction Finder',
              description: 'AI scans your transactions to find deductions you might be missing. Maximize your tax savings.',
            },
            {
              title: 'Real-time Reports',
              description: 'P&L, balance sheet, and cash flow statements generated from your live transaction data.',
            },
          ].map((feature) => (
            <div key={feature.title} className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-gray-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          Ledgr - AI-powered financial management for small businesses
        </div>
      </footer>
    </div>
  );
}
