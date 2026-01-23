import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createChatCompletion } from '@/lib/groq/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SignalData {
  symbol: string;
  signal_type: string;
  signal_direction: string;
  entry_price: number;
  current_price: number;
  rsi_value?: number;
  volume_ratio?: number;
  pattern_name?: string;
  pattern_confidence?: number;
  detected_patterns?: any;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
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

    const canUse = await checkUsageLimit(membership.organization_id, 'ai_prompts');
    if (!canUse) {
      return NextResponse.json(
        { 
          error: 'AI prompt limit reached',
          message: 'Upgrade your plan to continue using AI features' 
        },
        { status: 429 }
      );
    }

    const signalData: SignalData = await request.json();

    const systemPrompt = `You are an expert stock market analyst specializing in technical analysis and pattern recognition. 
Your task is to validate trading signals based on technical indicators, patterns, and market context.

Provide a structured response in JSON format with:
- verdict: "BUY", "SELL", "HOLD", or "AVOID"
- confidence: 0.0 to 1.0
- reasoning: 2-3 sentence explanation
- risk_factors: array of potential risks
- entry_suggestion: specific entry strategy`;

    const userPrompt = `Analyze this ${signalData.signal_direction} trading signal for ${signalData.symbol}:

Signal Type: ${signalData.signal_type}
Entry Price: ₹${signalData.entry_price}
Current Price: ₹${signalData.current_price}
${signalData.rsi_value ? `RSI: ${signalData.rsi_value}` : ''}
${signalData.volume_ratio ? `Volume Ratio: ${signalData.volume_ratio}x` : ''}
${signalData.pattern_name ? `Detected Pattern: ${signalData.pattern_name} (${signalData.pattern_confidence}% confidence)` : ''}
${signalData.detected_patterns ? `All Patterns: ${JSON.stringify(signalData.detected_patterns)}` : ''}

Provide your analysis as valid JSON only, no markdown formatting.`;

    const { content, usage } = await createChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.3,
        max_tokens: 512,
      }
    );

    let aiValidation;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      aiValidation = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('AI response parsing error:', content);
      throw new Error('Invalid AI response format');
    }

    await trackUsage(membership.organization_id, 'ai_prompts', usage.total_tokens);

    await supabase.from('usage_metrics').insert({
      organization_id: membership.organization_id,
      metric: 'groq_api_call',
      value: 1,
      recorded_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      validation: {
        verdict: aiValidation.verdict,
        confidence: aiValidation.confidence,
        reasoning: aiValidation.reasoning,
        risk_factors: aiValidation.risk_factors || [],
        entry_suggestion: aiValidation.entry_suggestion,
      },
      usage: {
        tokens_used: usage.total_tokens,
        cost_estimate: (usage.total_tokens / 1000000) * 0.10,
      },
    });
  } catch (error: any) {
    console.error('AI validation error:', error);
    return NextResponse.json(
      { error: 'AI validation failed', details: error.message },
      { status: 500 }
    );
  }
}

async function checkUsageLimit(
  organizationId: string,
  metricType: string
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];

  const { data: quota } = await supabase
    .from('usage_quotas')
    .select('count, limit_amount')
    .eq('organization_id', organizationId)
    .eq('metric_type', metricType)
    .eq('date', today)
    .maybeSingle();

  if (!quota) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id, billing_plans!inner(features)')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single();

    const features = subscription?.billing_plans as any;
    const limit = features?.features?.ai_prompts_per_day;

    await supabase.from('usage_quotas').upsert({
      organization_id: organizationId,
      metric_type: metricType,
      date: today,
      count: 0,
      limit_amount: limit,
    });

    return true;
  }

  if (!quota.limit_amount) return true;
  return quota.count < quota.limit_amount;
}

async function trackUsage(
  organizationId: string,
  metricType: string,
  tokens: number
) {
  const today = new Date().toISOString().split('T')[0];

  await supabase.rpc('increment_usage', {
    p_organization_id: organizationId,
    p_metric_type: metricType,
    p_date: today,
  });

  await supabase.from('usage_metrics').insert({
    organization_id: organizationId,
    metric: 'groq_tokens',
    value: tokens,
  });
}
