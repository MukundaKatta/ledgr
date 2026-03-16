'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, RefreshCw, Trash2, Building2 } from 'lucide-react';
import { PlaidLinkButton } from '@/components/settings/plaid-link-button';

interface BankAccount {
  id: string;
  institution_name: string;
  account_name: string;
  account_type: string;
  mask: string | null;
  current_balance: number;
  available_balance: number | null;
  last_synced_at: string | null;
  is_active: boolean;
}

export function BankAccountsList({ accounts, orgId }: { accounts: BankAccount[]; orgId: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>Bank and credit card accounts linked via Plaid</CardDescription>
          </div>
          <PlaidLinkButton orgId={orgId} />
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No bank accounts connected.</p>
              <p className="text-sm mt-1">Connect a bank account to start syncing transactions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-white"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="font-medium">{account.institution_name}</div>
                      <div className="text-sm text-gray-500">
                        {account.account_name}
                        {account.mask && ` ****${account.mask}`}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {account.account_type}
                        </Badge>
                        {account.last_synced_at && (
                          <span className="text-xs text-gray-400">
                            Last synced: {formatDate(account.last_synced_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {formatCurrency(Number(account.current_balance))}
                    </div>
                    {account.available_balance !== null && (
                      <div className="text-xs text-gray-500">
                        Available: {formatCurrency(Number(account.available_balance))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
