-- Create intraday_index_signals table for NIFTY/BANKNIFTY intraday strategy
-- 5-minute timeframe with EMA-based entries and fixed targets

create table if not exists public.intraday_index_signals (
  id bigserial not null,
  symbol text not null, -- 'NIFTY' or 'BANKNIFTY'
  signal_type text not null, -- 'INDEX_BUY' or 'INDEX_SELL'
  
  -- Entry details
  entry_price numeric(10, 2) not null,
  ema20_5min numeric(10, 2) null,
  
  -- Swing reference
  swing_reference_price numeric(10, 2) null, -- Recent swing low (buy) or swing high (sell)
  distance_from_swing numeric(10, 2) null, -- Distance in points
  
  -- Targets (fixed)
  target1 numeric(10, 2) not null, -- +/- 50 points
  target2 numeric(10, 2) not null, -- +/- 75 points
  stop_loss numeric(10, 2) null, -- Implicit from 150pt constraint
  
  -- Signal metadata
  candle_time timestamp with time zone not null, -- 5m candle close time
  signal_direction text not null, -- 'LONG' or 'SHORT'
  is_active boolean default true,
  
  -- Tracking
  created_at timestamp with time zone default now(),
  created_by text default 'intraday_index_scanner'::text,
  is_public boolean default true,
  
  constraint intraday_index_signals_pkey primary key (id)
) tablespace pg_default;

-- Indexes for performance
create index if not exists idx_intraday_index_signals_symbol_time 
  on public.intraday_index_signals 
  using btree (symbol, candle_time desc) 
  tablespace pg_default;

create index if not exists idx_intraday_index_signals_active 
  on public.intraday_index_signals 
  using btree (is_active, created_at desc) 
  tablespace pg_default
  where (is_active = true);

create index if not exists idx_intraday_index_signals_created_at 
  on public.intraday_index_signals 
  using btree (created_at desc) 
  tablespace pg_default;

-- Table comment
comment on table public.intraday_index_signals is 'Intraday signals for NIFTY/BANKNIFTY on 5-minute timeframe. Buy: Price > 20 EMA, within 150pts of swing low. Sell: Price < 20 EMA, within 150pts of swing high. Fixed targets: ±50, ±75 points.';

-- Column comments
comment on column public.intraday_index_signals.symbol is 'Index name: NIFTY or BANKNIFTY';
comment on column public.intraday_index_signals.swing_reference_price is 'Recent swing low (for buy) or swing high (for sell)';
comment on column public.intraday_index_signals.distance_from_swing is 'Distance in points from swing reference';
comment on column public.intraday_index_signals.candle_time is '5-minute candle close timestamp (IST)';

-- Permissions
GRANT SELECT, INSERT, UPDATE ON intraday_index_signals TO service_role;
GRANT SELECT ON intraday_index_signals TO authenticated;
