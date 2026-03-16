import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type LinkTokenCreateRequest,
  type ItemPublicTokenExchangeRequest,
  type TransactionsSyncRequest,
  type AccountsGetRequest,
} from 'plaid';

export interface PlaidLinkConfig {
  clientId: string;
  secret: string;
  env: 'sandbox' | 'development' | 'production';
}

export interface PlaidExchangeResult {
  accessToken: string;
  itemId: string;
}

export interface PlaidAccount {
  accountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  balances: {
    current: number | null;
    available: number | null;
    limit: number | null;
  };
}

export interface PlaidTransactionSyncResult {
  added: PlaidSyncTransaction[];
  modified: PlaidSyncTransaction[];
  removed: Array<{ transaction_id: string }>;
  nextCursor: string;
  hasMore: boolean;
}

export interface PlaidSyncTransaction {
  transactionId: string;
  date: string;
  amount: number;
  name: string;
  originalDescription: string | null;
  merchantName: string | null;
  pending: boolean;
  category: string[];
  personalFinanceCategory?: {
    primary: string;
    detailed: string;
  };
  paymentChannel: string;
}

export class PlaidLinkClient {
  private client: PlaidApi;
  private env: string;

  constructor(config: PlaidLinkConfig) {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[config.env],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': config.clientId,
          'PLAID-SECRET': config.secret,
        },
      },
    });

    this.client = new PlaidApi(configuration);
    this.env = config.env;
  }

  async createLinkToken(userId: string, redirectUri?: string): Promise<string> {
    const request: LinkTokenCreateRequest = {
      user: { client_user_id: userId },
      client_name: 'Ledgr',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      redirect_uri: redirectUri,
    };

    const response = await this.client.linkTokenCreate(request);
    return response.data.link_token;
  }

  async exchangePublicToken(publicToken: string): Promise<PlaidExchangeResult> {
    const request: ItemPublicTokenExchangeRequest = {
      public_token: publicToken,
    };

    const response = await this.client.itemPublicTokenExchange(request);
    return {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    };
  }

  async getAccounts(accessToken: string): Promise<PlaidAccount[]> {
    const request: AccountsGetRequest = { access_token: accessToken };
    const response = await this.client.accountsGet(request);

    return response.data.accounts.map((account) => ({
      accountId: account.account_id,
      name: account.name,
      officialName: account.official_name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      balances: {
        current: account.balances.current,
        available: account.balances.available,
        limit: account.balances.limit,
      },
    }));
  }

  async syncTransactions(
    accessToken: string,
    cursor?: string
  ): Promise<PlaidTransactionSyncResult> {
    const allAdded: PlaidSyncTransaction[] = [];
    const allModified: PlaidSyncTransaction[] = [];
    const allRemoved: Array<{ transaction_id: string }> = [];
    let nextCursor = cursor || '';
    let hasMore = true;

    while (hasMore) {
      const request: TransactionsSyncRequest = {
        access_token: accessToken,
        cursor: nextCursor || undefined,
        count: 500,
      };

      const response = await this.client.transactionsSync(request);
      const { data } = response;

      for (const tx of data.added) {
        allAdded.push({
          transactionId: tx.transaction_id,
          date: tx.date,
          amount: tx.amount,
          name: tx.name,
          originalDescription: tx.original_description || null,
          merchantName: tx.merchant_name || null,
          pending: tx.pending,
          category: tx.category || [],
          personalFinanceCategory: tx.personal_finance_category
            ? {
                primary: tx.personal_finance_category.primary,
                detailed: tx.personal_finance_category.detailed,
              }
            : undefined,
          paymentChannel: tx.payment_channel,
        });
      }

      for (const tx of data.modified) {
        allModified.push({
          transactionId: tx.transaction_id,
          date: tx.date,
          amount: tx.amount,
          name: tx.name,
          originalDescription: tx.original_description || null,
          merchantName: tx.merchant_name || null,
          pending: tx.pending,
          category: tx.category || [],
          personalFinanceCategory: tx.personal_finance_category
            ? {
                primary: tx.personal_finance_category.primary,
                detailed: tx.personal_finance_category.detailed,
              }
            : undefined,
          paymentChannel: tx.payment_channel,
        });
      }

      for (const tx of data.removed) {
        allRemoved.push({ transaction_id: tx.transaction_id! });
      }

      nextCursor = data.next_cursor;
      hasMore = data.has_more;
    }

    return {
      added: allAdded,
      modified: allModified,
      removed: allRemoved,
      nextCursor,
      hasMore: false,
    };
  }

  async removeItem(accessToken: string): Promise<void> {
    await this.client.itemRemove({ access_token: accessToken });
  }
}
