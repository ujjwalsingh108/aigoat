'use client';

import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthUser } from '@/hooks/use-auth-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, Clock, CreditCard, ArrowUpRight } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  billing_plans: {
    name: string;
    description: string;
    price_monthly: number;
    price_yearly: number;
    features: any;
  };
}

interface PaymentEvent {
  id: string;
  transaction_id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
}

function BillingContent() {
  const supabase = createClient();
  const { user, isLoading: authLoading } = useAuthUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const txnid = searchParams.get('txnid');
    const error = searchParams.get('error');

    if (paymentStatus === 'success' && txnid) {
      toast.success('Payment successful!', {
        description: `Transaction ID: ${txnid}`,
      });
      router.replace('/billing');
    } else if (paymentStatus === 'failed') {
      toast.error('Payment failed', {
        description: error || 'Please try again',
      });
      router.replace('/billing');
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!authLoading && user) {
      loadBillingData();
    }
  }, [authLoading, user]);

  async function loadBillingData() {
    try {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .single();

      if (!membership) {
        setLoading(false);
        return;
      }

      const { data: subData } = await supabase
        .from('subscriptions')
        .select(
          `
          *,
          billing_plans (
            name,
            description,
            price_monthly,
            price_yearly,
            features
          )
        `
        )
        .eq('organization_id', membership.organization_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subData) {
        setSubscription(subData as any);
      }

      const { data: paymentsData } = await supabase
        .from('payment_events')
        .select('*')
        .eq('subscription_id', subData?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (paymentsData) {
        setPayments(paymentsData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading billing data:', error);
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      active: { variant: 'default', icon: CheckCircle2, label: 'Active' },
      pending_payment: { variant: 'secondary', icon: Clock, label: 'Pending Payment' },
      payment_failed: { variant: 'destructive', icon: XCircle, label: 'Payment Failed' },
      cancelled: { variant: 'outline', icon: XCircle, label: 'Cancelled' },
      expired: { variant: 'outline', icon: XCircle, label: 'Expired' },
    };

    const config = variants[status] || variants.cancelled;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-muted-foreground">Loading billing information...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription and payment history
        </p>
      </div>

      {!subscription ? (
        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
            <CardDescription>
              You don't have an active subscription. Choose a plan to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/subscription')}>
              View Plans
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {subscription.billing_plans.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {subscription.billing_plans.description}
                  </CardDescription>
                </div>
                {getStatusBadge(subscription.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Current Period</div>
                  <div className="text-lg font-medium">
                    {formatDate(subscription.current_period_start)} -{' '}
                    {formatDate(subscription.current_period_end)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Next Billing Date</div>
                  <div className="text-lg font-medium">
                    {subscription.cancel_at_period_end
                      ? 'Cancelled'
                      : formatDate(subscription.current_period_end)}
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Billing Amount</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(subscription.billing_plans.price_monthly)}
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push('/subscription')}
                  >
                    Change Plan
                  </Button>
                  {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                    <Button variant="ghost">Cancel Subscription</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment History
              </CardTitle>
              <CardDescription>
                Your recent payment transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No payment history yet
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{formatCurrency(payment.amount)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(payment.created_at)} • {payment.payment_method}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Transaction ID: {payment.transaction_id}
                        </div>
                      </div>
                      <div>{getStatusBadge(payment.status)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-muted-foreground">Loading billing information...</div>
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
