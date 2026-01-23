# Frontend Integration Guide

## Complete implementation examples for Billing, Subscription, and Usage pages

---

## 1. BILLING PAGE

### Component: `src/app/(with-sidebar)/billing/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

interface BillingData {
  organization: {
    id: string;
    name: string;
  };
  subscription: {
    id: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    next_billing_date: string;
    cancel_at_period_end: boolean;
  } | null;
  plan: {
    id: string;
    name: string;
    price_cents: number;
    currency: string;
    monthly: boolean;
    features: Record<string, any>;
  } | null;
  recentPayments: Array<{
    id: string;
    amount_cents: number;
    status: string;
    occurred_at: string;
    provider_event_id: string;
  }>;
}

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadBillingData();
  }, []);

  async function loadBillingData() {
    try {
      setLoading(true);
      
      // 1. Get current user's organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id, organizations!inner(id, name)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (membershipError) throw membershipError;

      const organizationId = membership.organization_id;

      // 2. Get active subscription with plan details
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          billing_plans!inner(*)
        `)
        .eq('organization_id', organizationId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. Get recent payment history
      const { data: payments, error: paymentsError } = await supabase
        .from('payment_events')
        .select('*')
        .eq('organization_id', organizationId)
        .order('occurred_at', { ascending: false })
        .limit(10);

      if (paymentsError) console.error('Payments error:', paymentsError);

      setData({
        organization: {
          id: organizationId,
          name: (membership as any).organizations.name,
        },
        subscription: subscription || null,
        plan: subscription?.billing_plans || null,
        recentPayments: payments || [],
      });
    } catch (err: any) {
      console.error('Billing data error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'trialing':
        return 'bg-blue-500';
      case 'past_due':
        return 'bg-yellow-500';
      case 'canceled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  }

  function formatCurrency(cents: number, currency: string = 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card className="p-6 border-red-200 bg-red-50">
          <p className="text-red-800">Error loading billing data: {error}</p>
        </Card>
      </div>
    );
  }

  const { organization, subscription, plan, recentPayments } = data!;
  const isFreePlan = !subscription || subscription.status === 'canceled';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Billing</h1>
        {isFreePlan ? (
          <Button onClick={() => router.push('/subscription')}>
            Upgrade Plan
          </Button>
        ) : (
          <Button variant="outline" onClick={() => router.push('/subscription')}>
            Change Plan
          </Button>
        )}
      </div>

      {/* Current Plan Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {isFreePlan ? 'Free Plan' : plan?.name}
            </h2>
            <p className="text-gray-600">{organization.name}</p>
          </div>
          {subscription && (
            <Badge className={getStatusColor(subscription.status)}>
              {subscription.status.replace('_', ' ').toUpperCase()}
            </Badge>
          )}
        </div>

        {isFreePlan ? (
          <div className="space-y-4">
            <p className="text-gray-600">
              You're currently on the free plan with limited features.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                💡 Upgrade to unlock premium features, higher limits, and priority support.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Price</p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(plan!.price_cents, plan!.currency)}
                  <span className="text-sm text-gray-600 ml-2">
                    /{plan!.monthly ? 'month' : 'year'}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Next Billing Date</p>
                <p className="text-lg font-medium">
                  {subscription.next_billing_date
                    ? format(new Date(subscription.next_billing_date), 'MMM dd, yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>

            {subscription.cancel_at_period_end && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Your subscription will be canceled on{' '}
                  {format(new Date(subscription.current_period_end), 'MMM dd, yyyy')}
                </p>
              </div>
            )}

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Plan Features</h3>
              <div className="grid grid-cols-2 gap-2">
                {plan?.features && Object.entries(plan.features).map(([key, value]) => (
                  <div key={key} className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="capitalize">{key.replace(/_/g, ' ')}: </span>
                    <span className="ml-1 font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Payment History Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Payment History</h2>
        {recentPayments.length === 0 ? (
          <p className="text-gray-600">No payment history yet.</p>
        ) : (
          <div className="space-y-3">
            {recentPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      payment.status === 'completed'
                        ? 'bg-green-500'
                        : payment.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                    }`}
                  ></div>
                  <div>
                    <p className="font-medium">
                      {formatCurrency(payment.amount_cents)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(payment.occurred_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    variant={payment.status === 'completed' ? 'default' : 'destructive'}
                  >
                    {payment.status}
                  </Badge>
                  {payment.provider_event_id && (
                    <p className="text-xs text-gray-500 mt-1">
                      ID: {payment.provider_event_id.slice(0, 12)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
```

---

## 2. SUBSCRIPTION PAGE (Plan Selection)

### Component: `src/app/(with-sidebar)/subscription/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Plan {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  monthly: boolean;
  features: Record<string, any>;
}

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadPlans();
  }, [billingCycle]);

  async function loadPlans() {
    try {
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*')
        .eq('monthly', billingCycle === 'monthly')
        .order('price_cents', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      console.error('Error loading plans:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(planId: string) {
    try {
      setSubscribing(planId);

      // 1. Get organization ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!membership) throw new Error('No organization found');

      // 2. Call subscription API
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          organizationId: membership.organization_id,
          billingCycle,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Subscription failed');
      }

      const { paymentUrl, paymentPayload } = await response.json();

      // 3. Submit form to PayU (redirects user)
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = paymentUrl;

      Object.entries(paymentPayload).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value as string;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err: any) {
      console.error('Subscription error:', err);
      alert(err.message);
      setSubscribing(null);
    }
  }

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-gray-600 mb-8">
          Select the perfect plan for your trading needs
        </p>

        {/* Billing Cycle Toggle */}
        <div className="inline-flex rounded-lg border p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-md transition ${
              billingCycle === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-6 py-2 rounded-md transition relative ${
              billingCycle === 'yearly'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
            <Badge className="ml-2 bg-green-500 text-white">Save 20%</Badge>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isPopular = plan.name.toLowerCase().includes('pro');
          
          return (
            <Card
              key={plan.id}
              className={`relative p-6 ${
                isPopular ? 'border-blue-600 border-2 shadow-xl' : ''
              }`}
            >
              {isPopular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600">
                  Most Popular
                </Badge>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold">
                    ₹{formatPrice(plan.price_cents)}
                  </span>
                  <span className="text-gray-600 ml-2">
                    /{plan.monthly ? 'month' : 'year'}
                  </span>
                </div>
                {!plan.monthly && (
                  <p className="text-sm text-gray-600 mt-1">
                    ₹{formatPrice(Math.round(plan.price_cents / 12))}/month
                  </p>
                )}
              </div>

              <Button
                onClick={() => handleSubscribe(plan.id)}
                disabled={subscribing === plan.id}
                className="w-full mb-6"
                variant={isPopular ? 'default' : 'outline'}
              >
                {subscribing === plan.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Subscribe Now'
                )}
              </Button>

              <div className="space-y-3">
                {plan.features && Object.entries(plan.features).map(([key, value]) => (
                  <div key={key} className="flex items-start text-sm">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="capitalize">
                      {key.replace(/_/g, ' ')}: {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-12 text-center text-sm text-gray-600">
        <p>All plans include 7-day free trial • Cancel anytime • Secure payment via PayU</p>
      </div>
    </div>
  );
}
```

---

## 3. USAGE PAGE

### Component: `src/app/(with-sidebar)/usage/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface UsageData {
  metric_type: string;
  count: number;
  limit_amount: number | null;
  date: string;
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadUsage();
  }, []);

  async function loadUsage() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!membership) return;

      // Get today's usage
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('usage_quotas')
        .select('*')
        .eq('organization_id', membership.organization_id)
        .eq('date', today);

      if (error) throw error;
      setUsage(data || []);
    } catch (err) {
      console.error('Usage error:', err);
    } finally {
      setLoading(false);
    }
  }

  function getUsagePercentage(count: number, limit: number | null) {
    if (!limit) return 0;
    return Math.min((count / limit) * 100, 100);
  }

  function getUsageColor(percentage: number) {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  function formatMetricName(metric: string) {
    return metric
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  if (loading) {
    return <div className="p-6">Loading usage data...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Usage & Limits</h1>

      {usage.length === 0 ? (
        <Card className="p-6 text-center text-gray-600">
          <p>No usage data available yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {usage.map((item) => {
            const percentage = getUsagePercentage(item.count, item.limit_amount);
            const isNearLimit = percentage >= 75;

            return (
              <Card key={item.metric_type} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {formatMetricName(item.metric_type)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {item.count} / {item.limit_amount || '∞'} used today
                    </p>
                  </div>
                  {isNearLimit && (
                    <Badge variant="destructive" className="flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Near Limit
                    </Badge>
                  )}
                </div>

                {item.limit_amount && (
                  <>
                    <Progress
                      value={percentage}
                      className={`h-2 ${getUsageColor(percentage)}`}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {percentage.toFixed(1)}% of daily quota used
                    </p>
                  </>
                )}

                {percentage >= 100 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      ⚠️ You've reached your daily limit. Upgrade your plan for higher limits.
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## 4. USAGE TRACKING HOOK

### Hook: `src/hooks/use-track-usage.ts`

```typescript
import { createClient } from '@/utils/supabase/client';

export async function trackUsage(metricType: string) {
  try {
    const supabase = createClient();
    
    // Call backend API to increment usage
    const response = await fetch('/api/usage/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metricType }),
    });

    if (!response.ok) {
      throw new Error('Failed to track usage');
    }

    return await response.json();
  } catch (error) {
    console.error('Usage tracking error:', error);
    throw error;
  }
}

// Usage enforcement hook
export async function checkUsageLimit(metricType: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!membership) return false;

    const today = new Date().toISOString().split('T')[0];

    const { data: quota } = await supabase
      .from('usage_quotas')
      .select('count, limit_amount')
      .eq('organization_id', membership.organization_id)
      .eq('metric_type', metricType)
      .eq('date', today)
      .single();

    if (!quota || !quota.limit_amount) return true; // No limit

    return quota.count < quota.limit_amount;
  } catch (error) {
    console.error('Usage check error:', error);
    return false;
  }
}
```

### API Route: `src/app/api/usage/track/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { metricType } = await request.json();
    
    // Get user from session
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Increment usage atomically
    const { data, error } = await supabase.rpc('increment_usage', {
      p_organization_id: membership.organization_id,
      p_metric_type: metricType,
      p_date: today,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, usage: data });
  } catch (error) {
    console.error('Usage tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Database Function for Atomic Usage Increment

```sql
-- supabase/migrations/add_usage_increment_function.sql

CREATE OR REPLACE FUNCTION increment_usage(
  p_organization_id uuid,
  p_metric_type text,
  p_date date
)
RETURNS TABLE (
  count integer,
  limit_amount integer,
  exceeded boolean
) AS $$
DECLARE
  v_current_count integer;
  v_limit integer;
BEGIN
  -- Upsert and increment atomically
  INSERT INTO usage_quotas (organization_id, metric_type, date, count)
  VALUES (p_organization_id, p_metric_type, p_date, 1)
  ON CONFLICT (organization_id, metric_type, date)
  DO UPDATE SET 
    count = usage_quotas.count + 1,
    updated_at = NOW()
  RETURNING usage_quotas.count, usage_quotas.limit_amount
  INTO v_current_count, v_limit;

  RETURN QUERY SELECT 
    v_current_count,
    v_limit,
    CASE WHEN v_limit IS NOT NULL THEN v_current_count >= v_limit ELSE false END;
END;
$$ LANGUAGE plpgsql;
```

---

This completes the frontend integration examples. All components follow production-grade patterns with proper error handling, loading states, and user feedback.
