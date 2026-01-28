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
        ? 'kite_nse_equity_symbols' 
        : 'kite_bse_equity_symbols';
      
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
  async getDailyCandles(symbol, table, days = 365) {
    return this.queryWithRetry(async () => {
      const { data, error } = await this.supabase
        .from(table)
        .select("date, time, timestamp, open, high, low, close, volume")
        .eq("symbol", symbol)
        .eq("time", "15:30") // Daily close
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
        .upsert(
          {
            ...signal,
            last_scanned_at: new Date().toISOString(),
          },
          {
            onConflict: "symbol,signal_type",
            ignoreDuplicates: false,
          }
        );

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
        .upsert(
          {
            ...signal,
            last_scanned_at: new Date().toISOString(),
          },
          {
            onConflict: "symbol,signal_type",
            ignoreDuplicates: false,
          }
        );

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
            last_scanned_at: new Date().toISOString(),
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
        .lt("last_scanned_at", cutoffTime);

      if (error) throw error;
      return true;
    });
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { DatabaseClient };
