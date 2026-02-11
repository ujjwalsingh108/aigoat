const Groq = require("groq-sdk");

// =================================================================
// 🤖 AI-POWERED BREAKOUT VALIDATION FILTER
// =================================================================

class AiBreakoutFilter {
  constructor(config = {}) {
    this.enabled = !!process.env.GROQ_API_KEY;
    this.groq = this.enabled ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
    this.model = config.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    this.temperature = config.temperature || 0.3; // Low temperature for consistent analysis
    this.maxTokens = config.maxTokens || 500;
    this.cacheTTL = config.cacheTTL || 60 * 5; // 5 minutes
    this.cache = new Map();
    this.stats = {
      total_validations: 0,
      true_positives: 0,
      false_positives: 0,
      weak_signals: 0,
      errors: 0,
      cache_hits: 0,
    };

    if (!this.enabled) {
      console.warn("⚠️ AI Breakout Filter DISABLED - GROQ_API_KEY not found");
    } else {
      console.log(`✅ AI Breakout Filter ENABLED - Model: ${this.model}`);
    }
  }

  /**
   * Validate a breakout signal using AI
   * @param {Object} signal - Signal object with technical data
   * @param {Object} context - Additional context (patterns, candles, etc)
   * @returns {Promise<Object>} Validation result
   */
  async validateBreakout(signal, context = {}) {
    if (!this.enabled) {
      // If AI disabled, pass through with default confidence
      return {
        verdict: "UNVALIDATED",
        confidence: signal.probability || 0.5,
        reasoning: "AI validation disabled (no API key)",
        risk_factors: [],
        entry_suggestion: "Proceed with caution",
        ai_validated: false,
      };
    }

    try {
      // Check cache
      const cacheKey = this.getCacheKey(signal);
      const cached = this.getCached(cacheKey);
      if (cached) {
        this.stats.cache_hits++;
        return cached;
      }

      // Build validation prompt
      const prompt = this.buildPrompt(signal, context);

      // Call Groq API
      const startTime = Date.now();
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an expert quantitative trader specializing in technical analysis and breakout validation. You provide concise, actionable assessments. Always respond in valid JSON format.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        response_format: { type: "json_object" },
      });

