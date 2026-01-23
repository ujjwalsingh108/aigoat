-- ============================================================================
-- RLS POLICIES FOR BILLING & SUBSCRIPTION TABLES
-- ============================================================================

-- Enable RLS on all billing tables
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 1. BILLING_PLANS: Public read access (everyone can see available plans)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view billing plans" ON public.billing_plans;
CREATE POLICY "Anyone can view billing plans"
ON public.billing_plans
FOR SELECT
TO public
USING (true);

-- Only service role can modify plans
DROP POLICY IF EXISTS "Service role can manage billing plans" ON public.billing_plans;
CREATE POLICY "Service role can manage billing plans"
ON public.billing_plans
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "Anyone can view billing plans" ON public.billing_plans IS 
'All users (including anonymous) can view available plans for pricing page';


-- ============================================================================
-- 2. ORGANIZATIONS: Users can only see their own organizations
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
CREATE POLICY "Users can view their organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = auth.uid()
    AND organization_members.is_active = true
  )
);

DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
CREATE POLICY "Users can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true); -- User will be added as owner via trigger

DROP POLICY IF EXISTS "Organization owners can update their org" ON public.organizations;
CREATE POLICY "Organization owners can update their org"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = auth.uid()
    AND organization_members.is_owner = true
    AND organization_members.is_active = true
  )
);

DROP POLICY IF EXISTS "Service role can manage organizations" ON public.organizations;
CREATE POLICY "Service role can manage organizations"
ON public.organizations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 3. ORGANIZATION_MEMBERS: See members of your organization
-- ============================================================================

DROP POLICY IF EXISTS "Users can view members of their organizations" ON public.organization_members;
CREATE POLICY "Users can view members of their organizations"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members AS om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.is_active = true
  )
);

DROP POLICY IF EXISTS "Organization owners can manage members" ON public.organization_members;
CREATE POLICY "Organization owners can manage members"
ON public.organization_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members AS om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.is_owner = true
    AND om.is_active = true
  )
);

DROP POLICY IF EXISTS "Service role can manage members" ON public.organization_members;
CREATE POLICY "Service role can manage members"
ON public.organization_members
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 4. SUBSCRIPTIONS: Users can view their organization's subscription
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organization subscription" ON public.subscriptions;
CREATE POLICY "Users can view their organization subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = subscriptions.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.is_active = true
  )
);

-- Only service role can create/update subscriptions (via webhooks)
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage subscriptions"
ON public.subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "Users can view their organization subscription" ON public.subscriptions IS 
'Organization members can view subscription details, but only backend can modify via webhooks';


-- ============================================================================
-- 5. PAYMENT_EVENTS: Users can view their organization payment history
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organization payments" ON public.payment_events;
CREATE POLICY "Users can view their organization payments"
ON public.payment_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = payment_events.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.is_active = true
  )
);

DROP POLICY IF EXISTS "Service role can manage payment events" ON public.payment_events;
CREATE POLICY "Service role can manage payment events"
ON public.payment_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 6. INVOICES: Users can view their organization invoices
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organization invoices" ON public.invoices;
CREATE POLICY "Users can view their organization invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = invoices.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.is_active = true
  )
);

DROP POLICY IF EXISTS "Service role can manage invoices" ON public.invoices;
CREATE POLICY "Service role can manage invoices"
ON public.invoices
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 7. SUBSCRIPTION_HISTORY: Users can view their organization subscription history
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their subscription history" ON public.subscription_history;
CREATE POLICY "Users can view their subscription history"
ON public.subscription_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = subscription_history.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.is_active = true
  )
);

DROP POLICY IF EXISTS "Service role can manage subscription history" ON public.subscription_history;
CREATE POLICY "Service role can manage subscription history"
ON public.subscription_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 8. USAGE_METRICS: Users can view their organization usage
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organization usage metrics" ON public.usage_metrics;
CREATE POLICY "Users can view their organization usage metrics"
ON public.usage_metrics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = usage_metrics.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.is_active = true
  )
);

-- Backend can insert/update usage metrics
DROP POLICY IF EXISTS "Service role can manage usage metrics" ON public.usage_metrics;
CREATE POLICY "Service role can manage usage metrics"
ON public.usage_metrics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 9. USAGE_QUOTAS: Users can view their organization quotas
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organization usage quotas" ON public.usage_quotas;
CREATE POLICY "Users can view their organization usage quotas"
ON public.usage_quotas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = usage_quotas.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.is_active = true
  )
);

DROP POLICY IF EXISTS "Service role can manage usage quotas" ON public.usage_quotas;
CREATE POLICY "Service role can manage usage quotas"
ON public.usage_quotas
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 10. WEBHOOK_EVENTS: Only service role can access
-- ============================================================================

DROP POLICY IF EXISTS "Only service role can manage webhooks" ON public.webhook_events;
CREATE POLICY "Only service role can manage webhooks"
ON public.webhook_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- Grant permissions
-- ============================================================================

-- Public read for plans
GRANT SELECT ON public.billing_plans TO anon, authenticated;

-- Organization members can read their org data
GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_members TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.payment_events TO authenticated;
GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT ON public.subscription_history TO authenticated;
GRANT SELECT ON public.usage_metrics TO authenticated;
GRANT SELECT ON public.usage_quotas TO authenticated;

-- Service role has full access
GRANT ALL ON public.billing_plans TO service_role;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.organization_members TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.payment_events TO service_role;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON public.subscription_history TO service_role;
GRANT ALL ON public.usage_metrics TO service_role;
GRANT ALL ON public.usage_quotas TO service_role;
GRANT ALL ON public.webhook_events TO service_role;

-- Grant sequence usage
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
