import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PayUClient } from '@/lib/payu/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const payuClient = new PayUClient();

    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id, processed')
      .eq('provider', 'payu')
      .eq('event_id', payload.txnid)
      .single();

    if (existingEvent?.processed) {
      console.log('Webhook already processed:', payload.txnid);
      return NextResponse.json({ status: 'already_processed' });
    }

    const webhookEventId = existingEvent?.id || crypto.randomUUID();

    if (!existingEvent) {
      await supabase.from('webhook_events').insert({
        id: webhookEventId,
        provider: 'payu',
        event_type: 'payment.response',
        event_id: payload.txnid,
        payload,
        processed: false,
      });
    }

    const isValid = payuClient.verifyWebhookSignature(payload);
    if (!isValid) {
      console.error('Invalid PayU signature');
      
      const { data: currentEvent } = await supabase
        .from('webhook_events')
        .select('retry_count')
        .eq('id', webhookEventId)
        .single();
      
      await supabase
        .from('webhook_events')
        .update({
          error_message: 'Invalid signature',
          retry_count: (currentEvent?.retry_count || 0) + 1,
        })
        .eq('id', webhookEventId);

      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const {
      txnid,
      status,
      amount,
      mihpayid,
      udf1: organizationId,
      udf2: subscriptionId,
      udf3: planId,
    } = payload;

    let subscriptionStatus: string;
    let paymentEventStatus: string;

    switch (status.toLowerCase()) {
      case 'success':
      case 'captured':
        subscriptionStatus = 'active';
        paymentEventStatus = 'completed';
        break;
      case 'failed':
      case 'failure':
        subscriptionStatus = 'payment_failed';
        paymentEventStatus = 'failed';
        break;
      case 'pending':
        subscriptionStatus = 'pending_payment';
        paymentEventStatus = 'pending';
        break;
      default:
        subscriptionStatus = 'unknown';
        paymentEventStatus = 'unknown';
    }

    const now = new Date().toISOString();
    const periodStart = new Date();
    const periodEnd = new Date();
    
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('metadata')
      .eq('id', subscriptionId)
      .single();

    const billingCycle = subscription?.metadata?.billing_cycle || 'monthly';
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

    await supabase
      .from('subscriptions')
      .update({
        status: subscriptionStatus,
        provider_subscription_id: mihpayid,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        next_billing_date: periodEnd.toISOString().split('T')[0],
        last_payment_at: now,
        updated_at: now,
      })
      .eq('id', subscriptionId);

    await supabase.from('payment_events').insert({
      organization_id: organizationId,
      subscription_id: subscriptionId,
      event_type: `payment.${paymentEventStatus}`,
      provider: 'payu',
      provider_event_id: mihpayid,
      amount_cents: Math.round(parseFloat(amount) * 100),
      currency: 'INR',
      status: paymentEventStatus,
      metadata: payload,
      occurred_at: now,
    });

    await supabase.from('subscription_history').insert({
      subscription_id: subscriptionId,
      organization_id: organizationId,
      plan_id: planId,
      action: status === 'success' ? 'created' : 'payment_failed',
      status: subscriptionStatus,
      effective_date: now,
      metadata: { payment_event: mihpayid },
    });

    if (subscriptionStatus === 'active') {
      const { data: plan } = await supabase
        .from('billing_plans')
        .select('features')
        .eq('id', planId)
        .single();

      if (plan?.features) {
        const today = new Date().toISOString().split('T')[0];
        
        const quotas = [
          {
            organization_id: organizationId,
            metric_type: 'ai_prompts',
            date: today,
            count: 0,
            limit_amount: plan.features.ai_prompts_per_day || null,
          },
          {
            organization_id: organizationId,
            metric_type: 'api_calls',
            date: today,
            count: 0,
            limit_amount: plan.features.api_calls_per_day || null,
          },
        ];

        await supabase.from('usage_quotas').upsert(quotas, {
          onConflict: 'organization_id,metric_type,date',
        });
      }
    }

    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: now })
      .eq('id', webhookEventId);

    console.log('Webhook processed successfully:', txnid);
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
