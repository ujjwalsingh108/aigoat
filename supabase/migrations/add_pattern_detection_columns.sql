-- Add pattern detection columns to existing tables
-- Run this migration in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- Add columns to bullish_breakout_nse_eq table
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE bullish_breakout_nse_eq 
ADD COLUMN IF NOT EXISTS detected_patterns JSONB,
ADD COLUMN IF NOT EXISTS strongest_pattern VARCHAR(50),
ADD COLUMN IF NOT EXISTS pattern_confidence NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS ai_validation_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS ai_verdict VARCHAR(30),
ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS ai_risk_factors JSONB,
ADD COLUMN IF NOT EXISTS ai_entry_suggestion TEXT,
ADD COLUMN IF NOT EXISTS ai_validated_at TIMESTAMP WITH TIME ZONE;

-- ═══════════════════════════════════════════════════════════════
-- Add columns to bearish_breakout_nse_eq table
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE bearish_breakout_nse_eq 
ADD COLUMN IF NOT EXISTS detected_patterns JSONB,
ADD COLUMN IF NOT EXISTS strongest_pattern VARCHAR(50),
ADD COLUMN IF NOT EXISTS pattern_confidence NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS ai_validation_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS ai_verdict VARCHAR(30),
ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS ai_risk_factors JSONB,
ADD COLUMN IF NOT EXISTS ai_entry_suggestion TEXT,
ADD COLUMN IF NOT EXISTS ai_validated_at TIMESTAMP WITH TIME ZONE;

-- ═══════════════════════════════════════════════════════════════
-- Create indexes for better query performance
-- ═══════════════════════════════════════════════════════════════

-- Index on pattern confidence for sorting
CREATE INDEX IF NOT EXISTS idx_bullish_pattern_confidence 
ON bullish_breakout_nse_eq(pattern_confidence DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_bearish_pattern_confidence 
ON bearish_breakout_nse_eq(pattern_confidence DESC NULLS LAST);

-- Index on strongest pattern for filtering
CREATE INDEX IF NOT EXISTS idx_bullish_strongest_pattern 
ON bullish_breakout_nse_eq(strongest_pattern) 
WHERE strongest_pattern IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bearish_strongest_pattern 
ON bearish_breakout_nse_eq(strongest_pattern) 
WHERE strongest_pattern IS NOT NULL;

-- Index on AI verdict for filtering validated signals
CREATE INDEX IF NOT EXISTS idx_bullish_ai_verdict 
ON bullish_breakout_nse_eq(ai_verdict) 
WHERE ai_verdict IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bearish_ai_verdict 
ON bearish_breakout_nse_eq(ai_verdict) 
WHERE ai_verdict IS NOT NULL;

-- Composite index for pattern + AI filtered queries
CREATE INDEX IF NOT EXISTS idx_bullish_pattern_ai_composite 
ON bullish_breakout_nse_eq(pattern_confidence DESC, ai_verdict) 
WHERE pattern_confidence IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bearish_pattern_ai_composite 
ON bearish_breakout_nse_eq(pattern_confidence DESC, ai_verdict) 
WHERE pattern_confidence IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- Create view for frontend consumption
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW screener_signals_with_patterns AS
SELECT 
  'bullish' as direction,
  id,
  symbol,
  signal_type,
  probability,
  criteria_met,
  current_price,
  daily_ema20,
  fivemin_ema20,
  rsi_value,
  volume_ratio,
  predicted_direction,
  target_price,
  stop_loss,
  confidence,
  
  -- Pattern info (always loaded)
  detected_patterns,
  strongest_pattern,
  pattern_confidence,
  
  -- AI validation (lazy loaded)
  CASE 
    WHEN ai_validation_status IS NULL THEN NULL
    ELSE jsonb_build_object(
      'status', ai_validation_status,
      'verdict', ai_verdict,
      'confidence', ai_confidence,
      'reasoning', ai_reasoning,
      'risk_factors', ai_risk_factors,
      'entry_suggestion', ai_entry_suggestion,
      'validated_at', ai_validated_at
    )
  END as ai_validation,
  
  created_at,
  created_by
FROM bullish_breakout_nse_eq
WHERE created_at > NOW() - INTERVAL '15 minutes'

UNION ALL

SELECT 
  'bearish' as direction,
  id,
  symbol,
  signal_type,
  probability,
  criteria_met,
  current_price,
  daily_ema20,
  fivemin_ema20,
  rsi_value,
  volume_ratio,
  predicted_direction,
  target_price,
  stop_loss,
  confidence,
  
  -- Pattern info
  detected_patterns,
  strongest_pattern,
  pattern_confidence,
  
  -- AI validation
  CASE 
    WHEN ai_validation_status IS NULL THEN NULL
    ELSE jsonb_build_object(
      'status', ai_validation_status,
      'verdict', ai_verdict,
      'confidence', ai_confidence,
      'reasoning', ai_reasoning,
      'risk_factors', ai_risk_factors,
      'entry_suggestion', ai_entry_suggestion,
      'validated_at', ai_validated_at
    )
  END as ai_validation,
  
  created_at,
  created_by
FROM bearish_breakout_nse_eq
WHERE created_at > NOW() - INTERVAL '15 minutes'

ORDER BY pattern_confidence DESC NULLS LAST, volume_ratio DESC;

-- ═══════════════════════════════════════════════════════════════
-- Grant permissions
-- ═══════════════════════════════════════════════════════════════

-- Grant access to service role
GRANT SELECT, INSERT, UPDATE ON bullish_breakout_nse_eq TO service_role;
GRANT SELECT, INSERT, UPDATE ON bearish_breakout_nse_eq TO service_role;
GRANT SELECT ON screener_signals_with_patterns TO service_role;

-- Grant read access to authenticated users
GRANT SELECT ON screener_signals_with_patterns TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- NOTES
-- ═══════════════════════════════════════════════════════════════

-- Pattern confidence: 0-100 score
-- AI validation status: null | 'pending' | 'completed' | 'error'
-- AI verdict: 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'WEAK_UNCONFIRMED'
-- AI confidence: 0.00-1.00 score

COMMENT ON COLUMN bullish_breakout_nse_eq.detected_patterns IS 'JSONB array of all detected patterns with metadata';
COMMENT ON COLUMN bullish_breakout_nse_eq.strongest_pattern IS 'Name of highest confidence pattern';
COMMENT ON COLUMN bullish_breakout_nse_eq.pattern_confidence IS 'Aggregate pattern confidence score (0-100)';
COMMENT ON COLUMN bullish_breakout_nse_eq.ai_validation_status IS 'AI validation lifecycle: null | pending | completed | error';
COMMENT ON COLUMN bullish_breakout_nse_eq.ai_verdict IS 'AI classification: TRUE_POSITIVE | FALSE_POSITIVE | WEAK_UNCONFIRMED';
