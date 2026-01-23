'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthUser } from '@/hooks/use-auth-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Activity, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

interface UsageQuota {
  metric_type: string;
  count: number;
  limit_amount: number | null;
  date: string;
}

interface UsageMetric {
  metric: string;
  value: number;
  recorded_at: string;
}

export default function UsagePage() {
  const supabase = createClient();
  const { user, isLoading: authLoading } = useAuthUser();

  const [quotas, setQuotas] = useState<UsageQuota[]>([]);
  const [metrics, setMetrics] = useState<UsageMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      loadUsageData();
    }
  }, [authLoading, user]);

  async function loadUsageData() {
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

      const today = new Date().toISOString().split('T')[0];

      const { data: quotasData } = await supabase
        .from('usage_quotas')
        .select('*')
        .eq('organization_id', membership.organization_id)
        .eq('date', today);

      if (quotasData) {
        setQuotas(quotasData);
      }

      const { data: metricsData } = await supabase
        .from('usage_metrics')
        .select('*')
        .eq('organization_id', membership.organization_id)
        .gte('recorded_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: false });

      if (metricsData) {
        setMetrics(metricsData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading usage data:', error);
      setLoading(false);
    }
  }

  function getUsagePercentage(count: number, limit: number | null): number {
    if (!limit) return 0;
    return Math.min((count / limit) * 100, 100);
  }

  function getUsageStatus(percentage: number): {
    color: string;
    label: string;
    variant: 'default' | 'secondary' | 'destructive';
  } {
    if (percentage >= 90) {
      return { color: 'bg-destructive', label: 'Critical', variant: 'destructive' };
    }
    if (percentage >= 75) {
      return { color: 'bg-yellow-500', label: 'Warning', variant: 'secondary' };
    }
    return { color: 'bg-primary', label: 'Healthy', variant: 'default' };
  }

  function aggregateMetrics(metricName: string): number {
    return metrics
      .filter((m) => m.metric === metricName)
      .reduce((sum, m) => sum + m.value, 0);
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-muted-foreground">Loading usage data...</div>
      </div>
    );
  }

  const signalsQuota = quotas.find((q) => q.metric_type === 'signals');
  const aiQuota = quotas.find((q) => q.metric_type === 'ai_prompts');

  const signalsPercentage = signalsQuota
    ? getUsagePercentage(signalsQuota.count, signalsQuota.limit_amount)
    : 0;
  const aiPercentage = aiQuota
    ? getUsagePercentage(aiQuota.count, aiQuota.limit_amount)
    : 0;

  const signalsStatus = getUsageStatus(signalsPercentage);
  const aiStatus = getUsageStatus(aiPercentage);

  const totalSignals = aggregateMetrics('signal_generated');
  const totalAICalls = aggregateMetrics('groq_api_call');
  const totalTokens = aggregateMetrics('groq_tokens');

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Usage & Quotas</h1>
        <p className="text-muted-foreground mt-2">
          Track your daily usage and plan limits
        </p>
      </div>

      {(signalsPercentage >= 90 || aiPercentage >= 90) && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You're approaching your daily limits. Consider upgrading your plan to continue
            using premium features.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Trading Signals
              </CardTitle>
              <Badge variant={signalsStatus.variant}>{signalsStatus.label}</Badge>
            </div>
            <CardDescription>Daily signal generation limit</CardDescription>
          </CardHeader>
          <CardContent>
            {signalsQuota && signalsQuota.limit_amount ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold">{signalsQuota.count}</span>
                  <span className="text-muted-foreground">
                    / {signalsQuota.limit_amount} signals
                  </span>
                </div>
                <Progress value={signalsPercentage} className="h-2" />
                <div className="text-sm text-muted-foreground">
                  {signalsQuota.limit_amount - signalsQuota.count} signals remaining today
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">Unlimited signals</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                AI Validations
              </CardTitle>
              <Badge variant={aiStatus.variant}>{aiStatus.label}</Badge>
            </div>
            <CardDescription>Daily AI prompt limit</CardDescription>
          </CardHeader>
          <CardContent>
            {aiQuota && aiQuota.limit_amount ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold">{aiQuota.count}</span>
                  <span className="text-muted-foreground">
                    / {aiQuota.limit_amount} validations
                  </span>
                </div>
                <Progress value={aiPercentage} className="h-2" />
                <div className="text-sm text-muted-foreground">
                  {aiQuota.limit_amount - aiQuota.count} validations remaining today
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">Unlimited AI validations</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            7-Day Usage Summary
          </CardTitle>
          <CardDescription>Your activity over the past week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Total Signals</div>
              <div className="text-2xl font-bold">{totalSignals.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">AI Validations</div>
              <div className="text-2xl font-bold">{totalAICalls.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Tokens Used</div>
              <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                ≈ ₹{((totalTokens / 1000000) * 0.1).toFixed(2)} cost
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {(signalsPercentage >= 75 || aiPercentage >= 75) && (
        <Card className="mt-6 border-yellow-500">
          <CardHeader>
            <CardTitle className="text-lg">Need More Capacity?</CardTitle>
            <CardDescription>
              You're using {Math.max(signalsPercentage, aiPercentage).toFixed(0)}% of your
              daily limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="/subscription"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Upgrade Plan
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
