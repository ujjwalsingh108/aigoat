import { createClient } from '@supabase/supabase-js';
import { createChatCompletion } from '@/lib/groq/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Signal {
  id: string;
  organization_id: string;
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

export async function processBatchAIValidation() {
  console.log('[Batch AI] Starting batch validation job...');

  try {
    // Get signals that need AI validation (where ai_validated = false or null)
    const { data: signals, error } = await supabase
      .from('intraday_bearish_signals')
      .select('*')
      .or('ai_validated.is.null,ai_validated.eq.false')
      .limit(50); // Process 50 at a time

    if (error) {
      console.error('[Batch AI] Error fetching signals:', error);
      return;
    }

    if (!signals || signals.length === 0) {
      console.log('[Batch AI] No signals to validate');
      return;
    }

    console.log(`[Batch AI] Processing ${signals.length} signals`);

    let successCount = 0;
    let errorCount = 0;

    for (const signal of signals) {
      try {
        const validation = await validateSignalWithAI(signal);

        // Update signal with AI validation results
        const { error: updateError } = await supabase
          .from('intraday_bearish_signals')
          .update({
            ai_validated: true,
            ai_verdict: validation.verdict,
            ai_confidence: validation.confidence,
            ai_reasoning: validation.reasoning,
            ai_risk_factors: validation.risk_factors,
          })
          .eq('id', signal.id);

        if (updateError) {
          console.error(`[Batch AI] Error updating signal ${signal.id}:`, updateError);
          errorCount++;
        } else {
          successCount++;
        }

        // Small delay to avoid rate limits
        await sleep(100);
      } catch (error: any) {
        console.error(`[Batch AI] Error validating signal ${signal.id}:`, error);
        errorCount++;
      }
    }

    console.log(
      `[Batch AI] Batch completed: ${successCount} success, ${errorCount} errors`
    );

    // Log job execution
    await supabase.from('usage_metrics').insert({
      organization_id: '00000000-0000-0000-0000-000000000000', // System job
      metric: 'batch_ai_validation',
      value: successCount,
    });
  } catch (error) {
    console.error('[Batch AI] Batch job failed:', error);
  }
}

async function validateSignalWithAI(signal: Signal) {
  const systemPrompt = `You are an expert stock market analyst specializing in technical analysis. 
Provide structured validation in JSON format with: verdict (BUY/SELL/HOLD/AVOID), confidence (0.0-1.0), reasoning (2-3 sentences), and risk_factors (array).`;

  const userPrompt = `Analyze this ${signal.signal_direction} signal for ${signal.symbol}:
Type: ${signal.signal_type}
Entry: ₹${signal.entry_price}
Current: ₹${signal.current_price}
${signal.rsi_value ? `RSI: ${signal.rsi_value}` : ''}
${signal.volume_ratio ? `Volume: ${signal.volume_ratio}x` : ''}
${signal.pattern_name ? `Pattern: ${signal.pattern_name} (${signal.pattern_confidence}%)` : ''}

Response as JSON only:`;

  const { content } = await createChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.3, max_tokens: 400 }
  );

  const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  return JSON.parse(cleanContent);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// For local testing
if (require.main === module) {
  processBatchAIValidation()
    .then(() => {
      console.log('[Batch AI] Job completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Batch AI] Job failed:', error);
      process.exit(1);
    });
}
