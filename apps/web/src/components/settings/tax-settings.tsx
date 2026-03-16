'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

interface Props {
  org: any;
  orgId: string;
}

export function TaxSettings({ org, orgId }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState(org?.state || '');
  const [fiscalYearStart, setFiscalYearStart] = useState(String(org?.fiscal_year_start_month || 1));
  const [filingStatus, setFilingStatus] = useState('single');

  async function handleSave() {
    setLoading(true);
    await supabase
      .from('organizations')
      .update({
        state: state || null,
        fiscal_year_start_month: parseInt(fiscalYearStart, 10),
      })
      .eq('id', orgId);

    setLoading(false);
    router.refresh();
  }

  async function runTaxEstimate() {
    setLoading(true);
    try {
      await fetch('/api/tax/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgId,
          tax_year: new Date().getFullYear(),
          filing_status: filingStatus,
          state: state || undefined,
        }),
      });
      router.push('/taxes');
      router.refresh();
    } catch (error) {
      console.error('Tax estimate error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tax Configuration</CardTitle>
          <CardDescription>Set up your tax preferences for accurate quarterly estimates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filing Status</label>
              <Select value={filingStatus} onValueChange={setFilingStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married_filing_jointly">Married Filing Jointly</SelectItem>
                  <SelectItem value="married_filing_separately">Married Filing Separately</SelectItem>
                  <SelectItem value="head_of_household">Head of Household</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No state tax</SelectItem>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year Start</label>
              <Select value={fiscalYearStart} onValueChange={setFiscalYearStart}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {new Date(2024, i).toLocaleString('en', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3 justify-end">
            <Button variant="outline" onClick={runTaxEstimate} disabled={loading}>
              Calculate Tax Estimate
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
