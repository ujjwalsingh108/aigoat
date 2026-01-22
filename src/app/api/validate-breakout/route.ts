import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Groq from 'groq-sdk';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Rate limiting map (in-memory, consider Redis for production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const AI_VALIDATION_PROMPT = `You are an expert quantitative trader validating technical breakout signals.

### STOCK: {symbol}
### DIRECTION: {direction}

### 6-CRITERIA SCORES:
1. Momentum Score: {momentum_score}/1.0
2. Volume Ratio: {volume_ratio}x average
3. Trend Strength: {trend_strength}/1.0
4. RSI Value: {rsi_value}
5. EMA Alignment: {ema_alignment}
6. Price Action Score: {price_action_score}/1.0

### DETECTED CHART PATTERNS:
{patterns_list}

### PRICE CONTEXT:
- Current Price: ₹{current_price}
- Target Price: ₹{target_price}
- Stop Loss: ₹{stop_loss}
- Volume Surge: {volume_ratio}x
- Pattern Confidence: {pattern_confidence}/100

---

## YOUR TASK:
Classify this breakout signal into ONE of these categories:

1. **TRUE_POSITIVE** - High-probability valid breakout
   - All criteria strongly aligned
   - Pattern(s) clearly confirmed
   - Volume supports move
   - Recommend entry

2. **FALSE_POSITIVE** - Likely noise or trap
   - Criteria met but context weak
   - Pattern incomplete or low-quality
   - Volume suspicious
   - Advise skip

3. **WEAK_UNCONFIRMED** - Borderline case
   - Some criteria strong, others weak
   - Pattern present but not ideal
   - Needs more confirmation
   - Suggest wait-and-watch

## OUTPUT FORMAT (JSON):
{
  "verdict": "TRUE_POSITIVE" | "FALSE_POSITIVE" | "WEAK_UNCONFIRMED",
  "confidence": 0.XX,
  "reasoning": "2-3 sentence explanation focusing on KEY factors",
  "risk_factors": ["Factor 1", "Factor 2"],
  "entry_suggestion": "Specific actionable advice"
}

Be concise. Focus on DISQUALIFYING factors (what could go wrong).
Traders value skepticism over hype.`;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset limit (100 validations per day)
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + 24 * 60 * 60 * 1000,
    });
    return true;
  }

  if (userLimit.count >= 100) {
    return false;
  }

  userLimit.count++;
  return true;
}

function buildValidationPrompt(signal: any, patterns: any): string {
  // Format patterns list
  let patternsText = 'No patterns detected';
  
  if (patterns && patterns.patterns && patterns.patterns.length > 0) {
    patternsText = patterns.patterns.map((p: any) => 
      `- ${p.pattern} (${p.type}): ${p.confidence}% confidence, ${p.direction} bias`
    ).join('\n');
  }

  // Calculate additional metrics
  const emaAlignment = signal.fivemin_ema20 && signal.daily_ema20
    ? (signal.current_price > signal.fivemin_ema20 && signal.current_price > signal.daily_ema20 ? 'Bullish' : 'Bearish')
    : 'Unknown';

  return AI_VALIDATION_PROMPT
    .replace('{symbol}', signal.symbol)
    .replace('{direction}', signal.predicted_direction)
    .replace('{momentum_score}', (signal.criteria_met / 6).toFixed(2))
    .replace('{volume_ratio}', (signal.volume_ratio || 1.0).toFixed(2))
    .replace('{trend_strength}', (signal.probability || 0.5).toFixed(2))
    .replace('{rsi_value}', (signal.rsi_value || 50).toFixed(2))
    .replace('{ema_alignment}', emaAlignment)
    .replace('{price_action_score}', (signal.confidence || 0.5).toFixed(2))
    .replace('{patterns_list}', patternsText)
    .replace('{current_price}', signal.current_price.toFixed(2))
    .replace('{target_price}', signal.target_price.toFixed(2))
    .replace('{stop_loss}', signal.stop_loss.toFixed(2))
    .replace(/{volume_ratio}/g, (signal.volume_ratio || 1.0).toFixed(2))
    .replace('{pattern_confidence}', (patterns?.confidence || 0).toFixed(0));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { success: false, error: 'Daily AI validation limit reached (100/day)' },
        { status: 429 }
      );
    }

    // Parse request
    const { symbol, direction } = await request.json();

    if (!symbol || !direction) {
      return NextResponse.json(
        { success: false, error: 'Symbol and direction are required' },
        { status: 400 }
      );
    }

    // Fetch signal from database
    const tableName = direction === 'bullish' 
      ? 'bullish_breakout_nse_eq' 
      : 'bearish_breakout_nse_eq';

    const { data: signals, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq('symbol', symbol)
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError || !signals || signals.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Signal not found' },
        { status: 404 }
      );
    }

    const signal = signals[0];

    // Check if already validated
    if (signal.ai_validation_status === 'completed') {
      return NextResponse.json({
        success: true,
        cached: true,
        validation: {
          verdict: signal.ai_verdict,
          confidence: signal.ai_confidence,
          reasoning: signal.ai_reasoning,
          risk_factors: signal.ai_risk_factors,
          entry_suggestion: signal.ai_entry_suggestion,
          validated_at: signal.ai_validated_at,
        },
      });
    }

    // Mark as pending
    await supabase
      .from(tableName)
      .update({ ai_validation_status: 'pending' })
      .eq('id', signal.id);

    // Parse patterns
    let patterns = null;
    try {
      if (signal.detected_patterns) {
        patterns = typeof signal.detected_patterns === 'string'
          ? JSON.parse(signal.detected_patterns)
          : signal.detected_patterns;
      }
    } catch (e) {
      console.error('Error parsing patterns:', e);
    }

    // Build prompt
    const prompt = buildValidationPrompt(signal, patterns);

    // Call Groq API
    console.log(`🤖 Calling Groq AI for ${symbol}...`);
    
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const resultText = completion.choices[0].message.content;
    if (!resultText) {
      throw new Error('Empty response from Groq');
    }

    const result = JSON.parse(resultText);

    // Validate response structure
    if (!result.verdict || !result.reasoning) {
      throw new Error('Invalid response structure from AI');
    }

    // Update database with validation result
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        ai_validation_status: 'completed',
        ai_verdict: result.verdict,
        ai_confidence: result.confidence || 0.5,
        ai_reasoning: result.reasoning,
        ai_risk_factors: result.risk_factors || [],
        ai_entry_suggestion: result.entry_suggestion || '',
        ai_validated_at: new Date().toISOString(),
      })
      .eq('id', signal.id);

    if (updateError) {
      console.error('Error updating validation:', updateError);
    }

    return NextResponse.json({
      success: true,
      validation: {
        verdict: result.verdict,
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning,
        risk_factors: result.risk_factors || [],
        entry_suggestion: result.entry_suggestion || '',
        validated_at: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    console.error('AI validation error:', error);
    
    // Try to update status to error
    try {
      const { symbol, direction } = await request.json();
      const tableName = direction === 'bullish' 
        ? 'bullish_breakout_nse_eq' 
        : 'bearish_breakout_nse_eq';
      
      const supabase = await createClient();
      await supabase
        .from(tableName)
        .update({ ai_validation_status: 'error' })
        .eq('symbol', symbol)
        .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());
    } catch (e) {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'AI validation failed',
      },
      { status: 500 }
    );
  }
}