      const responseTime = Date.now() - startTime;
      const aiResponse = completion.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error("Empty response from AI");
      }

      // Parse AI response
      const validation = JSON.parse(aiResponse);
      
      // Ensure required fields
      const result = {
        verdict: validation.verdict || "WEAK_UNCONFIRMED",
        confidence: parseFloat(validation.confidence) || 0.5,
        reasoning: validation.reasoning || "No reasoning provided",
        risk_factors: validation.risk_factors || [],
        entry_suggestion: validation.entry_suggestion || "Monitor closely",
        ai_validated: true,
        response_time_ms: responseTime,
        model: this.model,
      };

      // Update stats
      this.stats.total_validations++;
      if (result.verdict === "TRUE_POSITIVE") this.stats.true_positives++;
      else if (result.verdict === "FALSE_POSITIVE") this.stats.false_positives++;
      else this.stats.weak_signals++;

      // Cache result
      this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      this.stats.errors++;
      
      // Check if rate limit error
      const isRateLimit = error.message && (
        error.message.includes('rate limit') || 
        error.message.includes('Rate limit') ||
        error.message.includes('429')
      );
      
      if (isRateLimit) {
        console.warn(`⏳ Groq API rate limit reached - signal will be saved without AI validation`);
      } else {
        console.error("❌ AI validation error:", error.message);
      }

      // Fallback: return unvalidated signal
      return {
        verdict: "ERROR",
        confidence: signal.probability || 0.5,
        reasoning: isRateLimit ? 'Rate limit reached' : `AI validation failed: ${error.message}`,
        risk_factors: ["AI validation unavailable"],
        entry_suggestion: "Use manual judgment",
        ai_validated: false,
        error: error.message,
      };
    }
  }

  /**
   * Build validation prompt for AI
   */
  buildPrompt(signal, context) {
    const { patterns, historicalCandles } = context;

    // Format patterns
    let patternsText = "No patterns detected";
    if (patterns && patterns.strongest) {
      patternsText = `Strongest: ${patterns.strongest.name} (${patterns.strongest.type}, ${patterns.strongest.confidence}% confidence)`;
      if (patterns.patterns && patterns.patterns.length > 1) {
        const others = patterns.patterns.slice(1, 4).map(p => `${p.name} (${p.confidence}%)`).join(", ");
        patternsText += `\nOthers: ${others}`;
      }
    }

    // Calculate price change context
    let priceContext = "";
    if (historicalCandles && historicalCandles.length >= 10) {
      const recentCandles = historicalCandles.slice(-10);
      const oldestPrice = parseFloat(recentCandles[0].close);
      const currentPrice = parseFloat(signal.entry_price || signal.current_price);
      const priceChange = ((currentPrice - oldestPrice) / oldestPrice * 100).toFixed(2);
      priceContext = `\n- 10-candle price change: ${priceChange}%`;
    }

    return `You are validating a ${signal.signal_type} signal for ${signal.symbol}.

SIGNAL DETAILS:
- Symbol: ${signal.symbol}
- Direction: ${signal.signal_direction || signal.predicted_direction || "UNKNOWN"}
- Entry Price: ₹${(signal.entry_price || signal.current_price).toFixed(2)}
- Target: ₹${signal.target_price.toFixed(2)} (${((signal.target_price / (signal.entry_price || signal.current_price) - 1) * 100).toFixed(2)}%)
- Stop Loss: ₹${signal.stop_loss ? signal.stop_loss.toFixed(2) : "N/A"}

TECHNICAL INDICATORS:
- EMA20 (5min): ₹${signal.ema20_5min ? signal.ema20_5min.toFixed(2) : "N/A"}
- RSI: ${signal.rsi ? signal.rsi.toFixed(2) : signal.rsi_value ? signal.rsi_value.toFixed(2) : "N/A"}
- Volatility: ${signal.volatility ? signal.volatility.toFixed(2) + "%" : "N/A"}
- Volume Ratio: ${signal.volume_ratio ? signal.volume_ratio.toFixed(2) + "x" : "Unknown"}

CRITERIA MET:
${signal.criteria_met || "Not provided"}

CHART PATTERNS:
${patternsText}
${signal.has_confirming_pattern ? "✓ Pattern confirms signal direction" : "✗ No confirming pattern"}${priceContext}

QUALITY SCORE:
- Overall Probability: ${((signal.probability || signal.confidence || 0.5) * 100).toFixed(0)}%
- Criteria Score: ${signal.criteria_met ? "N/A" : "Unknown"}

TASK:
Classify this signal as:
1. TRUE_POSITIVE - High-probability valid breakout (recommend entry)
2. FALSE_POSITIVE - Likely false breakout/noise (recommend skip)
3. WEAK_UNCONFIRMED - Borderline signal (recommend wait-and-watch)

Consider:
- Is the pattern quality sufficient?
- Does volume support the move?
- Are indicators aligned or conflicting?
- What could invalidate this signal?
- Risk/reward ratio acceptable?

Respond ONLY with valid JSON:
{
  "verdict": "TRUE_POSITIVE" | "FALSE_POSITIVE" | "WEAK_UNCONFIRMED",
  "confidence": 0.XX,
  "reasoning": "2-3 sentences explaining key factors",
  "risk_factors": ["List 2-3 specific risks"],
  "entry_suggestion": "Specific actionable advice for trader"
}`;
  }

  /**
   * Generate cache key for signal
   */
  getCacheKey(signal) {
    return `${signal.symbol}_${signal.signal_type}_${Math.floor(Date.now() / (this.cacheTTL * 1000))}`;
  }

  /**
   * Get cached validation result
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL * 1000) {
      return cached.data;
    }
    return null;
  }

  /**
   * Cache validation result
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Cleanup old cache entries
    if (this.cache.size > 1000) {
      const oldestKeys = Array.from(this.cache.keys()).slice(0, 100);
      oldestKeys.forEach(k => this.cache.delete(k));
    }
  }

  /**
   * Get validation statistics
   */
  getStats() {
    const total = this.stats.total_validations;
    return {
      ...this.stats,
      true_positive_rate: total > 0 ? (this.stats.true_positives / total * 100).toFixed(1) + "%" : "0%",
      false_positive_rate: total > 0 ? (this.stats.false_positives / total * 100).toFixed(1) + "%" : "0%",
      error_rate: total > 0 ? (this.stats.errors / total * 100).toFixed(1) + "%" : "0%",
      cache_hit_rate: total > 0 ? (this.stats.cache_hits / total * 100).toFixed(1) + "%" : "0%",
    };
  }

  /**
   * Log statistics
   */
  logStats() {
    const stats = this.getStats();
    console.log("\n📊 AI Breakout Filter Statistics:");
    console.log(`   Total Validations: ${stats.total_validations}`);
    console.log(`   ✅ True Positives: ${stats.true_positives} (${stats.true_positive_rate})`);
    console.log(`   ❌ False Positives: ${stats.false_positives} (${stats.false_positive_rate})`);
    console.log(`   ⚠️  Weak Signals: ${stats.weak_signals}`);
    console.log(`   🔥 Errors: ${stats.errors} (${stats.error_rate})`);
    console.log(`   💾 Cache Hits: ${stats.cache_hits} (${stats.cache_hit_rate})\n`);
  }

  /**
   * Check if signal should be saved based on AI verdict
   */
  shouldSaveSignal(aiResult, minConfidence = 0.6) {
    if (!aiResult.ai_validated) {
      // If AI validation failed/disabled, use original signal logic
      return true;
    }

    // Only save TRUE_POSITIVE signals with sufficient confidence
    if (aiResult.verdict === "TRUE_POSITIVE" && aiResult.confidence >= minConfidence) {
      return true;
    }

    // Optionally save WEAK_UNCONFIRMED for monitoring
    if (aiResult.verdict === "WEAK_UNCONFIRMED" && aiResult.confidence >= 0.5) {
      return true; // You can change this to false to be more strict
    }

    // Skip FALSE_POSITIVE signals
    return false;
  }
}

module.exports = { AiBreakoutFilter };
