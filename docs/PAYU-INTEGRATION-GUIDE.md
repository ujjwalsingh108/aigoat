# PayU Integration Architecture

## Overview

This document details the complete PayU payment integration for subscription billing in a production-grade SaaS application.

## Architecture Diagram

```
┌─────────────────┐
│   Frontend      │
│  (Next.js)      │
└────────┬────────┘
         │
         │ 1. User clicks "Subscribe"
         ▼
┌─────────────────────┐
│  API Route          │
│  /api/subscribe     │
│  (Server-Side)      │
└─────────┬───────────┘
          │
          │ 2. Create subscription in DB
          │    (status: 'pending_payment')
          ▼
┌─────────────────────┐
│   Supabase DB       │
│   subscriptions     │
└─────────┬───────────┘
          │
          │ 3. Generate PayU payment link
          ▼
┌─────────────────────┐
│   PayU API          │
│   POST /order       │
└─────────┬───────────┘
          │
          │ 4. Return payment URL
          ▼
┌─────────────────────┐
│   Frontend          │
│   Redirect to PayU  │
└─────────┬───────────┘
          │
          │ 5. User completes payment
          ▼
┌─────────────────────┐
│   PayU              │
│   Payment Gateway   │
└─────────┬───────────┘
          │
          │ 6. PayU sends webhook
          ▼
┌─────────────────────┐
│  API Route          │
│  /api/webhooks/payu │
└─────────┬───────────┘
          │
          │ 7. Verify signature
          │ 8. Update subscription
          │ 9. Record payment event
          ▼
┌─────────────────────┐
│   Supabase DB       │
│   - subscriptions   │
│   - payment_events  │
│   - webhook_events  │
└─────────────────────┘
```

## Implementation

### 1. Environment Variables

```env
# .env.local
PAYU_MERCHANT_KEY=your_merchant_key
PAYU_MERCHANT_SALT=your_merchant_salt
PAYU_BASE_URL=https://secure.payu.in # Production
# PAYU_BASE_URL=https://test.payu.in # Test
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 2. PayU Helper Utility

```typescript
// src/lib/payu/client.ts
import crypto from 'crypto';

interface PayUConfig {
  merchantKey: string;
  merchantSalt: string;
  baseUrl: string;
}

interface PaymentParams {
  txnid: string; // Unique transaction ID
  amount: string; // Amount in INR (e.g., "999.00")
  productinfo: string; // Plan name
  firstname: string;
  email: string;
  phone: string;
  surl: string; // Success URL
  furl: string; // Failure URL
  udf1?: string; // Custom field 1 (organization_id)
  udf2?: string; // Custom field 2 (subscription_id)
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

export class PayUClient {
  private config: PayUConfig;

  constructor() {
    this.config = {
      merchantKey: process.env.PAYU_MERCHANT_KEY!,
      merchantSalt: process.env.PAYU_MERCHANT_SALT!,
      baseUrl: process.env.PAYU_BASE_URL!,
    };

    if (!this.config.merchantKey || !this.config.merchantSalt) {
      throw new Error('PayU credentials not configured');
    }
  }

  /**
   * Generate payment hash for PayU
   * Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
   */
  generateHash(params: PaymentParams): string {
    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = '',
    } = params;

    const hashString = [
      this.config.merchantKey,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      '', '', '', '', '', // Empty fields as per PayU spec
      this.config.merchantSalt,
    ].join('|');

    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  /**
   * Verify webhook signature from PayU
   */
  verifyWebhookSignature(payload: any): boolean {
    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = '',
      hash: receivedHash,
    } = payload;

    // Reverse hash formula for response
    const hashString = [
      this.config.merchantSalt,
      status,
      '', '', '', '', '',
      udf5,
      udf4,
      udf3,
      udf2,
      udf1,
      email,
      firstname,
      productinfo,
      amount,
      txnid,
      this.config.merchantKey,
    ].join('|');

    const calculatedHash = crypto
      .createHash('sha512')
      .update(hashString)
      .digest('hex');

    return calculatedHash === receivedHash;
  }

