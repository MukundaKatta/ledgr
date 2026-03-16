interface PlaidTransaction {
  transaction_id: string;
  date: string;
  amount: number;
  name: string;
  original_description?: string;
  merchant_name: string | null;
  pending: boolean;
  personal_finance_category?: {
    primary: string;
    detailed: string;
  };
  payment_channel: string;
  location?: Record<string, unknown>;
}

interface PlaidSyncResult {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: Array<{ transaction_id: string }>;
  next_cursor: string;
  has_more: boolean;
  accounts?: Array<{
    account_id: string;
    balances: {
      current: number | null;
      available: number | null;
    };
  }>;
}

export class PlaidClient {
  private baseUrl: string;
  private clientId: string;
  private secret: string;

  constructor(clientId: string, secret: string, env: 'sandbox' | 'development' | 'production') {
    this.clientId = clientId;
    this.secret = secret;
    this.baseUrl =
      env === 'production'
        ? 'https://production.plaid.com'
        : env === 'development'
          ? 'https://development.plaid.com'
          : 'https://sandbox.plaid.com';
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        secret: this.secret,
        ...body,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Plaid API error: ${error.error_message || response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async transactionsSync(accessToken: string, cursor?: string): Promise<PlaidSyncResult> {
    let allAdded: PlaidTransaction[] = [];
    let allModified: PlaidTransaction[] = [];
    let allRemoved: Array<{ transaction_id: string }> = [];
    let nextCursor = cursor || '';
    let hasMore = true;
    let accounts: PlaidSyncResult['accounts'];

    while (hasMore) {
      const result = await this.request<PlaidSyncResult>('/transactions/sync', {
        access_token: accessToken,
        cursor: nextCursor || undefined,
        count: 500,
      });

      allAdded = allAdded.concat(result.added);
      allModified = allModified.concat(result.modified);
      allRemoved = allRemoved.concat(result.removed);
      nextCursor = result.next_cursor;
      hasMore = result.has_more;
      if (result.accounts) accounts = result.accounts;
    }

    return {
      added: allAdded,
      modified: allModified,
      removed: allRemoved,
      next_cursor: nextCursor,
      has_more: false,
      accounts,
    };
  }

  async getAccounts(accessToken: string) {
    return this.request<{
      accounts: Array<{
        account_id: string;
        name: string;
        official_name: string | null;
        type: string;
        subtype: string | null;
        mask: string | null;
        balances: {
          current: number | null;
          available: number | null;
          limit: number | null;
        };
      }>;
    }>('/accounts/get', { access_token: accessToken });
  }
}
