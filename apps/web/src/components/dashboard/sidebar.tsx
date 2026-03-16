'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Calculator,
  BarChart3,
  TrendingUp,
  Settings,
  LogOut,
  CreditCard,
} from 'lucide-react';

interface SidebarProps {
  orgName: string;
  orgId: string;
  userEmail: string;
  plan: string;
}

const navItems = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/taxes', label: 'Taxes', icon: Calculator },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ orgName, orgId, userEmail, plan }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  return (
    <aside className="w-64 bg-white border-r flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <div>
            <div className="font-semibold text-sm text-gray-900 truncate max-w-[160px]">{orgName}</div>
            <div className="text-xs text-gray-500 capitalize">{plan} plan</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t">
        <div className="px-3 py-2">
          <div className="text-sm font-medium text-gray-900 truncate">{userEmail}</div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
