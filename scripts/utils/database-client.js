/**
 * Shared Database Client
 * Handles all Supabase interactions with retry logic
 */

const { createClient } = require("@supabase/supabase-js");

class DatabaseClient {
  constructor(config) {
    this.supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_KEY
    );
    this.maxRetries = config.MAX_DB_RETRIES || 3;
    this.retryDelay = config.DB_RETRY_DELAY || 2000;
  }

  /**
   * Execute query with retry logic
   */
  async queryWithRetry(operation, maxRetries = this.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.error(`❌ DB operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying in ${this.retryDelay}ms...`);
          await this.sleep(this.retryDelay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Get top N symbols from equity table
   */
  async getEquitySymbols(exchange, limit = 1000) {
    return this.queryWithRetry(async () => {
      const tableName = exchange === 'NSE' 
        ? 'nse_equity_top_1000_symbols' 
        : 'bse_equity_top_1000_symbols';
      
      const { data, error } = await this.supabase
        .from(tableName)
        .select("symbol, instrument_token, exchange, type, segment")
        .eq("is_active", true)
        .order("symbol", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    });
  }

  /**
   * Get NSE F&O symbols (NIFTY only, active PE/CE near ATM)
   */
  async getNseFoSymbols(underlying = 'NIFTY', limit = 50) {
    return this.queryWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('nse_fo_symbols')
        .select("symbol, instrument_token, exchange, segment, underlying, instrument_type, expiry, strike, option_type")
        .eq("is_active", true)
        .eq("underlying", underlying)
        .in("option_type", ["CE", "PE"])
        .gte("expiry", new Date().toISOString().split('T')[0]) // Active contracts only
        .order("expiry", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    });
  }

  /**
   * Get NSE F&O historical data
   */
  async getNseFoHistoricalData(symbol, limit = 50) {
    return this.queryWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('historical_prices_nse_fo')
        .select("date, time, timestamp, open, high, low, close, volume, open_interest")
        .eq("symbol", symbol)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ? data.reverse() : [];
    });
  }

  /**
   * Save NSE F&O signal
   */
  async saveNseFoSignal(signal) {
    return this.queryWithRetry(async () => {
      const { error } = await this.supabase
        .from('nse_fo_signals')
        .insert({
          symbol: signal.symbol,
          instrument_token: signal.instrument_token,
          underlying: signal.underlying,
          instrument_type: signal.instrument_type,
          expiry: signal.expiry,
          strike: signal.strike,
          option_type: signal.option_type,
          signal_type: signal.signal_type,
          entry_price: signal.entry_price,
          ema20_5min: signal.ema20_5min,
          rsi14_5min: signal.rsi14_5min,
          volume: signal.volume,
          avg_volume: signal.avg_volume,
          candle_time: signal.candle_time,
          target1: signal.target1,
          target2: signal.target2,
          stop_loss: signal.stop_loss,
          probability: signal.probability,
          criteria_met: signal.criteria_met,
          is_active: signal.is_active,
          created_at: signal.created_at,
        });

      if (error) {
        // If it's a duplicate key error, update the existing record
        if (error.code === '23505') {
          const { error: updateError } = await this.supabase
            .from('nse_fo_signals')
            .update({
              signal_type: signal.signal_type,
              entry_price: signal.entry_price,
              ema20_5min: signal.ema20_5min,
              rsi14_5min: signal.rsi14_5min,
              volume: signal.volume,
              avg_volume: signal.avg_volume,
              candle_time: signal.candle_time,
              target1: signal.target1,
              target2: signal.target2,
              stop_loss: signal.stop_loss,
              probability: signal.probability,
              criteria_met: signal.criteria_met,
              is_active: signal.is_active,
              created_at: signal.created_at,
            })
            .eq('symbol', signal.symbol)
            .eq('instrument_token', signal.instrument_token);

          if (updateError) throw updateError;
        } else {
          throw error;
        }
      }
      return true;
    });
  }

  /**
   * Get F&O symbols with filters
   */
  async getFoSymbols(exchange, underlyings, limit = 1000) {
    return this.queryWithRetry(async () => {
      const tableName = exchange === 'NSE'
        ? 'kite_nse_fo_symbols'
        : 'kite_bse_fo_symbols';
      
      let query = this.supabase
        .from(tableName)
        .select("symbol, instrument_token, underlying, instrument_type, expiry, strike, option_type")
        .eq("is_active", true);

      if (underlyings && underlyings.length > 0) {
        query = query.in("underlying", underlyings);
      }

      query = query.order("expiry", { ascending: true }).limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    });
  }

  /**
   * Get historical price data
   */
  async getHistoricalData(symbol, table, limit = 50) {
    return this.queryWithRetry(async () => {
      const { data, error } = await this.supabase
        .from(table)
        .select("date, time, timestamp, open, high, low, close, volume")
        .eq("symbol", symbol)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ? data.reverse() : [];
    });
  }

  /**
   * Get daily candles
   */
  async getDailyCandles(symbol, table, days = 20) {
    return this.queryWithRetry(async () => {
      const { data, error } = await this.supabase
        .from(table)
        .select("date, time, timestamp, open, high, low, close, volume")
        .eq("symbol", symbol)
        .in("time", ["15:30", "15:25", "15:20"]) // Market close candles (check multiple times for flexibility)
        .order("timestamp", { ascending: false })
        .limit(days);

      if (error) throw error;
      return data ? data.reverse() : [];
    });
  }

  /**
   * Save bullish signal (with UPSERT to prevent duplicates)
   */
  async saveBullishSignal(signal, tableName = "breakout_signals") {
    return this.queryWithRetry(async () => {
      const { error } = await this.supabase
        .from(tableName)
        .insert(signal);

      if (error) throw error;
      return true;
    });
  }

  /**
   * Save bearish signal
   */
  async saveBearishSignal(signal, tableName = "intraday_bearish_signals") {
    return this.queryWithRetry(async () => {
      const { error } = await this.supabase
        .from(tableName)
        .insert(signal);

      if (error) throw error;
      return true;
    });
  }

  /**
   * Save F&O signal
   */
  async saveFoSignal(signal, exchange = 'NSE') {
    const tableName = exchange === 'NSE' ? 'nse_fo_signals' : 'bse_fo_signals';
    
    return this.queryWithRetry(async () => {
      const { error } = await this.supabase
        .from(tableName)
        .upsert(
          {
            ...signal,
          },
          {
            onConflict: "symbol",
            ignoreDuplicates: false,
          }
        );

      if (error) throw error;
      return true;
    });
  }

  /**
   * Save BSE Swing Positional Bullish Signal
   */
  async saveBseSwingBullishSignal(signal) {
    return this.queryWithRetry(async () => {
      const { error } = await this.supabase
        .from('swing_positional_bullish')
        .upsert(
          {
            ...signal,
            exchange: 'BSE',
          },
          {
            onConflict: "symbol",
            ignoreDuplicates: false,
          }
        );

      if (error) throw error;
      return true;
    });
  }

  /**
   * Save BSE Swing Positional Bearish Signal
   */
  async saveBseSwingBearishSignal(signal) {
    return this.queryWithRetry(async () => {
      const { error } = await this.supabase
        .from('swing_positional_bearish')
        .upsert(
          {
            ...signal,
            exchange: 'BSE',
          },
          {
            onConflict: "symbol",
            ignoreDuplicates: false,
          }
        );

      if (error) throw error;
      return true;
    });
  }

  /**
   * Clean up stale signals (older than TTL)
   */
  async cleanupStaleSignals(tableName, ttlMinutes = 15) {
    return this.queryWithRetry(async () => {
      const cutoffTime = new Date(Date.now() - ttlMinutes * 60 * 1000).toISOString();
      
      const { error } = await this.supabase
        .from(tableName)
        .delete()
        .lt("created_at", cutoffTime);

      if (error) throw error;
      return true;
    });
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { DatabaseClient };
