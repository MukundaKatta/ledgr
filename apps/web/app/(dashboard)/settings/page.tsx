import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BankAccountsList } from '@/components/settings/bank-accounts-list';
import { OrganizationSettings } from '@/components/settings/organization-settings';
import { TaxSettings } from '@/components/settings/tax-settings';

export default async function SettingsPage() {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) redirect('/auth/signup');
  const orgId = membership.organization_id;

  const [{ data: org }, { data: accounts }, { data: categories }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase.from('bank_accounts').select('*').eq('organization_id', orgId).order('created_at'),
    supabase.from('categories').select('*').eq('organization_id', orgId).order('sort_order'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your organization, bank accounts, and preferences</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="banking">Bank Accounts</TabsTrigger>
          <TabsTrigger value="tax">Tax Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <OrganizationSettings org={org} orgId={orgId} />
        </TabsContent>

        <TabsContent value="banking" className="mt-4">
          <BankAccountsList accounts={accounts || []} orgId={orgId} />
        </TabsContent>

        <TabsContent value="tax" className="mt-4">
          <TaxSettings org={org} orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
