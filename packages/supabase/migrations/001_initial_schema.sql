-- Ledgr: Complete database schema
-- Migration 001: Initial schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Organizations (multi-tenant root)
-- ============================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    legal_name TEXT,
    ein TEXT,                          -- Employer Identification Number
    business_type TEXT NOT NULL DEFAULT 'sole_proprietorship'
        CHECK (business_type IN (
            'sole_proprietorship', 'llc', 'llc_s_corp', 'llc_c_corp',
            'partnership', 's_corp', 'c_corp'
        )),
    fiscal_year_start_month INTEGER NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT NOT NULL DEFAULT 'US',
    phone TEXT,
    email TEXT,
    website TEXT,
    logo_url TEXT,
    default_currency TEXT NOT NULL DEFAULT 'USD',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT NOT NULL DEFAULT 'trialing'
        CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
    subscription_plan TEXT NOT NULL DEFAULT 'starter'
        CHECK (subscription_plan IN ('starter', 'professional', 'business')),
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Organization members
-- ============================================================
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner'
        CHECK (role IN ('owner', 'admin', 'bookkeeper', 'viewer')),
    invited_email TEXT,
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- ============================================================
-- Bank accounts (Plaid-linked)
-- ============================================================
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plaid_item_id TEXT,
    plaid_access_token TEXT,              -- encrypted at rest via Supabase Vault
    plaid_account_id TEXT,
    plaid_institution_id TEXT,
    institution_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL
        CHECK (account_type IN ('checking', 'savings', 'credit', 'loan', 'investment', 'other')),
    account_subtype TEXT,
    mask TEXT,                             -- last 4 digits
    currency TEXT NOT NULL DEFAULT 'USD',
    current_balance NUMERIC(15,2) DEFAULT 0,
    available_balance NUMERIC(15,2),
    credit_limit NUMERIC(15,2),
    last_synced_at TIMESTAMPTZ,
    sync_cursor TEXT,                      -- Plaid transaction sync cursor
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_org ON bank_accounts(organization_id);

-- ============================================================
-- Categories (chart of accounts lite)
-- ============================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL
        CHECK (type IN ('income', 'expense', 'transfer', 'tax_payment')),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'tag',
    is_tax_deductible BOOLEAN NOT NULL DEFAULT false,
    tax_schedule_line TEXT,                -- e.g., 'schedule_c_line_8' for advertising
    is_system BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name, type)
);

CREATE INDEX idx_categories_org ON categories(organization_id);

-- ============================================================
-- Transactions
-- ============================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    plaid_transaction_id TEXT,
    date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,         -- negative = expense, positive = income
    description TEXT NOT NULL,
    original_description TEXT,             -- raw from bank
    merchant_name TEXT,
    pending BOOLEAN NOT NULL DEFAULT false,
    type TEXT NOT NULL DEFAULT 'debit'
        CHECK (type IN ('debit', 'credit', 'transfer')),
    categorization_source TEXT DEFAULT 'uncategorized'
        CHECK (categorization_source IN ('manual', 'ai', 'rule', 'uncategorized')),
    categorization_confidence NUMERIC(3,2),  -- 0.00-1.00
    is_tax_deductible BOOLEAN NOT NULL DEFAULT false,
    tax_year INTEGER,
    receipt_url TEXT,
    notes TEXT,
    is_reconciled BOOLEAN NOT NULL DEFAULT false,
    reconciled_invoice_id UUID,
    is_excluded BOOLEAN NOT NULL DEFAULT false,  -- exclude from reports
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_org_date ON transactions(organization_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_bank ON transactions(bank_account_id);
CREATE INDEX idx_transactions_plaid ON transactions(plaid_transaction_id);
CREATE INDEX idx_transactions_uncategorized ON transactions(organization_id)
    WHERE categorization_source = 'uncategorized';

-- ============================================================
-- Categorization rules (user-defined)
-- ============================================================
CREATE TABLE categorization_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    match_field TEXT NOT NULL DEFAULT 'description'
        CHECK (match_field IN ('description', 'merchant_name', 'amount')),
    match_type TEXT NOT NULL DEFAULT 'contains'
        CHECK (match_type IN ('contains', 'starts_with', 'ends_with', 'exact', 'regex')),
    match_value TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rules_org ON categorization_rules(organization_id);

-- ============================================================
-- Invoices
-- ============================================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_address TEXT,
    client_phone TEXT,
    client_company TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'canceled', 'void')),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5,4) DEFAULT 0,
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total NUMERIC(15,2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
    amount_due NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    terms TEXT,
    footer TEXT,
    pdf_url TEXT,
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    last_reminder_at TIMESTAMPTZ,
    reminder_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, invoice_number)
);

CREATE INDEX idx_invoices_org_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_due ON invoices(due_date) WHERE status NOT IN ('paid', 'canceled', 'void');

-- ============================================================
-- Invoice line items
-- ============================================================
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15,2) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);

