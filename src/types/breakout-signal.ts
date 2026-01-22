// Chart Pattern Types
export type PatternType = 'candlestick' | 'triangle' | 'reversal' | 'continuation';
export type PatternDirection = 'bullish' | 'bearish' | 'neutral';

export interface DetectedPattern {
  pattern: string;
  direction: PatternDirection;
  confidence: number;
  type: PatternType;
  description: string;
  breakoutLevel?: number;
  target?: number;
  poleGain?: number;
  retracement?: number;
}

export interface PatternAnalysis {
  detected: DetectedPattern[];
  strongest: DetectedPattern | null;
  aggregate_confidence: number;
  confluence: boolean;
  total_patterns: number;
}

export interface AIValidation {
  status: null | 'pending' | 'completed' | 'error';
  verdict: null | 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'WEAK_UNCONFIRMED';
  confidence: null | number;
  reasoning: null | string;
  risk_factors: null | string[];
  entry_suggestion: null | string;
  validated_at: null | string;
}

// Breakout Signal Interface
export type BreakoutSignal = {
  id: number;
  symbol: string;
  signal_type: "BULLISH_BREAKOUT" | "BEARISH_BREAKDOWN" | "NEUTRAL";
  probability: number;
  criteria_met: number;
  current_price: number;
  daily_ema20: number;
  fivemin_ema20: number;
  rsi_value: number;
  volume_ratio: number;
  predicted_direction: "UP" | "DOWN" | "SIDEWAYS";
  target_price: number;
  stop_loss: number;
  confidence: number;
  created_at: string;
  user_id?: string;
  created_by?: string;
  is_public?: boolean;
  
  // Pattern detection fields
  detected_patterns?: PatternAnalysis;
  strongest_pattern?: string | null;
  pattern_confidence?: number | null;
  
  // AI validation fields
  ai_validation?: AIValidation;
};

// Intraday Bearish Signal Interface (Optimized Schema)
export type IntradayBearishSignal = {
  id: number;
  symbol: string;
  signal_type: "BEARISH_INTRADAY";
  probability: number;
  criteria_met: number; // Out of 6 criteria
  current_price: number;
  opening_price: number;
  daily_ema20: number;
  fivemin_ema20: number;
  rsi_value: number;
  volume_ratio: number; // avg_volume_3days / previous_day_volume
  target_price: number;
  stop_loss: number;
  confidence: number;
  created_at: string;
  created_by?: string;
  
  // Pattern detection fields
  detected_patterns?: PatternAnalysis;
  strongest_pattern?: string | null;
  pattern_confidence?: number | null;
  
  // AI validation fields
  ai_validation?: AIValidation;
};
