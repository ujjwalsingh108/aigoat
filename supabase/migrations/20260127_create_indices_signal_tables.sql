-- =====================================================================
-- BREAKOUT SIGNAL TABLES FOR F&O AND BSE MARKETS
-- =====================================================================
-- These tables store breakout signals for derivatives and BSE markets
-- NOTE: NSE Equity signals already handled by bullish_breakout_nse_eq 
-- and bearish_breakout_nse_eq tables
-- =====================================================================

-- =====================================================================
-- 1. NSE F&O SIGNALS (NIFTY, BANKNIFTY F&O)
-- =====================================================================
create table public.nse_fo_signals (
  id bigserial not null,
  symbol text not null,
  instrument_token text not null,
  underlying text not null, -- NIFTY, BANKNIFTY, etc.
  instrument_type text not null, -- FUT, CE, PE
  expiry date not null,
  strike numeric null,
  option_type text null, -- CE, PE
  signal_type text not null, -- FO_BUY, FO_SELL
  entry_price numeric not null,
  ema20_5min numeric not null,
  rsi14_5min numeric null,
  volume bigint null,
  avg_volume bigint null,
  candle_time timestamp with time zone not null,
  target1 numeric null,
  target2 numeric null,
  stop_loss numeric null,
  probability numeric null,
  criteria_met integer null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint nse_fo_signals_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_nse_fo_signals_symbol on public.nse_fo_signals using btree (symbol) tablespace pg_default;
create index if not exists idx_nse_fo_signals_underlying on public.nse_fo_signals using btree (underlying) tablespace pg_default;
create index if not exists idx_nse_fo_signals_created_at on public.nse_fo_signals using btree (created_at desc) tablespace pg_default;
create index if not exists idx_nse_fo_signals_is_active on public.nse_fo_signals using btree (is_active) tablespace pg_default;
create index if not exists idx_nse_fo_signals_signal_type on public.nse_fo_signals using btree (signal_type) tablespace pg_default;
create index if not exists idx_nse_fo_signals_expiry on public.nse_fo_signals using btree (expiry) tablespace pg_default;

-- RLS Policies
alter table public.nse_fo_signals enable row level security;

create policy "Enable read access for all users"
  on public.nse_fo_signals
  for select
  using (true);

create policy "Service role has full access"
  on public.nse_fo_signals
  for all
  to service_role
  using (true)
  with check (true);

-- =====================================================================
-- 2. BANKNIFTY F&O SIGNALS (BANKNIFTY F&O)
-- =====================================================================
create table public.banknifty_fo_signals (
  id bigserial not null,
  symbol text not null,
  instrument_token text not null,
  underlying text not null default 'BANKNIFTY'::text,
  instrument_type text not null, -- FUT, CE, PE
  expiry date not null,
  strike numeric null,
  option_type text null, -- CE, PE
  signal_type text not null, -- FO_BUY, FO_SELL
  entry_price numeric not null,
  ema20_5min numeric not null,
  rsi14_5min numeric null,
  volume bigint null,
  avg_volume bigint null,
  candle_time timestamp with time zone not null,
  target1 numeric null,
  target2 numeric null,
  stop_loss numeric null,
  probability numeric null,
  criteria_met integer null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint banknifty_fo_signals_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_banknifty_fo_signals_symbol on public.banknifty_fo_signals using btree (symbol) tablespace pg_default;
create index if not exists idx_banknifty_fo_signals_created_at on public.banknifty_fo_signals using btree (created_at desc) tablespace pg_default;
create index if not exists idx_banknifty_fo_signals_is_active on public.banknifty_fo_signals using btree (is_active) tablespace pg_default;
create index if not exists idx_banknifty_fo_signals_signal_type on public.banknifty_fo_signals using btree (signal_type) tablespace pg_default;
create index if not exists idx_banknifty_fo_signals_expiry on public.banknifty_fo_signals using btree (expiry) tablespace pg_default;

-- RLS Policies
alter table public.banknifty_fo_signals enable row level security;

create policy "Enable read access for all users"
  on public.banknifty_fo_signals
  for select
  using (true);

create policy "Service role has full access"
  on public.banknifty_fo_signals
  for all
  to service_role
  using (true)
  with check (true);

-- =====================================================================
-- 3. BSE EQUITY SIGNALS (BSE Stocks)
-- =====================================================================
create table public.bse_equity_signals (
  id bigserial not null,
  symbol text not null,
  instrument_token text not null,
  signal_type text not null, -- BULLISH_BREAKOUT, BEARISH_BREAKDOWN
  entry_price numeric not null,
  ema20_5min numeric not null,
  rsi14_5min numeric null,
  volume bigint null,
  avg_volume bigint null,
  candle_time timestamp with time zone not null,
  target1 numeric null,
  target2 numeric null,
  stop_loss numeric null,
  probability numeric null,
  criteria_met integer null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint bse_equity_signals_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_bse_equity_signals_symbol on public.bse_equity_signals using btree (symbol) tablespace pg_default;
create index if not exists idx_bse_equity_signals_created_at on public.bse_equity_signals using btree (created_at desc) tablespace pg_default;
create index if not exists idx_bse_equity_signals_is_active on public.bse_equity_signals using btree (is_active) tablespace pg_default;
create index if not exists idx_bse_equity_signals_signal_type on public.bse_equity_signals using btree (signal_type) tablespace pg_default;

-- RLS Policies
alter table public.bse_equity_signals enable row level security;

create policy "Enable read access for all users"
  on public.bse_equity_signals
  for select
  using (true);

create policy "Service role has full access"
  on public.bse_equity_signals
  for all
  to service_role
  using (true)
  with check (true);

-- =====================================================================
-- 4. BSE F&O SIGNALS (BSE F&O - SENSEX, etc.)
-- =====================================================================
create table public.bse_fo_signals (
  id bigserial not null,
  symbol text not null,
  instrument_token text not null,
  underlying text not null, -- SENSEX, etc.
  instrument_type text not null, -- FUT, CE, PE
  expiry date not null,
  strike numeric null,
  option_type text null, -- CE, PE
  signal_type text not null, -- FO_BUY, FO_SELL
  entry_price numeric not null,
  ema20_5min numeric not null,
  rsi14_5min numeric null,
  volume bigint null,
  avg_volume bigint null,
  candle_time timestamp with time zone not null,
  target1 numeric null,
  target2 numeric null,
  stop_loss numeric null,
  probability numeric null,
  criteria_met integer null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint bse_fo_signals_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_bse_fo_signals_symbol on public.bse_fo_signals using btree (symbol) tablespace pg_default;
create index if not exists idx_bse_fo_signals_underlying on public.bse_fo_signals using btree (underlying) tablespace pg_default;
create index if not exists idx_bse_fo_signals_created_at on public.bse_fo_signals using btree (created_at desc) tablespace pg_default;
create index if not exists idx_bse_fo_signals_is_active on public.bse_fo_signals using btree (is_active) tablespace pg_default;
create index if not exists idx_bse_fo_signals_signal_type on public.bse_fo_signals using btree (signal_type) tablespace pg_default;
create index if not exists idx_bse_fo_signals_expiry on public.bse_fo_signals using btree (expiry) tablespace pg_default;

-- RLS Policies
alter table public.bse_fo_signals enable row level security;

create policy "Enable read access for all users"
  on public.bse_fo_signals
  for select
  using (true);

create policy "Service role has full access"
  on public.bse_fo_signals
  for all
  to service_role
  using (true)
  with check (true);

-- =====================================================================
-- SUMMARY
-- =====================================================================
-- Created 4 signal tables for new market segments:
-- 1. nse_fo_signals - NSE F&O (NIFTY, BANKNIFTY futures/options)
-- 2. banknifty_fo_signals - BANKNIFTY F&O only
-- 3. bse_equity_signals - BSE equity stocks
-- 4. bse_fo_signals - BSE F&O (SENSEX, etc.)
--
-- NOTE: NSE Equity signals are already handled by existing tables:
-- - bullish_breakout_nse_eq (for bullish signals)
-- - bearish_breakout_nse_eq (for bearish signals)
-- - BANKNIFTY equity stocks are filtered from these existing tables
--
-- Each table has:
-- - Full signal metadata (entry, targets, stop-loss, probability)
-- - Proper indexing for fast queries
-- - RLS policies for security
-- - Active status tracking
-- =====================================================================