-- ============================================================
-- Invoice payments
-- ============================================================
CREATE TABLE invoice_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    amount NUMERIC(15,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT DEFAULT 'bank_transfer'
        CHECK (payment_method IN ('bank_transfer', 'check', 'cash', 'credit_card', 'other')),
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_payments ON invoice_payments(invoice_id);

-- ============================================================
-- Tax estimates
-- ============================================================
CREATE TABLE tax_estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tax_year INTEGER NOT NULL,
    quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
    gross_income NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
    net_income NUMERIC(15,2) NOT NULL DEFAULT 0,
    self_employment_tax NUMERIC(15,2) NOT NULL DEFAULT 0,
    federal_income_tax NUMERIC(15,2) NOT NULL DEFAULT 0,
    state_income_tax NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_estimated_tax NUMERIC(15,2) NOT NULL DEFAULT 0,
    quarterly_payment_due NUMERIC(15,2) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    paid_date DATE,
    filing_status TEXT NOT NULL DEFAULT 'single'
        CHECK (filing_status IN ('single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household')),
    state TEXT,
    calculation_details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, tax_year, quarter)
);

CREATE INDEX idx_tax_estimates_org ON tax_estimates(organization_id, tax_year);

-- ============================================================
-- Tax deductions
-- ============================================================
CREATE TABLE tax_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tax_year INTEGER NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    schedule_line TEXT,                    -- IRS form line reference
    source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'ai_suggested', 'auto_detected')),
    status TEXT NOT NULL DEFAULT 'suggested'
        CHECK (status IN ('suggested', 'confirmed', 'rejected')),
    transaction_ids UUID[] DEFAULT '{}',
    evidence_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deductions_org ON tax_deductions(organization_id, tax_year);

