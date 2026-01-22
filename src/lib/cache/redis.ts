/**
 * Redis Cache Utility for Supabase Egress Optimization
 * 
 * Purpose: Reduce Supabase egress by caching frequently accessed data
 * Free Tier: Upstash Redis (10K requests/day, 256MB storage)
 * 
 * Setup:
 * 1. Sign up at https://upstash.com/
 * 2. Create Redis database
 * 3. Add to .env:
 *    UPSTASH_REDIS_REST_URL=https://...
 *    UPSTASH_REDIS_REST_TOKEN=...
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Cache key prefixes
export const CACHE_KEYS = {
  HISTORICAL_PRICES: 'historical:prices',
  BULLISH_SIGNALS: 'signals:bullish',
  BEARISH_SIGNALS: 'signals:bearish',
  SWING_POSITIONAL_SIGNALS: 'signals:swing-positional',
  SWING_POSITIONAL_BEARISH_SIGNALS: 'signals:swing-positional-bearish',
  NSE_SYMBOLS: 'symbols:nse',
  KITE_TOKEN: 'kite:token',
  DAILY_CANDLES: 'historical:daily',
};

// Cache TTL (in seconds)
export const CACHE_TTL = {
  HISTORICAL_PRICES: 300, // 5 minutes
  SIGNALS: 60, // 1 minute (real-time data)
  NSE_SYMBOLS: 86400, // 24 hours (rarely changes)
  KITE_TOKEN: 3600, // 1 hour
  DAILY_CANDLES: 1800, // 30 minutes
};

interface CacheOptions {
  ttl?: number;
  compress?: boolean;
}

/**
 * Get data from cache
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) {
    console.warn('⚠️ Redis not configured, skipping cache');
    return null;
  }

  try {
    const cached = await redis.get<T>(key);
    if (cached) {
      console.log(`✅ Cache HIT: ${key}`);
      return cached;
    }
    console.log(`❌ Cache MISS: ${key}`);
    return null;
  } catch (error) {
    console.error(`❌ Redis GET error for ${key}:`, error);
    return null;
  }
}

/**
 * Set data in cache
 */
export async function setCached<T>(
  key: string,
  data: T,
  options: CacheOptions = {}
): Promise<boolean> {
  if (!redis) {
    console.warn('⚠️ Redis not configured, skipping cache');
    return false;
  }

  try {
    const ttl = options.ttl || 300; // Default 5 minutes
    await redis.set(key, data, { ex: ttl });
    console.log(`✅ Cache SET: ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (error) {
    console.error(`❌ Redis SET error for ${key}:`, error);
    return false;
  }
}

/**
 * Delete from cache
 */
export async function deleteCached(key: string): Promise<boolean> {
  if (!redis) {
    return false;
  }

  try {
    await redis.del(key);
    console.log(`✅ Cache DELETE: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ Redis DELETE error for ${key}:`, error);
    return false;
  }
}

/**
 * Delete all keys matching pattern
 */
export async function deleteCachedPattern(pattern: string): Promise<number> {
  if (!redis) {
    return 0;
  }

  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;

    await redis.del(...keys);
    console.log(`✅ Cache DELETE ${keys.length} keys: ${pattern}`);
    return keys.length;
  } catch (error) {
    console.error(`❌ Redis DELETE PATTERN error for ${pattern}:`, error);
    return 0;
  }
}

/**
 * Get or set cache (fetch-on-miss pattern)
 */
export async function getOrSetCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Cache the result
  await setCached(key, data, options);

  return data;
}

/**
 * Helper: Build cache key for historical prices
 */
export function buildHistoricalPriceKey(
  symbol: string,
  date?: string
): string {
  const dateStr = date || new Date().toISOString().split('T')[0];
  return `${CACHE_KEYS.HISTORICAL_PRICES}:${symbol}:${dateStr}`;
}

/**
 * Helper: Build cache key for daily candles
 */
export function buildDailyCandleKey(symbol: string, days: number): string {
  return `${CACHE_KEYS.DAILY_CANDLES}:${symbol}:${days}`;
}

/**
 * Helper: Build cache key for signals
 */
export function buildSignalKey(
  type: 'bullish' | 'bearish' | 'swing-positional' | 'swing-positional-bearish',
  minutesAgo: number = 15
): string {
  let prefix: string;
  if (type === 'bullish') {
    prefix = CACHE_KEYS.BULLISH_SIGNALS;
  } else if (type === 'bearish') {
    prefix = CACHE_KEYS.BEARISH_SIGNALS;
  } else if (type === 'swing-positional') {
    prefix = CACHE_KEYS.SWING_POSITIONAL_SIGNALS;
  } else {
    prefix = CACHE_KEYS.SWING_POSITIONAL_BEARISH_SIGNALS;
  }
  return `${prefix}:${minutesAgo}min`;
}

export default {
  get: getCached,
  set: setCached,
  delete: deleteCached,
  deletePattern: deleteCachedPattern,
  getOrSet: getOrSetCached,
};
