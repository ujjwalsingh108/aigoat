-- Create swing_positional_bearish table for storing swing positional bearish signals (1-15 days)
-- Mirror of swing_positional_bullish with bearish criteria

create table if not exists public.swing_positional_bearish (
  id bigserial not null,
  symbol text not null,
  signal_type text not null,
  probability numeric(3, 2) not null,
  criteria_met integer not null,
  
  -- Technical indicators for swing trading
  daily_ema20 numeric(10, 2) null,
  daily_sma50 numeric(10, 2) null,
  rsi_value numeric(5, 2) null,
  volume_ratio numeric(5, 2) null,
  weekly_volatility numeric(5, 2) null, -- Weekly price movement percentage (1-5%)
  market_cap_rank integer null, -- Rank within NIFTY 2500 universe
  yearly_avg_volume bigint null, -- Yearly average volume for comparison
  
  -- Price targets and stop loss
  predicted_direction text null,
  target_price numeric(10, 2) null,
  stop_loss numeric(10, 2) null,
  confidence numeric(3, 2) null,
  current_price numeric(10, 2) null,
  
  -- Metadata
  created_at timestamp with time zone null default now(),
  created_by text null default 'system'::text,
  is_public boolean null default true,
  
  -- Pattern detection fields (for future integration)
  detected_patterns jsonb null,
  strongest_pattern text null,
  pattern_confidence numeric(5, 2) null,
  ai_validation_status text null,
  ai_verdict text null,
  
  constraint swing_positional_bearish_pkey primary key (id)
) tablespace pg_default;

-- Create indexes for optimized queries
create index if not exists idx_swing_positional_bearish_symbol_time 
  on public.swing_positional_bearish 
  using btree (symbol, created_at desc) 
  tablespace pg_default;

create index if not exists idx_swing_positional_bearish_probability 
  on public.swing_positional_bearish 
  using btree (probability desc) 
  tablespace pg_default
  where (probability >= 0.7);

create index if not exists idx_swing_positional_bearish_created_at 
  on public.swing_positional_bearish 
  using btree (created_at desc) 
  tablespace pg_default;

create index if not exists idx_swing_positional_bearish_market_cap 
  on public.swing_positional_bearish 
  using btree (market_cap_rank) 
  tablespace pg_default
  where (market_cap_rank is not null);

-- Add comment to describe the table
comment on table public.swing_positional_bearish is 'Stores swing positional bearish signals (1-15 days holding period) detected from NIFTY 2500 equity stocks with 6-filter strategy: universe, trend (BELOW 20 EMA, BELOW 50 SMA), momentum (RSI < 50 && > 20), volume (2x yearly avg), volatility (1-5% weekly), market cap ranking';

-- Add column comments
comment on column public.swing_positional_bearish.weekly_volatility is 'Weekly price movement percentage - must be between 1-5% for signal';
comment on column public.swing_positional_bearish.market_cap_rank is 'Market cap rank within NIFTY 2500 universe (1 = highest)';
comment on column public.swing_positional_bearish.yearly_avg_volume is 'Yearly average volume for volume ratio comparison';
comment on column public.swing_positional_bearish.daily_sma50 is '50-period Simple Moving Average on daily timeframe for trend confirmation';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON swing_positional_bearish TO service_role;
GRANT SELECT ON swing_positional_bearish TO authenticated;
