import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatCurrency, getCurrentTaxYear } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, CheckCircle2, Clock, AlertTriangle, Receipt } from 'lucide-react';

const QUARTER_DUE_DATES: Record<number, string> = {
  1: 'April 15',
  2: 'June 15',
  3: 'September 15',
  4: 'January 15 (next year)',
};

export default async function TaxesPage() {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) redirect('/auth/signup');
  const orgId = membership.organization_id;
  const taxYear = getCurrentTaxYear();

  // Get tax estimates
  const { data: estimates } = await supabase
    .from('tax_estimates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('tax_year', taxYear)
    .order('quarter');

  // Get deductions
  const { data: deductions } = await supabase
    .from('tax_deductions')
    .select('*')
    .eq('organization_id', orgId)
    .eq('tax_year', taxYear)
    .order('amount', { ascending: false });

  const totalTax = (estimates || []).reduce((s, e) => s + Number(e.total_estimated_tax), 0) / (estimates?.length || 1);
  const totalPaid = (estimates || []).reduce((s, e) => s + Number(e.paid_amount), 0);
  const totalDeductions = (deductions || [])
    .filter((d) => d.status === 'confirmed')
    .reduce((s, d) => s + Number(d.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tax Center</h1>
        <p className="text-gray-500">{taxYear} estimated taxes and deductions</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Estimated Annual Tax</CardTitle>
            <Calculator className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalTax)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Paid So Far</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Remaining</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(Math.max(0, totalTax - totalPaid))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Deductions</CardTitle>
            <Receipt className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{formatCurrency(totalDeductions)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="quarterly">
        <TabsList>
          <TabsTrigger value="quarterly">Quarterly Estimates</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
        </TabsList>

        <TabsContent value="quarterly" className="space-y-4 mt-4">
          {(!estimates || estimates.length === 0) ? (
            <Card>
              <CardContent className="text-center py-12 text-gray-500">
                <Calculator className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No tax estimates yet. Add transactions to see quarterly estimates.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(estimates || []).map((est) => {
                const isPaid = est.is_paid;
                const isPastDue = !isPaid && new Date(est.due_date) < new Date();
                return (
                  <Card key={est.id} className={isPastDue ? 'border-red-200' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Q{est.quarter} {taxYear}</CardTitle>
                        {isPaid ? (
                          <Badge variant="success">Paid</Badge>
                        ) : isPastDue ? (
                          <Badge variant="destructive">Past Due</Badge>
                        ) : (
                          <Badge variant="outline">Due {QUARTER_DUE_DATES[est.quarter]}</Badge>
                        )}
                      </div>
                      <CardDescription>Due: {est.due_date}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Gross Income</span>
                          <span className="font-medium text-green-600">{formatCurrency(Number(est.gross_income))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Expenses</span>
                          <span className="font-medium text-red-600">-{formatCurrency(Number(est.total_expenses))}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-500">Net Income</span>
                          <span className="font-medium">{formatCurrency(Number(est.net_income))}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Self-Employment Tax</span>
                          <span>{formatCurrency(Number(est.self_employment_tax))}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Federal Income Tax</span>
                          <span>{formatCurrency(Number(est.federal_income_tax))}</span>
                        </div>
                        {Number(est.state_income_tax) > 0 && (
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>State Income Tax</span>
                            <span>{formatCurrency(Number(est.state_income_tax))}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-2 font-bold">
                          <span>Quarterly Payment Due</span>
                          <span className="text-indigo-600">{formatCurrency(Number(est.quarterly_payment_due))}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="deductions" className="space-y-4 mt-4">
          {(!deductions || deductions.length === 0) ? (
            <Card>
              <CardContent className="text-center py-12 text-gray-500">
                <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No deductions found yet. Categorize your transactions to discover deductions.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(deductions || []).map((ded) => (
                <Card key={ded.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{ded.category}</span>
                        {ded.status === 'suggested' && (
                          <Badge variant="warning">Suggested</Badge>
                        )}
                        {ded.status === 'confirmed' && (
                          <Badge variant="success">Confirmed</Badge>
                        )}
                        {ded.source === 'ai_suggested' && (
                          <Badge variant="secondary" className="text-xs">AI</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{ded.description}</p>
                      {ded.schedule_line && (
                        <p className="text-xs text-gray-400 mt-0.5">Schedule C: {ded.schedule_line}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">{formatCurrency(Number(ded.amount))}</div>
                      <div className="text-xs text-gray-400">{(ded.transaction_ids || []).length} transactions</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
