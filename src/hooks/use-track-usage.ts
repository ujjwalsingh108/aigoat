import { createClient } from '@/utils/supabase/client';

export async function trackUsage(metricType: string, value: number = 1): Promise<boolean> {
  try {
    const supabase = createClient();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No active session for usage tracking');
      return false;
    }

    const response = await fetch('/api/usage/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        metric_type: metricType,
        value,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Usage tracking failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Usage tracking error:', error);
    return false;
  }
}

export async function checkUsageLimit(metricType: string): Promise<{
  canUse: boolean;
  current: number;
  limit: number | null;
  percentage: number;
}> {
  try {
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { canUse: false, current: 0, limit: null, percentage: 0 };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!membership) {
      return { canUse: false, current: 0, limit: null, percentage: 0 };
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: quota } = await supabase
      .from('usage_quotas')
      .select('count, limit_amount')
      .eq('organization_id', membership.organization_id)
      .eq('metric_type', metricType)
      .eq('date', today)
      .maybeSingle();

    if (!quota) {
      return { canUse: true, current: 0, limit: null, percentage: 0 };
    }

    const canUse = !quota.limit_amount || quota.count < quota.limit_amount;
    const percentage = quota.limit_amount
      ? (quota.count / quota.limit_amount) * 100
      : 0;

    return {
      canUse,
      current: quota.count,
      limit: quota.limit_amount,
      percentage,
    };
  } catch (error) {
    console.error('Error checking usage limit:', error);
    return { canUse: false, current: 0, limit: null, percentage: 0 };
  }
}

export function useTrackUsage() {
  return {
    trackUsage,
    checkUsageLimit,
  };
}