  /**
   * Generate payment link/form data
   */
  getPaymentUrl(params: PaymentParams): {
    url: string;
    payload: Record<string, string>;
  } {
    const hash = this.generateHash(params);

    return {
      url: `${this.config.baseUrl}/_payment`,
      payload: {
        key: this.config.merchantKey,
        txnid: params.txnid,
        amount: params.amount,
        productinfo: params.productinfo,
        firstname: params.firstname,
        email: params.email,
        phone: params.phone,
        surl: params.surl,
        furl: params.furl,
        hash,
        ...(params.udf1 && { udf1: params.udf1 }),
        ...(params.udf2 && { udf2: params.udf2 }),
        ...(params.udf3 && { udf3: params.udf3 }),
        ...(params.udf4 && { udf4: params.udf4 }),
        ...(params.udf5 && { udf5: params.udf5 }),
      },
    };
  }
}
```

### 3. Subscription API Route

```typescript
// src/app/api/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { PayUClient } from '@/lib/payu/client';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 1. Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get request body
    const body = await request.json();
    const { planId, organizationId, billingCycle } = body; // 'monthly' or 'yearly'

    if (!planId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 3. Verify user is organization owner
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

    // 4. Get plan details
    const { data: plan, error: planError } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 404 });
    }

    // 5. Get user profile for payment details
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .single();

    // 6. Create subscription record (status: pending_payment)
    const subscriptionId = crypto.randomUUID();
    const transactionId = `SUB_${nanoid(16)}`; // Unique txnid

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

    // 7. Generate PayU payment link
    const payuClient = new PayUClient();
    const amount = (plan.price_cents / 100).toFixed(2); // Convert cents to INR

    const { url, payload } = payuClient.getPaymentUrl({
      txnid: transactionId,
      amount,
      productinfo: `${plan.name} - ${billingCycle}`,
      firstname: profile?.full_name || user.email?.split('@')[0] || 'User',
      email: user.email!,
      phone: profile?.phone || '0000000000',
      surl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/success`,
      furl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/failure`,
      udf1: organizationId, // Store org ID for webhook processing
      udf2: subscriptionId, // Store subscription ID
      udf3: planId,
    });

    // 8. Return payment details to frontend
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
```

### 4. PayU Webhook Handler

```typescript
// src/app/api/webhooks/payu/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PayUClient } from '@/lib/payu/client';

// Use service role client for webhook (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-side only!
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

    // 1. Log webhook event (idempotency)
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

    // 2. Verify signature
    const isValid = payuClient.verifyWebhookSignature(payload);
    if (!isValid) {
      console.error('Invalid PayU signature');
      await supabase
        .from('webhook_events')
        .update({
          error_message: 'Invalid signature',
          retry_count: supabase.sql`retry_count + 1`,
        })
        .eq('id', webhookEventId);

      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // 3. Extract data from payload
    const {
      txnid,
      status,
      amount,
      productinfo,
      email,
      mihpayid, // PayU payment ID
      udf1: organizationId,
      udf2: subscriptionId,
      udf3: planId,
    } = payload;

    // 4. Handle payment status
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

    // 5. Update subscription
    const now = new Date().toISOString();
    const periodStart = new Date();
    const periodEnd = new Date();
    
    // Get billing cycle from metadata
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

    // 6. Record payment event
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

    // 7. Create subscription history entry
    await supabase.from('subscription_history').insert({
      subscription_id: subscriptionId,
      organization_id: organizationId,
      plan_id: planId,
      action: status === 'success' ? 'created' : 'payment_failed',
      status: subscriptionStatus,
      effective_date: now,
      metadata: { payment_event: mihpayid },
    });

    // 8. If successful, initialize usage quotas
    if (subscriptionStatus === 'active') {
      const { data: plan } = await supabase
        .from('billing_plans')
        .select('features')
        .eq('id', planId)
        .single();

      if (plan?.features) {
        const today = new Date().toISOString().split('T')[0];
        
        // Initialize daily quotas
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

    // 9. Mark webhook as processed
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
```

### 5. Success/Failure Redirect Handlers

```typescript
// src/app/api/payment/success/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const txnid = formData.get('txnid');
  const status = formData.get('status');

  // Redirect to billing page with success message
  const url = new URL('/billing', process.env.NEXT_PUBLIC_APP_URL!);
  url.searchParams.set('payment', 'success');
  url.searchParams.set('txnid', txnid as string);

  return NextResponse.redirect(url);
}

// src/app/api/payment/failure/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const txnid = formData.get('txnid');
  const error = formData.get('error_Message');

  const url = new URL('/billing', process.env.NEXT_PUBLIC_APP_URL!);
  url.searchParams.set('payment', 'failed');
  url.searchParams.set('error', error as string);

  return NextResponse.redirect(url);
}
```

## Security Considerations

1. **Always verify PayU signatures** in webhook handler
2. **Use service role key** only on server-side (never expose to frontend)
3. **Implement idempotency** using webhook_events table
4. **Store full webhook payload** for debugging
5. **Rate limit** subscription creation API
6. **Validate organization ownership** before allowing subscriptions
7. **Log all payment events** for audit trail

## Testing

### Test Mode
```bash
# Use PayU test environment
PAYU_BASE_URL=https://test.payu.in

# Test cards (PayU docs)
# Success: 5123456789012346
# Failure: 4012001037141112
```

### Webhook Testing
Use tools like ngrok to expose local webhook endpoint:
```bash
ngrok http 3000
# Update PayU dashboard with: https://your-ngrok-url.ngrok.io/api/webhooks/payu
```

## Monitoring

Monitor these metrics:
- Webhook processing failures
- Payment success rate
- Average payment time
- Abandoned payments (pending > 1 hour)

Query example:
```sql
-- Failed webhooks in last 24h
SELECT * FROM webhook_events
WHERE processed = false
AND retry_count > 3
AND created_at > NOW() - INTERVAL '24 hours';

-- Payment success rate
SELECT
  COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*) * 100 AS success_rate
FROM payment_events
WHERE created_at > NOW() - INTERVAL '30 days';
```
