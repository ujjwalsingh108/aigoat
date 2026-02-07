-- Migration: Create historical_prices_nse_swing_daily and historical_prices_bse_swing_daily tables
-- Purpose: Store daily candles for swing positional trading (1-15 days)

-- NSE Swing Daily Historical Prices
create table public.historical_prices_nse_swing_daily (
  id bigint generated always as identity not null,
  symbol text not null,
  date date not null,
  timestamp timestamp with time zone not null,
  interval_type text not null default 'day'::text,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume bigint null,
  open_interest bigint null,
  constraint historical_prices_nse_swing_daily_pkey primary key (id),
  constraint historical_prices_nse_swing_daily_symbol_date_key unique (symbol, date)
) TABLESPACE pg_default;

create index IF not exists idx_historical_prices_nse_swing_daily_symbol on public.historical_prices_nse_swing_daily using btree (symbol) TABLESPACE pg_default;

create index IF not exists idx_historical_prices_nse_swing_daily_date on public.historical_prices_nse_swing_daily using btree (date desc) TABLESPACE pg_default;

create index IF not exists idx_historical_prices_nse_swing_daily_symbol_date on public.historical_prices_nse_swing_daily using btree (symbol, date desc) TABLESPACE pg_default;

create index IF not exists idx_historical_prices_nse_swing_daily_timestamp on public.historical_prices_nse_swing_daily using btree ("timestamp" desc) TABLESPACE pg_default;

-- BSE Swing Daily Historical Prices
create table public.historical_prices_bse_swing_daily (
  id bigint generated always as identity not null,
  symbol text not null,
  date date not null,
  timestamp timestamp with time zone not null,
  interval_type text not null default 'day'::text,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume bigint null,
  open_interest bigint null,
  constraint historical_prices_bse_swing_daily_pkey primary key (id),
  constraint historical_prices_bse_swing_daily_symbol_date_key unique (symbol, date)
) TABLESPACE pg_default;

create index IF not exists idx_historical_prices_bse_swing_daily_symbol on public.historical_prices_bse_swing_daily using btree (symbol) TABLESPACE pg_default;

create index IF not exists idx_historical_prices_bse_swing_daily_date on public.historical_prices_bse_swing_daily using btree (date desc) TABLESPACE pg_default;

create index IF not exists idx_historical_prices_bse_swing_daily_symbol_date on public.historical_prices_bse_swing_daily using btree (symbol, date desc) TABLESPACE pg_default;

create index IF not exists idx_historical_prices_bse_swing_daily_timestamp on public.historical_prices_bse_swing_daily using btree ("timestamp" desc) TABLESPACE pg_default;

-- Enable Row Level Security (RLS)
ALTER TABLE public.historical_prices_nse_swing_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_prices_bse_swing_daily ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.historical_prices_nse_swing_daily
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON public.historical_prices_bse_swing_daily
  FOR SELECT USING (true);

-- Allow authenticated write access
CREATE POLICY "Allow authenticated write access" ON public.historical_prices_nse_swing_daily
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated write access" ON public.historical_prices_bse_swing_daily
  FOR ALL USING (auth.role() = 'authenticated');

-- Comments
COMMENT ON TABLE public.historical_prices_nse_swing_daily IS 'Daily historical prices for NSE equity stocks (swing trading 1-15 days)';
COMMENT ON TABLE public.historical_prices_bse_swing_daily IS 'Daily historical prices for BSE equity stocks (swing trading 1-15 days)';
