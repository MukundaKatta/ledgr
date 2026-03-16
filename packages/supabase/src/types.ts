export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          legal_name: string | null;
          ein: string | null;
          business_type: BusinessType;
          fiscal_year_start_month: number;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          country: string;
          phone: string | null;
          email: string | null;
          website: string | null;
          logo_url: string | null;
          default_currency: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: SubscriptionStatus;
          subscription_plan: SubscriptionPlan;
          trial_ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          legal_name?: string | null;
          ein?: string | null;
          business_type?: BusinessType;
          fiscal_year_start_month?: number;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          country?: string;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          logo_url?: string | null;
          default_currency?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: SubscriptionStatus;
          subscription_plan?: SubscriptionPlan;
          trial_ends_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrgRole;
          invited_email: string | null;
          invited_at: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: OrgRole;
          invited_email?: string | null;
          invited_at?: string | null;
          accepted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['organization_members']['Insert']>;
      };
      bank_accounts: {
        Row: {
          id: string;
          organization_id: string;
          plaid_item_id: string | null;
          plaid_access_token: string | null;
          plaid_account_id: string | null;
          plaid_institution_id: string | null;
          institution_name: string;
          account_name: string;
          account_type: AccountType;
          account_subtype: string | null;
          mask: string | null;
          currency: string;
          current_balance: number;
          available_balance: number | null;
          credit_limit: number | null;
          last_synced_at: string | null;
          sync_cursor: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plaid_item_id?: string | null;
          plaid_access_token?: string | null;
          plaid_account_id?: string | null;
          plaid_institution_id?: string | null;
          institution_name: string;
          account_name: string;
          account_type: AccountType;
          account_subtype?: string | null;
          mask?: string | null;
          currency?: string;
          current_balance?: number;
          available_balance?: number | null;
          credit_limit?: number | null;
          last_synced_at?: string | null;
          sync_cursor?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['bank_accounts']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          type: CategoryType;
          parent_id: string | null;
          color: string;
          icon: string;
          is_tax_deductible: boolean;
          tax_schedule_line: string | null;
          is_system: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          type: CategoryType;
          parent_id?: string | null;
          color?: string;
          icon?: string;
          is_tax_deductible?: boolean;
          tax_schedule_line?: string | null;
          is_system?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          organization_id: string;
          bank_account_id: string | null;
          category_id: string | null;
          plaid_transaction_id: string | null;
          date: string;
          amount: number;
          description: string;
          original_description: string | null;
          merchant_name: string | null;
          pending: boolean;
          type: TransactionType;
          categorization_source: CategorizationSource;
          categorization_confidence: number | null;
          is_tax_deductible: boolean;
          tax_year: number | null;
          receipt_url: string | null;
          notes: string | null;
          is_reconciled: boolean;
          reconciled_invoice_id: string | null;
          is_excluded: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          bank_account_id?: string | null;
          category_id?: string | null;
          plaid_transaction_id?: string | null;
          date: string;
          amount: number;
          description: string;
          original_description?: string | null;
          merchant_name?: string | null;
          pending?: boolean;
          type?: TransactionType;
          categorization_source?: CategorizationSource;
          categorization_confidence?: number | null;
          is_tax_deductible?: boolean;
          tax_year?: number | null;
          receipt_url?: string | null;
          notes?: string | null;
          is_reconciled?: boolean;
          reconciled_invoice_id?: string | null;
          is_excluded?: boolean;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      categorization_rules: {
        Row: {
          id: string;
          organization_id: string;
          category_id: string;
          match_field: 'description' | 'merchant_name' | 'amount';
          match_type: 'contains' | 'starts_with' | 'ends_with' | 'exact' | 'regex';
          match_value: string;
          priority: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          category_id: string;
          match_field?: 'description' | 'merchant_name' | 'amount';
          match_type?: 'contains' | 'starts_with' | 'ends_with' | 'exact' | 'regex';
          match_value: string;
          priority?: number;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['categorization_rules']['Insert']>;
      };
      invoices: {
        Row: {
          id: string;
          organization_id: string;
          invoice_number: string;
          client_name: string;
          client_email: string | null;
          client_address: string | null;
          client_phone: string | null;
          client_company: string | null;
          status: InvoiceStatus;
          issue_date: string;
          due_date: string;
          currency: string;
          subtotal: number;
          tax_rate: number;
          tax_amount: number;
          discount_amount: number;
          total: number;
          amount_paid: number;
          amount_due: number;
          notes: string | null;
          terms: string | null;
          footer: string | null;
          pdf_url: string | null;
          sent_at: string | null;
          viewed_at: string | null;
          paid_at: string | null;
          last_reminder_at: string | null;
          reminder_count: number;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          invoice_number: string;
          client_name: string;
          client_email?: string | null;
          client_address?: string | null;
          client_phone?: string | null;
          client_company?: string | null;
          status?: InvoiceStatus;
          issue_date?: string;
          due_date: string;
          currency?: string;
          subtotal?: number;
          tax_rate?: number;
          tax_amount?: number;
          discount_amount?: number;
          total?: number;
          amount_paid?: number;
          amount_due?: number;
          notes?: string | null;
          terms?: string | null;
          footer?: string | null;
          pdf_url?: string | null;
          sent_at?: string | null;
          viewed_at?: string | null;
          paid_at?: string | null;
          last_reminder_at?: string | null;
          reminder_count?: number;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          amount: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          quantity?: number;
          unit_price: number;
          amount: number;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['invoice_line_items']['Insert']>;
      };
      invoice_payments: {
        Row: {
          id: string;
          invoice_id: string;
          transaction_id: string | null;
          amount: number;
          payment_date: string;
          payment_method: PaymentMethod;
          reference: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          transaction_id?: string | null;
          amount: number;
          payment_date?: string;
          payment_method?: PaymentMethod;
          reference?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['invoice_payments']['Insert']>;
      };
      tax_estimates: {
        Row: {
          id: string;
          organization_id: string;
          tax_year: number;
          quarter: number;
          gross_income: number;
          total_expenses: number;
          net_income: number;
          self_employment_tax: number;
          federal_income_tax: number;
          state_income_tax: number;
          total_estimated_tax: number;
          quarterly_payment_due: number;
          due_date: string;
          is_paid: boolean;
          paid_amount: number;
          paid_date: string | null;
          filing_status: FilingStatus;
          state: string | null;
          calculation_details: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          tax_year: number;
          quarter: number;
          gross_income?: number;
          total_expenses?: number;
          net_income?: number;
          self_employment_tax?: number;
          federal_income_tax?: number;
          state_income_tax?: number;
          total_estimated_tax?: number;
          quarterly_payment_due?: number;
          due_date: string;
          is_paid?: boolean;
          paid_amount?: number;
          paid_date?: string | null;
          filing_status?: FilingStatus;
          state?: string | null;
          calculation_details?: Record<string, unknown>;
        };
        Update: Partial<Database['public']['Tables']['tax_estimates']['Insert']>;
      };
      tax_deductions: {
        Row: {
          id: string;
          organization_id: string;
          tax_year: number;
          category: string;
          description: string;
          amount: number;
          schedule_line: string | null;
          source: 'manual' | 'ai_suggested' | 'auto_detected';
          status: 'suggested' | 'confirmed' | 'rejected';
          transaction_ids: string[];
          evidence_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          tax_year: number;
          category: string;
          description: string;
          amount: number;
          schedule_line?: string | null;
          source?: 'manual' | 'ai_suggested' | 'auto_detected';
          status?: 'suggested' | 'confirmed' | 'rejected';
          transaction_ids?: string[];
          evidence_notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tax_deductions']['Insert']>;
      };
      financial_reports: {
        Row: {
          id: string;
          organization_id: string;
          report_type: ReportType;
          period_start: string;
          period_end: string;
          data: Record<string, unknown>;
          generated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          report_type: ReportType;
          period_start: string;
          period_end: string;
          data: Record<string, unknown>;
          generated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['financial_reports']['Insert']>;
      };
      ai_insights: {
        Row: {
          id: string;
          organization_id: string;
          insight_type: InsightType;
          title: string;
          body: string;
          severity: 'info' | 'warning' | 'critical';
          is_read: boolean;
          is_dismissed: boolean;
          action_url: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          insight_type: InsightType;
          title: string;
          body: string;
          severity?: 'info' | 'warning' | 'critical';
          is_read?: boolean;
          is_dismissed?: boolean;
          action_url?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database['public']['Tables']['ai_insights']['Insert']>;
      };
    };
    Functions: {
      get_user_org_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      seed_default_categories: {
        Args: { org_id: string };
        Returns: void;
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type BusinessType =
  | 'sole_proprietorship' | 'llc' | 'llc_s_corp' | 'llc_c_corp'
  | 'partnership' | 's_corp' | 'c_corp';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
export type SubscriptionPlan = 'starter' | 'professional' | 'business';
export type OrgRole = 'owner' | 'admin' | 'bookkeeper' | 'viewer';
export type AccountType = 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'other';
export type CategoryType = 'income' | 'expense' | 'transfer' | 'tax_payment';
export type TransactionType = 'debit' | 'credit' | 'transfer';
export type CategorizationSource = 'manual' | 'ai' | 'rule' | 'uncategorized';
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'partial' | 'overdue' | 'canceled' | 'void';
export type PaymentMethod = 'bank_transfer' | 'check' | 'cash' | 'credit_card' | 'other';
export type FilingStatus = 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household';
export type ReportType = 'profit_loss' | 'balance_sheet' | 'cash_flow' | 'tax_summary' | 'expense_breakdown';
export type InsightType = 'cash_flow_alert' | 'spending_anomaly' | 'tax_tip' | 'invoice_reminder' | 'forecast' | 'general';
