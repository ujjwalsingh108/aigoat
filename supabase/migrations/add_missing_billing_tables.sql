-- ============================================================================
-- MISSING SCHEMA FOR PRODUCTION-GRADE BILLING SYSTEM
-- ============================================================================

-- 1. Payment Events Table (Critical for audit trail and debugging)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  subscription_id uuid,
  event_type text NOT NULL, -- 'payment.success', 'payment.failed', 'refund.initiated', etc.
  provider text NOT NULL DEFAULT 'payu', -- 'payu', 'stripe', 'razorpay'
  provider_event_id text UNIQUE, -- PayU transaction ID
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
  metadata jsonb DEFAULT '{}'::jsonb, -- Store full PayU response
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT payment_events_pkey PRIMARY KEY (id),
  CONSTRAINT payment_events_organization_id_fkey FOREIGN KEY (organization_id) 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT payment_events_subscription_id_fkey FOREIGN KEY (subscription_id) 
    REFERENCES public.subscriptions(id) ON DELETE SET NULL
);

-- Indexes for payment events
CREATE INDEX idx_payment_events_org_created 
  ON public.payment_events(organization_id, created_at DESC);
CREATE INDEX idx_payment_events_subscription 
  ON public.payment_events(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX idx_payment_events_provider_id 
  ON public.payment_events(provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX idx_payment_events_status 
  ON public.payment_events(status, created_at DESC);

COMMENT ON TABLE public.payment_events IS 'Immutable log of all payment transactions for audit trail';


-- 2. Subscription History (Track all changes to subscriptions)
CREATE TABLE IF NOT EXISTS public.subscription_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  old_plan_id uuid,
  action text NOT NULL, -- 'created', 'upgraded', 'downgraded', 'canceled', 'renewed', 'expired'
  status text NOT NULL,
  old_status text,
  effective_date timestamp with time zone NOT NULL,
  changed_by uuid, -- User who made the change (if applicable)
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT subscription_history_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_history_subscription_id_fkey FOREIGN KEY (subscription_id) 
    REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT subscription_history_organization_id_fkey FOREIGN KEY (organization_id) 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT subscription_history_plan_id_fkey FOREIGN KEY (plan_id) 
    REFERENCES public.billing_plans(id),
  CONSTRAINT subscription_history_changed_by_fkey FOREIGN KEY (changed_by) 
    REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_subscription_history_sub_created 
  ON public.subscription_history(subscription_id, created_at DESC);
CREATE INDEX idx_subscription_history_org_created 
  ON public.subscription_history(organization_id, created_at DESC);

COMMENT ON TABLE public.subscription_history IS 'Immutable audit log of subscription lifecycle changes';


-- 3. Invoices Table (Required for billing reconciliation)
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  subscription_id uuid,
  invoice_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- 'draft', 'pending', 'paid', 'failed', 'refunded'
  amount_cents integer NOT NULL,
  tax_cents integer DEFAULT 0,
  total_cents integer NOT NULL, -- amount_cents + tax_cents
  currency text NOT NULL DEFAULT 'INR',
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  due_date date NOT NULL,
  paid_at timestamp with time zone,
  provider_invoice_id text, -- PayU invoice reference
  payment_event_id uuid, -- Link to successful payment
  metadata jsonb DEFAULT '{}'::jsonb, -- Line items, tax details, etc.
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) 
    REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  CONSTRAINT invoices_payment_event_id_fkey FOREIGN KEY (payment_event_id) 
    REFERENCES public.payment_events(id) ON DELETE SET NULL
);

CREATE INDEX idx_invoices_org_created 
  ON public.invoices(organization_id, created_at DESC);
CREATE INDEX idx_invoices_subscription 
  ON public.invoices(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX idx_invoices_status_due 
  ON public.invoices(status, due_date) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_invoices_number 
  ON public.invoices(invoice_number);

COMMENT ON TABLE public.invoices IS 'Billing invoices with line items and tax details';


-- 4. Webhook Events (Critical for PayU integration reliability)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'payu',
  event_type text NOT NULL,
  event_id text, -- Provider's event ID
  payload jsonb NOT NULL, -- Full webhook payload
  processed boolean DEFAULT false,
  processed_at timestamp with time zone,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_webhook_events_processed 
  ON public.webhook_events(processed, created_at) WHERE NOT processed;
CREATE INDEX idx_webhook_events_provider_type 
  ON public.webhook_events(provider, event_type, created_at DESC);
CREATE INDEX idx_webhook_events_event_id 
  ON public.webhook_events(event_id) WHERE event_id IS NOT NULL;

COMMENT ON TABLE public.webhook_events IS 'Idempotent webhook event queue with retry logic';


-- 5. Usage Quota Tracking (Daily aggregated usage per organization)
CREATE TABLE IF NOT EXISTS public.usage_quotas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  metric_type text NOT NULL, -- 'ai_prompts', 'predictions', 'api_calls', 'groq_tokens'
  date date NOT NULL DEFAULT CURRENT_DATE,
  count integer DEFAULT 0,
  limit_amount integer, -- Daily limit from plan
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT usage_quotas_pkey PRIMARY KEY (id),
  CONSTRAINT usage_quotas_organization_id_fkey FOREIGN KEY (organization_id) 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT usage_quotas_org_metric_date_unique UNIQUE (organization_id, metric_type, date)
);

CREATE INDEX idx_usage_quotas_org_date 
  ON public.usage_quotas(organization_id, date DESC);
CREATE INDEX idx_usage_quotas_exceeded 
  ON public.usage_quotas(organization_id, metric_type, date) 
  WHERE count >= limit_amount AND limit_amount IS NOT NULL;

COMMENT ON TABLE public.usage_quotas IS 'Daily aggregated usage tracking with plan limits enforcement';


-- 6. Enhance subscriptions table with missing fields
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS trial_start_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS trial_end_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS current_period_start timestamp with time zone,
  ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS next_billing_date date,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at 
  BEFORE UPDATE ON public.subscriptions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at 
  BEFORE UPDATE ON public.invoices 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_quotas_updated_at ON public.usage_quotas;
CREATE TRIGGER update_usage_quotas_updated_at 
  BEFORE UPDATE ON public.usage_quotas 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 7. Billing Plans: Add structured features schema
COMMENT ON COLUMN public.billing_plans.features IS 
'Feature entitlements in JSON format:
{
  "ai_prompts_per_day": 100,
  "predictions_per_month": 500,
  "groq_tokens_per_month": 100000,
  "api_calls_per_day": 1000,
  "max_watchlists": 5,
  "max_symbols_per_watchlist": 50,
  "trading_strategies": ["option_strategy", "price_prediction", "technical_analysis"],
  "premium_tools": ["ai_screener", "stock_monitor"],
  "support_level": "email",
  "data_export": false,
  "api_access": false
}';


-- 8. Create indexes on existing tables for billing queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_status 
  ON public.subscriptions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_next_billing 
  ON public.subscriptions(status, next_billing_date) 
  WHERE status = 'active' AND next_billing_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_metrics_org_metric_recorded 
  ON public.usage_metrics(organization_id, metric, recorded_at DESC);
