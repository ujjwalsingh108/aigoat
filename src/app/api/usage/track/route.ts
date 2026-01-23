import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const { metric_type, value = 1 } = await request.json();

    if (!metric_type) {
      return NextResponse.json({ error: 'metric_type is required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    const { error: quotaError } = await supabase.rpc('increment_usage', {
      p_organization_id: membership.organization_id,
      p_metric_type: metric_type,
      p_date: today,
    });

    if (quotaError) {
      console.error('Usage tracking error:', quotaError);
      return NextResponse.json(
        { error: 'Failed to track usage' },
        { status: 500 }
      );
    }

    const { error: metricError } = await supabase.from('usage_metrics').insert({
      organization_id: membership.organization_id,
      metric: metric_type,
      value: value,
    });

    if (metricError) {
      console.error('Metric logging error:', metricError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Usage tracking error:', error);
    return NextResponse.json(
      { error: 'Usage tracking failed', details: error.message },
      { status: 500 }
    );
  }
}
