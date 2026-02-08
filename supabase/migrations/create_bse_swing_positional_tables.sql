-- Create BSE Swing Positional Bullish Table
create table public.bse_swing_positional_bullish (
  id bigserial not null,
  symbol text not null,
  signal_type text not null,
  probability numeric(3, 2) not null,
  criteria_met integer not null,
  daily_ema20 numeric(10, 2) null,
  daily_sma50 numeric(10, 2) null,
  rsi_value numeric(5, 2) null,
  volume_ratio numeric(5, 2) null,
  weekly_volatility numeric(5, 2) null,
  market_cap_rank integer null,
  yearly_avg_volume bigint null,
  predicted_direction text null,
  target_price numeric(10, 2) null,
  stop_loss numeric(10, 2) null,
  confidence numeric(3, 2) null,
  current_price numeric(10, 2) null,
  created_at timestamp with time zone null default now(),
  created_by text null default 'system'::text,
  is_public boolean null default true,
  detected_patterns jsonb null,
  strongest_pattern text null,
  pattern_confidence numeric(5, 2) null,
  ai_validation_status text null,
  ai_verdict text null,
  constraint bse_swing_positional_bullish_pkey primary key (id)
) tablespace pg_default;

-- Create indexes for BSE Swing Positional Bullish
create index if not exists idx_bse_swing_positional_bullish_is_public 
  on public.bse_swing_positional_bullish using btree (is_public) tablespace pg_default
  where (is_public = true);

create index if not exists idx_bse_swing_positional_bullish_created_by 
  on public.bse_swing_positional_bullish using btree (created_by) tablespace pg_default;

create index if not exists idx_bse_swing_positional_bullish_symbol_time 
  on public.bse_swing_positional_bullish using btree (symbol, created_at desc) tablespace pg_default;

create index if not exists idx_bse_swing_positional_bullish_probability 
  on public.bse_swing_positional_bullish using btree (probability desc) tablespace pg_default
  where (probability >= 0.7);

create index if not exists idx_bse_swing_positional_bullish_created_at 
  on public.bse_swing_positional_bullish using btree (created_at desc) tablespace pg_default;

create index if not exists idx_bse_swing_positional_bullish_market_cap 
  on public.bse_swing_positional_bullish using btree (market_cap_rank) tablespace pg_default
  where (market_cap_rank is not null);

-- Create BSE Swing Positional Bearish Table
create table public.bse_swing_positional_bearish (
  id bigserial not null,
  symbol text not null,
  signal_type text not null,
  probability numeric(3, 2) not null,
  criteria_met integer not null,
  daily_ema20 numeric(10, 2) null,
  daily_sma50 numeric(10, 2) null,
  rsi_value numeric(5, 2) null,
  volume_ratio numeric(5, 2) null,
  weekly_volatility numeric(5, 2) null,
  market_cap_rank integer null,
  yearly_avg_volume bigint null,
  predicted_direction text null,
  target_price numeric(10, 2) null,
  stop_loss numeric(10, 2) null,
  confidence numeric(3, 2) null,
  current_price numeric(10, 2) null,
  created_at timestamp with time zone null default now(),
  created_by text null default 'system'::text,
  is_public boolean null default true,
  detected_patterns jsonb null,
  strongest_pattern text null,
  pattern_confidence numeric(5, 2) null,
  ai_validation_status text null,
  ai_verdict text null,
  constraint bse_swing_positional_bearish_pkey primary key (id)
) tablespace pg_default;

-- Create indexes for BSE Swing Positional Bearish
create index if not exists idx_bse_swing_positional_bearish_is_public 
  on public.bse_swing_positional_bearish using btree (is_public) tablespace pg_default
  where (is_public = true);

create index if not exists idx_bse_swing_positional_bearish_created_by 
  on public.bse_swing_positional_bearish using btree (created_by) tablespace pg_default;

create index if not exists idx_bse_swing_positional_bearish_symbol_time 
  on public.bse_swing_positional_bearish using btree (symbol, created_at desc) tablespace pg_default;

create index if not exists idx_bse_swing_positional_bearish_probability 
  on public.bse_swing_positional_bearish using btree (probability desc) tablespace pg_default
  where (probability >= 0.7);

create index if not exists idx_bse_swing_positional_bearish_created_at 
  on public.bse_swing_positional_bearish using btree (created_at desc) tablespace pg_default;

create index if not exists idx_bse_swing_positional_bearish_market_cap 
  on public.bse_swing_positional_bearish using btree (market_cap_rank) tablespace pg_default
  where (market_cap_rank is not null);

-- Enable Row Level Security
alter table public.bse_swing_positional_bullish enable row level security;
alter table public.bse_swing_positional_bearish enable row level security;

-- Create RLS Policies for BSE Swing Positional Bullish
create policy "Allow public read access for public signals"
  on public.bse_swing_positional_bullish
  for select
  using (is_public = true);

create policy "Allow authenticated users to insert"
  on public.bse_swing_positional_bullish
  for insert
  to authenticated
  with check (true);

create policy "Allow users to read their own signals"
  on public.bse_swing_positional_bullish
  for select
  using (auth.uid()::text = created_by);

create policy "Allow users to update their own signals"
  on public.bse_swing_positional_bullish
  for update
  using (auth.uid()::text = created_by);

-- Create RLS Policies for BSE Swing Positional Bearish
create policy "Allow public read access for public signals"
  on public.bse_swing_positional_bearish
  for select
  using (is_public = true);

create policy "Allow authenticated users to insert"
  on public.bse_swing_positional_bearish
  for insert
  to authenticated
  with check (true);

create policy "Allow users to read their own signals"
  on public.bse_swing_positional_bearish
  for select
  using (auth.uid()::text = created_by);

create policy "Allow users to update their own signals"
  on public.bse_swing_positional_bearish
  for update
  using (auth.uid()::text = created_by);
