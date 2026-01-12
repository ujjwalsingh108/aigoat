-- Create bullish_breakout_nse_eq table for storing bullish breakout signals from NSE equity stocks
-- This replaces the old breakout_signals table with a more specific name

create table if not exists public.bullish_breakout_nse_eq (
  id bigserial not null,
  symbol text not null,
  signal_type text not null,
  probability numeric(3, 2) not null,
  criteria_met integer not null,
  daily_ema20 numeric(10, 2) null,
  fivemin_ema20 numeric(10, 2) null,
  rsi_value numeric(5, 2) null,
  volume_ratio numeric(5, 2) null,
  predicted_direction text null,
  target_price numeric(10, 2) null,
  stop_loss numeric(10, 2) null,
  confidence numeric(3, 2) null,
  created_at timestamp with time zone null default now(),
  created_by text null default 'system'::text,
  is_public boolean null default true,
  current_price numeric(10, 2) null,
  constraint bullish_breakout_nse_eq_pkey primary key (id)
) tablespace pg_default;

-- Create indexes for optimized queries
create index if not exists idx_bullish_breakout_nse_eq_symbol_time 
  on public.bullish_breakout_nse_eq 
  using btree (symbol, created_at desc) 
  tablespace pg_default;

create index if not exists idx_bullish_breakout_nse_eq_probability 
  on public.bullish_breakout_nse_eq 
  using btree (probability desc) 
  tablespace pg_default
  where (probability >= 0.7);

-- Add comment to describe the table
comment on table public.bullish_breakout_nse_eq is 'Stores bullish breakout signals detected from 2515 NSE equity stocks via real-time WebSocket scanner';
