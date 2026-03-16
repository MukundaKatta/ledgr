import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Sidebar } from '@/components/dashboard/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get user's organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name, subscription_plan)')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  const org = membership?.organizations as unknown as { id: string; name: string; subscription_plan: string } | null;

  return (
    <div className="flex h-screen">
      <Sidebar
        orgName={org?.name || 'My Business'}
        orgId={org?.id || ''}
        userEmail={user.email || ''}
        plan={org?.subscription_plan || 'starter'}
      />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
