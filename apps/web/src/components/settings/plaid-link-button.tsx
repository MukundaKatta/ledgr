'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function PlaidLinkButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function getLinkToken() {
    setLoading(true);
    try {
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: orgId }),
      });
      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Failed to get link token:', error);
    } finally {
      setLoading(false);
    }
  }

  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      try {
        await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_token: publicToken,
            organization_id: orgId,
            institution: metadata.institution,
            accounts: metadata.accounts,
          }),
        });
        router.refresh();
      } catch (error) {
        console.error('Failed to exchange token:', error);
      }
    },
    [orgId, router]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLinkToken(null),
  });

  if (linkToken) {
    return (
      <Button onClick={() => open()} disabled={!ready}>
        <Plus className="h-4 w-4 mr-2" />
        Connect Account
      </Button>
    );
  }

  return (
    <Button onClick={getLinkToken} disabled={loading}>
      <Plus className="h-4 w-4 mr-2" />
      {loading ? 'Loading...' : 'Add Bank Account'}
    </Button>
  );
}
