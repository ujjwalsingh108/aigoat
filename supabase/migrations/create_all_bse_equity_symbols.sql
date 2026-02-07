-- Migration: Create all_bse_equity_symbols table with RLS
-- Purpose: Store all BSE equity symbols master data

create table public.all_bse_equity_symbols (
  symbol text not null,
  instrument_token text not null,
  exchange text not null default 'BSE'::text,
  type text not null default 'EQ'::text,
  segment text not null default 'BSE'::text,
  company_name text null,
  isin text null,
  lot_size integer null default 1,
  tick_size numeric null default 0.05,
  is_active boolean null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint all_bse_equity_symbols_pkey primary key (symbol)
) TABLESPACE pg_default;

create index IF not exists idx_bse_equity_symbol on public.all_bse_equity_symbols using btree (symbol) TABLESPACE pg_default;

create index IF not exists idx_bse_equity_instrument_token on public.all_bse_equity_symbols using btree (instrument_token) TABLESPACE pg_default;

create index IF not exists idx_bse_equity_is_active on public.all_bse_equity_symbols using btree (is_active) TABLESPACE pg_default;

-- Enable Row Level Security (RLS)
ALTER TABLE public.all_bse_equity_symbols ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.all_bse_equity_symbols
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update
CREATE POLICY "Allow authenticated write access" ON public.all_bse_equity_symbols
  FOR ALL USING (
    auth.role() = 'authenticated'
  );

-- Comment for documentation
COMMENT ON TABLE public.all_bse_equity_symbols IS 'Master table for all BSE equity symbols';