-- ============================================================
-- Financial reports (cached)
-- ============================================================
CREATE TABLE financial_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL
        CHECK (report_type IN ('profit_loss', 'balance_sheet', 'cash_flow', 'tax_summary', 'expense_breakdown')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_org ON financial_reports(organization_id, report_type, period_start);

-- ============================================================
-- AI insights / conversation log
-- ============================================================
CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL
        CHECK (insight_type IN ('cash_flow_alert', 'spending_anomaly', 'tax_tip', 'invoice_reminder', 'forecast', 'general')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info'
        CHECK (severity IN ('info', 'warning', 'critical')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_dismissed BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insights_org ON ai_insights(organization_id, created_at DESC);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$;

-- Organizations: members can read their orgs
CREATE POLICY "Users can view their organizations"
    ON organizations FOR SELECT
    USING (id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owners can update their organizations"
    ON organizations FOR UPDATE
    USING (id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

CREATE POLICY "Authenticated users can create organizations"
    ON organizations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Organization members
CREATE POLICY "Members can view their org members"
    ON organization_members FOR SELECT
    USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Admins can manage members"
    ON organization_members FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Apply standard org-scoped RLS to all data tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'bank_accounts', 'categories', 'transactions', 'categorization_rules',
            'invoices', 'tax_estimates', 'tax_deductions', 'financial_reports', 'ai_insights'
        ])
    LOOP
        EXECUTE format(
            'CREATE POLICY "Org members can view %I" ON %I FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()))',
            tbl, tbl
        );
        EXECUTE format(
            'CREATE POLICY "Org members can insert %I" ON %I FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_org_ids()))',
            tbl, tbl
        );
        EXECUTE format(
            'CREATE POLICY "Org members can update %I" ON %I FOR UPDATE USING (organization_id IN (SELECT get_user_org_ids()))',
            tbl, tbl
        );
        EXECUTE format(
            'CREATE POLICY "Org members can delete %I" ON %I FOR DELETE USING (organization_id IN (SELECT get_user_org_ids()))',
            tbl, tbl
        );
    END LOOP;
END $$;

-- Invoice line items and payments: accessible via invoice ownership
CREATE POLICY "Org members can view invoice_line_items"
    ON invoice_line_items FOR SELECT
    USING (invoice_id IN (
        SELECT id FROM invoices WHERE organization_id IN (SELECT get_user_org_ids())
    ));

CREATE POLICY "Org members can manage invoice_line_items"
    ON invoice_line_items FOR ALL
    USING (invoice_id IN (
        SELECT id FROM invoices WHERE organization_id IN (SELECT get_user_org_ids())
    ));

CREATE POLICY "Org members can view invoice_payments"
    ON invoice_payments FOR SELECT
    USING (invoice_id IN (
        SELECT id FROM invoices WHERE organization_id IN (SELECT get_user_org_ids())
    ));

CREATE POLICY "Org members can manage invoice_payments"
    ON invoice_payments FOR ALL
    USING (invoice_id IN (
        SELECT id FROM invoices WHERE organization_id IN (SELECT get_user_org_ids())
    ));

-- ============================================================
-- Seed default categories
-- ============================================================
CREATE OR REPLACE FUNCTION seed_default_categories(org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO categories (organization_id, name, type, is_tax_deductible, tax_schedule_line, is_system, sort_order) VALUES
    -- Income
    (org_id, 'Services Revenue', 'income', false, 'schedule_c_line_1', true, 1),
    (org_id, 'Product Sales', 'income', false, 'schedule_c_line_1', true, 2),
    (org_id, 'Interest Income', 'income', false, NULL, true, 3),
    (org_id, 'Other Income', 'income', false, 'schedule_c_line_6', true, 4),
    -- Expenses
    (org_id, 'Advertising & Marketing', 'expense', true, 'schedule_c_line_8', true, 10),
    (org_id, 'Car & Truck Expenses', 'expense', true, 'schedule_c_line_9', true, 11),
    (org_id, 'Commissions & Fees', 'expense', true, 'schedule_c_line_10', true, 12),
    (org_id, 'Contract Labor', 'expense', true, 'schedule_c_line_11', true, 13),
    (org_id, 'Insurance', 'expense', true, 'schedule_c_line_15', true, 14),
    (org_id, 'Interest (Mortgage)', 'expense', true, 'schedule_c_line_16a', true, 15),
    (org_id, 'Interest (Other)', 'expense', true, 'schedule_c_line_16b', true, 16),
    (org_id, 'Legal & Professional Services', 'expense', true, 'schedule_c_line_17', true, 17),
    (org_id, 'Office Expenses', 'expense', true, 'schedule_c_line_18', true, 18),
    (org_id, 'Rent or Lease', 'expense', true, 'schedule_c_line_20b', true, 19),
    (org_id, 'Repairs & Maintenance', 'expense', true, 'schedule_c_line_21', true, 20),
    (org_id, 'Supplies', 'expense', true, 'schedule_c_line_22', true, 21),
    (org_id, 'Taxes & Licenses', 'expense', true, 'schedule_c_line_23', true, 22),
    (org_id, 'Travel', 'expense', true, 'schedule_c_line_24a', true, 23),
    (org_id, 'Meals (50%)', 'expense', true, 'schedule_c_line_24b', true, 24),
    (org_id, 'Utilities', 'expense', true, 'schedule_c_line_25', true, 25),
    (org_id, 'Wages', 'expense', true, 'schedule_c_line_26', true, 26),
    (org_id, 'Software & Subscriptions', 'expense', true, 'schedule_c_line_27a', true, 27),
    (org_id, 'Home Office', 'expense', true, 'schedule_c_line_30', true, 28),
    (org_id, 'Education & Training', 'expense', true, 'schedule_c_line_27a', true, 29),
    (org_id, 'Bank Fees', 'expense', true, 'schedule_c_line_27a', true, 30),
    (org_id, 'Uncategorized Expense', 'expense', false, NULL, true, 99),
    -- Transfers
    (org_id, 'Transfer', 'transfer', false, NULL, true, 100),
    (org_id, 'Owner Draw', 'transfer', false, NULL, true, 101),
    (org_id, 'Owner Contribution', 'transfer', false, NULL, true, 102),
    -- Tax
    (org_id, 'Estimated Tax Payment', 'tax_payment', false, NULL, true, 110);
END;
$$;

-- ============================================================
-- Auto-update updated_at columns
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_tax_estimates_updated_at BEFORE UPDATE ON tax_estimates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_tax_deductions_updated_at BEFORE UPDATE ON tax_deductions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Auto-seed categories on new organization
-- ============================================================
CREATE OR REPLACE FUNCTION on_organization_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM seed_default_categories(NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_organization_created
    AFTER INSERT ON organizations
    FOR EACH ROW EXECUTE FUNCTION on_organization_created();

-- ============================================================
-- Invoice totals auto-calculation
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_subtotal NUMERIC(15,2);
    v_paid NUMERIC(15,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_subtotal
    FROM invoice_line_items
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM invoice_payments
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    UPDATE invoices SET
        subtotal = v_subtotal,
        tax_amount = ROUND(v_subtotal * tax_rate, 2),
        total = v_subtotal + ROUND(v_subtotal * tax_rate, 2) - discount_amount,
        amount_paid = v_paid,
        amount_due = v_subtotal + ROUND(v_subtotal * tax_rate, 2) - discount_amount - v_paid,
        status = CASE
            WHEN v_paid >= v_subtotal + ROUND(v_subtotal * tax_rate, 2) - discount_amount THEN 'paid'
            WHEN v_paid > 0 THEN 'partial'
            ELSE status
        END,
        paid_at = CASE
            WHEN v_paid >= v_subtotal + ROUND(v_subtotal * tax_rate, 2) - discount_amount THEN NOW()
            ELSE paid_at
        END
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_line_items_recalc
    AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
    FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_totals();

CREATE TRIGGER tr_payments_recalc
    AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_totals();
