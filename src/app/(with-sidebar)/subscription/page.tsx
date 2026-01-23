'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthUser } from '@/hooks/use-auth-user';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface BillingPlan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: {
    signals_per_day?: number;
    ai_prompts_per_day?: number;
    email_alerts?: boolean;
    sms_alerts?: boolean;
    telegram_alerts?: boolean;
    api_access?: boolean;
    advanced_filters?: boolean;
    custom_watchlists?: number;
    export_data?: boolean;
    priority_support?: boolean;
  };
  is_popular: boolean;
}

export default function SubscriptionPage() {
  const supabase = createClient();
  const { user, isLoading: authLoading } = useAuthUser();
  const router = useRouter();

  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      loadPlans();
    }
  }, [authLoading]);

  async function loadPlans() {
    try {
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load plans');
      setLoading(false);
    }
  }

  async function handleSubscribe(planId: string) {
    if (!user) {
      toast.error('Please log in to subscribe');
      return;
    }

    setSubscribingTo(planId);

    try {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!membership) {
        toast.error('No organization found');
        setSubscribingTo(null);
        return;
      }

      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          plan_id: planId,
          billing_cycle: billingCycle,
          organization_id: membership.organization_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Subscription failed');
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = result.payment_url;

      Object.entries(result.payload).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error(error.message || 'Failed to start subscription');
      setSubscribingTo(null);
    }
  }

  function getPrice(plan: BillingPlan) {
    const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
    const monthly = billingCycle === 'yearly' ? price / 12 : price;
    
    return {
      display: billingCycle === 'monthly' ? price : monthly,
      total: price,
      savings: billingCycle === 'yearly' ? (plan.price_monthly * 12 - price) : 0,
    };
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Select the perfect plan for your trading needs
        </p>

        <Tabs
          value={billingCycle}
          onValueChange={(v) => setBillingCycle(v as 'monthly' | 'yearly')}
          className="inline-block"
        >
          <TabsList className="grid w-[280px] grid-cols-2">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">
              Yearly
              <Badge variant="secondary" className="ml-2 text-xs">
                Save 20%
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const pricing = getPrice(plan);
          const isSubscribing = subscribingTo === plan.id;

          return (
            <Card
              key={plan.id}
              className={`relative ${
                plan.is_popular ? 'border-primary shadow-lg' : ''
              }`}
            >
              {plan.is_popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1">
                    <Zap className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      {formatCurrency(pricing.display)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="mt-2 space-y-1">
                      <div className="text-sm text-muted-foreground">
                        Billed {formatCurrency(pricing.total)} annually
                      </div>
                      <div className="text-sm text-green-600 font-medium">
                        Save {formatCurrency(pricing.savings)} per year
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Feature
                    text={`${plan.features.signals_per_day || 'Unlimited'} signals/day`}
                    included={!!plan.features.signals_per_day}
                  />
                  <Feature
                    text={`${plan.features.ai_prompts_per_day || 'Unlimited'} AI validations/day`}
                    included={!!plan.features.ai_prompts_per_day}
                  />
                  <Feature text="Email alerts" included={plan.features.email_alerts} />
                  <Feature text="SMS alerts" included={plan.features.sms_alerts} />
                  <Feature text="Telegram alerts" included={plan.features.telegram_alerts} />
                  <Feature text="API access" included={plan.features.api_access} />
                  <Feature text="Advanced filters" included={plan.features.advanced_filters} />
                  <Feature
                    text={`${plan.features.custom_watchlists || 0} watchlists`}
                    included={!!plan.features.custom_watchlists}
                  />
                  <Feature text="Export data" included={plan.features.export_data} />
                  <Feature text="Priority support" included={plan.features.priority_support} />
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isSubscribing}
                  className="w-full"
                  variant={plan.is_popular ? 'default' : 'outline'}
                >
                  {isSubscribing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Subscribe Now'
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>All plans include a 7-day money-back guarantee</p>
        <p className="mt-2">
          Questions? Contact us at{' '}
          <a href="mailto:support@aigoat.com" className="text-primary hover:underline">
            support@aigoat.com
          </a>
        </p>
      </div>
    </div>
  );
}

function Feature({ text, included }: { text: string; included?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Check
        className={`h-4 w-4 flex-shrink-0 ${
          included ? 'text-primary' : 'text-muted-foreground'
        }`}
      />
      <span className={included ? '' : 'text-muted-foreground'}>{text}</span>
    </div>
  );
}
