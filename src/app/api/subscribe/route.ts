import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { PayUClient } from '@/lib/payu/client';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { planId, organizationId, billingCycle } = body;

    if (!planId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('is_owner')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!membership?.is_owner) {
      return NextResponse.json(
        { error: 'Only organization owners can manage subscriptions' },
        { status: 403 }
      );
    }

    const { data: plan, error: planError } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .single();

    const subscriptionId = crypto.randomUUID();
    const transactionId = `SUB_${nanoid(16)}`;

    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        id: subscriptionId,
        organization_id: organizationId,
        plan_id: planId,
        status: 'pending_payment',
        provider_subscription_id: transactionId,
        started_at: new Date().toISOString(),
        seats: 1,
        metadata: {
          billing_cycle: billingCycle,
          created_via: 'web',
        },
      });

    if (subError) {
      console.error('Subscription creation error:', subError);
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      );
    }

    const payuClient = new PayUClient();
    const amount = (plan.price_cents / 100).toFixed(2);

    const { url, payload } = payuClient.getPaymentUrl({
      txnid: transactionId,
      amount,
      productinfo: `${plan.name} - ${billingCycle}`,
      firstname: profile?.full_name || user.email?.split('@')[0] || 'User',
      email: user.email!,
      phone: profile?.phone || '0000000000',
      surl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/success`,
      furl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/failure`,
      udf1: organizationId,
      udf2: subscriptionId,
      udf3: planId,
    });

    return NextResponse.json({
      paymentUrl: url,
      paymentPayload: payload,
      transactionId,
      subscriptionId,
    });
  } catch (error) {
    console.error('Subscription API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
