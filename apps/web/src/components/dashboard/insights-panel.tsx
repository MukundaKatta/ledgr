import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Lightbulb, TrendingUp, Bell } from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  cash_flow_alert: AlertCircle,
  spending_anomaly: AlertCircle,
  tax_tip: Lightbulb,
  invoice_reminder: Bell,
  forecast: TrendingUp,
  general: Lightbulb,
};

const colorMap: Record<string, string> = {
  info: 'text-blue-500 bg-blue-50',
  warning: 'text-amber-500 bg-amber-50',
  critical: 'text-red-500 bg-red-50',
};

export async function InsightsPanel({ orgId }: { orgId: string }) {
  const supabase = await createSupabaseServer();

  const { data: insights } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">AI Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(insights || []).length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No insights yet.</p>
            <p className="text-xs mt-1">Insights will appear as your data grows.</p>
          </div>
        ) : (
          (insights || []).map((insight) => {
            const Icon = iconMap[insight.insight_type] || Lightbulb;
            const colors = colorMap[insight.severity] || colorMap.info;
            return (
              <div key={insight.id} className="flex gap-3 p-3 rounded-lg bg-gray-50">
                <div className={`p-2 rounded-lg ${colors} shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{insight.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{insight.body}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
