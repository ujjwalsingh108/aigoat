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
   * Falls back to including today's expiry and skips is_active filter on expiry-day.
   */
  async getNseFoSymbols(underlying = 'NIFTY', limit = 1000) {
    return this.queryWithRetry(async () => {
      // Get symbols that have historical data
      const { data: symbolsWithData, error: histError } = await this.supabase
        .from('historical_prices_nse_fo')
        .select('symbol')
        .eq('underlying', underlying);

      if (histError) throw histError;

      const symbolsSet = new Set((symbolsWithData || []).map(row => row.symbol));
      const symbolsArray = Array.from(symbolsSet);

      if (symbolsArray.length === 0) {
        console.warn('⚠️ No historical data found for NSE F&O symbols');
        return [];
      }

      console.log(`📊 Found ${symbolsArray.length} unique symbols with historical data`);

      const today = new Date().toISOString().split('T')[0];

      // Primary query: active contracts expiring today or later
      let { data, error } = await this.supabase
        .from('nse_fo_symbols')
        .select("symbol, instrument_token, exchange, segment, underlying, instrument_type, expiry, strike, option_type")
        .eq("underlying", underlying)
        .in("option_type", ["CE", "PE"])
        .in("symbol", symbolsArray)
        .gte("expiry", today)
        .order("expiry", { ascending: true })
        .order("strike", { ascending: true })
        .limit(limit);

      if (error) throw error;

      // Fallback: if 0 results, drop expiry filter — handles expiry-day edge case
      // where contracts are still tradeable but date == today
      if (!data || data.length === 0) {
        console.warn(`⚠️ No F&O symbols with expiry >= ${today}, trying without expiry filter (expiry-day fallback)...`);
        const { data: fallbackData, error: fallbackError } = await this.supabase
          .from('nse_fo_symbols')
          .select("symbol, instrument_token, exchange, segment, underlying, instrument_type, expiry, strike, option_type")
          .eq("underlying", underlying)
          .in("option_type", ["CE", "PE"])
          .in("symbol", symbolsArray)
          .order("expiry", { ascending: false }) // Most recent first for fallback
          .order("strike", { ascending: true })
          .limit(limit);

        if (fallbackError) throw fallbackError;
        data = fallbackData;
      }

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
   * Get historical price data (single symbol)
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
   * BULK fetch historical data for ALL symbols in ONE query.
   * Fetches last `windowMinutes` minutes of candles and groups by symbol.
   * This replaces per-symbol queries and reduces DB load by ~99%.
   *
   * @param {string[]} symbols      Array of symbol strings
   * @param {string}   table        Table name (e.g. 'historical_prices_nse_equity')
   * @param {number}   candlesNeeded  Min candles per symbol needed (default 50)
   * @param {number}   windowMinutes  Look-back window in minutes (default 260 = ~52 5-min candles)
   * @returns {Map<string, Array>}  symbol → candles[] (ascending by timestamp)
   */
  async getBulkHistoricalData(symbols, table, candlesNeeded = 50, windowMinutes = 260) {
    if (!symbols || symbols.length === 0) return new Map();

    const isSwingTable = table.includes('swing_hourly');
    const windowMs = windowMinutes * 60 * 1000;
    const since = new Date(Date.now() - windowMs).toISOString();

    return this.queryWithRetry(async () => {
      const selectCols = isSwingTable
        ? "symbol, date, timestamp, open, high, low, close, volume"
        : "symbol, date, time, timestamp, open, high, low, close, volume";

      // Fetch in chunks of 500 symbols to avoid URL length limits
      const CHUNK = 500;
      const allRows = [];
      for (let i = 0; i < symbols.length; i += CHUNK) {
        const chunk = symbols.slice(i, i + CHUNK);
        const { data, error } = await this.supabase
          .from(table)
          .select(selectCols)
          .in("symbol", chunk)
          .gte("timestamp", since)
          .order("timestamp", { ascending: true })
          .limit(100000);

        if (error) throw error;
        if (data) allRows.push(...data);
      }

      // Group by symbol → Map<symbol, candle[]>
      const grouped = new Map();
      for (const row of allRows) {
        if (!grouped.has(row.symbol)) grouped.set(row.symbol, []);
        grouped.get(row.symbol).push(row);
      }
      return grouped;
    });
  }

  /**
   * BULK fetch daily candles for ALL symbols in ONE query.
   * @param {string[]} symbols  Array of symbol strings
   * @param {string}   table    Table name
   * @param {number}   days     Calendar days to look back (default 30)
   * @returns {Map<string, Array>}  symbol → daily candles[] (ascending)
   */
  async getBulkDailyCandles(symbols, table, days = 30) {
    if (!symbols || symbols.length === 0) return new Map();

    const isSwingTable = table.includes('swing_hourly');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    return this.queryWithRetry(async () => {
      const selectCols = isSwingTable
        ? "symbol, date, timestamp, open, high, low, close, volume"
        : "symbol, date, time, timestamp, open, high, low, close, volume";

      const CHUNK = 500;
      const allRows = [];
      for (let i = 0; i < symbols.length; i += CHUNK) {
        const chunk = symbols.slice(i, i + CHUNK);
        let query = this.supabase
          .from(table)
          .select(selectCols)
          .in("symbol", chunk)
          .gte("timestamp", since)
          .order("timestamp", { ascending: false })
          .limit(100000);

        if (!isSwingTable) {
          query = query.in("time", ["15:30", "15:25", "15:20"]);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data) allRows.push(...data);
      }

      // Group by symbol, keep only EOD candle per day for swing, else all match
      const grouped = new Map();
      if (isSwingTable) {
        // For swing_hourly: extract EOD (latest candle per day) per symbol
        const bySymbolDate = new Map();
        for (const row of allRows) {
          const key = `${row.symbol}::${row.date}`;
          const existing = bySymbolDate.get(key);
          if (!existing || new Date(row.timestamp) > new Date(existing.timestamp)) {
            bySymbolDate.set(key, row);
          }
        }
        for (const row of bySymbolDate.values()) {
          if (!grouped.has(row.symbol)) grouped.set(row.symbol, []);
          grouped.get(row.symbol).push(row);
        }
        for (const [sym, candles] of grouped) {
          grouped.set(sym, candles.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-days));
        }
      } else {
        for (const row of allRows) {
          if (!grouped.has(row.symbol)) grouped.set(row.symbol, []);
          grouped.get(row.symbol).push(row);
        }
        for (const [sym, candles] of grouped) {
          grouped.set(sym, candles.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
        }
      }
      return grouped;
    });
  }

  /**
   * Get daily candles
   */
  async getDailyCandles(symbol, table, days = 20) {
    return this.queryWithRetry(async () => {
      // For swing/daily tables (no 'time' column), select without time filter
      // For intraday tables (with 'time' column), include time filter
      const isSwingTable = table.includes('swing_hourly');
      
      let query = this.supabase
        .from(table)
        .select(isSwingTable ? "date, timestamp, open, high, low, close, volume" : "date, time, timestamp, open, high, low, close, volume")
        .eq("symbol", symbol);
      
      // Only filter by time for intraday tables
      if (!isSwingTable) {
        query = query.in("time", ["15:30", "15:25", "15:20"]); // Market close candles
      }
      
      // For swing_hourly, fetch 7x records (7 hourly candles per day) and extract EOD
      const recordsToFetch = isSwingTable ? days * 10 : days; // 10x for safety (some days may have fewer candles)
      query = query.order("timestamp", { ascending: false }).limit(recordsToFetch);

      const { data, error } = await query;
      if (error) throw error;
      
      if (!data || data.length === 0) return [];
      
      // For swing_hourly tables, extract only EOD (last hourly candle of each day)
      if (isSwingTable) {
        const dailyCandles = new Map();
        
        // Group by date and keep the latest timestamp (EOD candle)
        data.forEach(candle => {
          const date = candle.date;
          const existing = dailyCandles.get(date);
          
          if (!existing || new Date(candle.timestamp) > new Date(existing.timestamp)) {
            dailyCandles.set(date, candle);
          }
        });
        
        // Convert to array and sort by date ascending
        return Array.from(dailyCandles.values())
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          .slice(-days); // Take only requested number of days
      }
      
      return data.reverse();
    });
  }

  /**
   * Save bullish signal (single insert)
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
   * Save bearish signal (single insert)
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
   * BULK upsert signals in one DB round-trip.
   * Splits into chunks of 500 to stay within Supabase payload limits.
   * Uses upsert on `symbol` to handle reruns safely.
   *
   * @param {Array}  signals    Array of signal objects
   * @param {string} tableName  Target table name
   * @param {string} conflictCol  Column to upsert on (default 'symbol')
   */
  async saveBulkSignals(signals, tableName, conflictCol = 'symbol') {
    if (!signals || signals.length === 0) return true;
    const CHUNK = 500;
    return this.queryWithRetry(async () => {
      for (let i = 0; i < signals.length; i += CHUNK) {
        const chunk = signals.slice(i, i + CHUNK);
        const { error } = await this.supabase
          .from(tableName)
          .upsert(chunk, { onConflict: conflictCol, ignoreDuplicates: false });
        if (error) throw error;
      }
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
