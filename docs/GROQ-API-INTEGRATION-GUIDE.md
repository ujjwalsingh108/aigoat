# Groq API Integration for AI-Powered Trading Features

## Architecture Overview

Groq API should **ALWAYS** be called from the **backend (API routes)**, never directly from the frontend to:
1. **Protect API keys** from exposure
2. **Enforce usage limits** against subscription plans
3. **Track usage metrics** for billing
4. **Implement rate limiting** and abuse prevention
5. **Cache responses** to reduce costs
6. **Log requests** for audit trail

## 1. Groq Client Setup

### Environment Variables

```env
# .env.local
GROQ_API_KEY=your_groq_api_key_here
GROQ_API_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.1-70b-versatile # Or mixtral-8x7b-32768
```

### Groq Client Utility

```typescript
// src/lib/groq/client.ts
import Groq from 'groq-sdk';

export const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqUsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export async function createChatCompletion(
  messages: GroqChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }
): Promise<{ content: string; usage: GroqUsageStats }> {
  const completion = await groqClient.chat.completions.create({
    messages,
    model: options?.model || process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    temperature: options?.temperature || 0.7,
    max_tokens: options?.max_tokens || 1024,
  });

  return {
    content: completion.choices[0]?.message?.content || '',
    usage: {
      prompt_tokens: completion.usage?.prompt_tokens || 0,
      completion_tokens: completion.usage?.completion_tokens || 0,
      total_tokens: completion.usage?.total_tokens || 0,
    },
  };
}
```

## 2. AI Signal Validation Implementation

### API Route: `/api/ai/validate-signal`

```typescript
// src/app/api/ai/validate-signal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createChatCompletion } from '@/lib/groq/client';
import { trackUsage, checkUsageLimit } from '@/lib/usage';

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
    // 1. Authenticate user
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get organization and check usage limit
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // 3. Check AI prompt usage limit
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

    // 4. Get signal data from request
    const signalData: SignalData = await request.json();

    // 5. Build AI prompt for signal validation
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

    // 6. Call Groq API
    const { content, usage } = await createChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.3, // Lower temperature for more consistent analysis
        max_tokens: 512,
      }
    );

    // 7. Parse AI response
    let aiValidation;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      aiValidation = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('AI response parsing error:', content);
      throw new Error('Invalid AI response format');
    }

    // 8. Track usage in database
    await trackUsage(membership.organization_id, 'ai_prompts', usage.total_tokens);

    // 9. Log AI validation request for audit
    await supabase.from('usage_metrics').insert({
      organization_id: membership.organization_id,
      metric: 'groq_api_call',
      value: 1,
      recorded_at: new Date().toISOString(),
      metadata: {
        symbol: signalData.symbol,
        signal_type: signalData.signal_type,
        tokens_used: usage.total_tokens,
        model: process.env.GROQ_MODEL,
      },
    });

    // 10. Return AI validation result
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
        cost_estimate: (usage.total_tokens / 1000000) * 0.10, // $0.10 per 1M tokens
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

// Helper function to check usage limits
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
    // Initialize quota if not exists
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id, billing_plans!inner(features)')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single();

    const limit = subscription?.billing_plans?.features?.ai_prompts_per_day;

    await supabase.from('usage_quotas').upsert({
      organization_id: organizationId,
      metric_type: metricType,
      date: today,
      count: 0,
      limit_amount: limit,
    });

    return true;
  }

  if (!quota.limit_amount) return true; // Unlimited
  return quota.count < quota.limit_amount;
}

// Helper function to track usage
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

  // Also track token usage separately
  await supabase.from('usage_metrics').insert({
    organization_id: organizationId,
    metric: 'groq_tokens',
    value: tokens,
  });
}
```

## 3. Background Job: Batch AI Validation

For processing multiple signals (e.g., nightly scan results), use a background job:

```typescript
// src/lib/jobs/batch-ai-validation.ts
import { createClient } from '@supabase/supabase-js';
import { createChatCompletion } from '@/lib/groq/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function batchValidateSignals() {
  try {
    console.log('Starting batch AI validation...');

    // 1. Get unvalidated signals from today
    const { data: signals, error } = await supabase
      .from('bullish_breakout_nse_eq')
      .select('*')
      .is('ai_validation_status', null)
      .gte('created_at', new Date().toISOString().split('T')[0])
      .limit(50); // Process in batches of 50

    if (error) throw error;
    if (!signals || signals.length === 0) {
      console.log('No signals to validate');
      return;
    }

    console.log(`Processing ${signals.length} signals...`);

    // 2. Process each signal
    for (const signal of signals) {
      try {
        const prompt = buildValidationPrompt(signal);
        const { content, usage } = await createChatCompletion(
          [
            { role: 'system', content: getSystemPrompt() },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.3, max_tokens: 512 }
        );

        const validation = JSON.parse(content);

        // 3. Update signal with AI validation
        await supabase
          .from('bullish_breakout_nse_eq')
          .update({
            ai_validation_status: 'completed',
            ai_verdict: validation.verdict,
            ai_confidence: validation.confidence,
            ai_reasoning: validation.reasoning,
            ai_risk_factors: validation.risk_factors,
            ai_entry_suggestion: validation.entry_suggestion,
            ai_validated_at: new Date().toISOString(),
          })
          .eq('id', signal.id);

        console.log(`✓ Validated signal for ${signal.symbol}`);

        // Rate limiting: wait 100ms between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (signalError) {
        console.error(`Error validating ${signal.symbol}:`, signalError);
        
        // Mark as failed
        await supabase
          .from('bullish_breakout_nse_eq')
          .update({
            ai_validation_status: 'failed',
            ai_validated_at: new Date().toISOString(),
          })
          .eq('id', signal.id);
      }
    }

    console.log('Batch validation completed');
  } catch (error) {
    console.error('Batch validation error:', error);
    throw error;
  }
}

function getSystemPrompt(): string {
  return `You are an expert stock market analyst. Analyze trading signals and provide structured JSON responses with verdict, confidence, reasoning, risk_factors, and entry_suggestion.`;
}

function buildValidationPrompt(signal: any): string {
  return `Analyze this ${signal.signal_type} signal for ${signal.symbol}:

Price: ₹${signal.current_price}
Target: ₹${signal.target_price}
Stop Loss: ₹${signal.stop_loss}
RSI: ${signal.rsi_value}
Pattern: ${signal.pattern_name} (${signal.pattern_confidence}% confidence)
Strongest Pattern: ${signal.strongest_pattern}

Provide analysis as JSON only.`;
}
```

## 4. Cron Job Setup (Vercel/Server)

```typescript
// src/app/api/cron/validate-signals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { batchValidateSignals } from '@/lib/jobs/batch-ai-validation';

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await batchValidateSignals();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Job failed' }, { status: 500 });
  }
}

// In vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/validate-signals",
//     "schedule": "0 22 * * *"  // Run daily at 10 PM IST
//   }]
// }
```

## 5. Cost Optimization Strategies

### Response Caching

```typescript
// src/lib/groq/cache.ts
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create cache table
// CREATE TABLE ai_response_cache (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   cache_key text UNIQUE NOT NULL,
//   prompt_hash text NOT NULL,
//   response jsonb NOT NULL,
//   tokens_used integer NOT NULL,
//   created_at timestamptz DEFAULT now(),
//   expires_at timestamptz NOT NULL
// );

export async function getCachedResponse(prompt: string) {
  const hash = crypto.createHash('sha256').update(prompt).digest('hex');
  
  const { data } = await supabase
    .from('ai_response_cache')
    .select('response, tokens_used')
    .eq('prompt_hash', hash)
    .gt('expires_at', new Date().toISOString())
    .single();

  return data;
}

export async function setCachedResponse(
  prompt: string,
  response: any,
  tokensUsed: number,
  ttlHours: number = 24
) {
  const hash = crypto.createHash('sha256').update(prompt).digest('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  await supabase.from('ai_response_cache').upsert({
    cache_key: hash,
    prompt_hash: hash,
    response,
    tokens_used: tokensUsed,
    expires_at: expiresAt.toISOString(),
  });
}
```

## 6. Frontend Usage Example

```typescript
// src/components/screener/SignalCard.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function SignalCard({ signal }: { signal: any }) {
  const [validating, setValidating] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  async function validateSignal() {
    try {
      setValidating(true);

      const response = await fetch('/api/ai/validate-signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${yourAccessToken}`,
        },
        body: JSON.stringify({
          symbol: signal.symbol,
          signal_type: signal.signal_type,
          signal_direction: signal.predicted_direction,
          entry_price: signal.current_price,
          current_price: signal.current_price,
          rsi_value: signal.rsi_value,
          pattern_name: signal.pattern_name,
          pattern_confidence: signal.pattern_confidence,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          alert('AI prompt limit reached. Please upgrade your plan.');
        }
        throw new Error(error.error);
      }

      const data = await response.json();
      setAiResult(data.validation);
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold">{signal.symbol}</h3>
      <p>Price: ₹{signal.current_price}</p>
      
      <Button
        onClick={validateSignal}
        disabled={validating}
        className="mt-4"
      >
        {validating ? 'Validating...' : 'AI Validate'}
      </Button>

      {aiResult && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <Badge>{aiResult.verdict}</Badge>
          <p className="text-sm mt-2">{aiResult.reasoning}</p>
          <p className="text-xs text-gray-600 mt-2">
            Confidence: {(aiResult.confidence * 100).toFixed(0)}%
          </p>
        </div>
      )}
    </div>
  );
}
```

## 7. Monitoring & Analytics

Track these metrics:
- AI API call count per day
- Token usage per organization
- Average tokens per request
- Cost per organization
- Response time
- Cache hit rate

```sql
-- Daily AI usage report
SELECT
  DATE(recorded_at) as date,
  COUNT(*) as total_calls,
  SUM(value) as total_tokens,
  AVG(value) as avg_tokens_per_call,
  SUM(value) / 1000000.0 * 0.10 as estimated_cost_usd
FROM usage_metrics
WHERE metric = 'groq_tokens'
AND recorded_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(recorded_at)
ORDER BY date DESC;
```

## Security Best Practices

1. ✅ **Never expose Groq API key** to frontend
2. ✅ **Always authenticate** API routes
3. ✅ **Enforce usage limits** before making AI calls
4. ✅ **Rate limit** AI endpoints (max 10 requests/min per user)
5. ✅ **Validate input** to prevent prompt injection
6. ✅ **Log all requests** for audit trail
7. ✅ **Cache responses** to reduce costs
8. ✅ **Monitor token usage** to detect abuse

This completes the Groq API integration guide with production-grade patterns!
