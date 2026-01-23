import { createHash } from 'crypto';

interface CacheEntry {
  response: any;
  timestamp: number;
  expiresAt: number;
}

class GroqCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly defaultTTL = 3600000; // 1 hour in milliseconds

  /**
   * Generate a cache key from prompt content
   */
  private generateKey(messages: any[]): string {
    const content = JSON.stringify(messages);
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached response if available and not expired
   */
  get(messages: any[]): any | null {
    const key = this.generateKey(messages);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.response;
  }

  /**
   * Store response in cache
   */
  set(messages: any[], response: any, ttl: number = this.defaultTTL): void {
    const key = this.generateKey(messages);
    const entry: CacheEntry = {
      response,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    this.cache.set(key, entry);

    // Cleanup old entries periodically
    if (this.cache.size > 1000) {
      this.cleanup();
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: this.cache.size,
    };
  }
}

// Singleton instance
export const groqCache = new GroqCache();

/**
 * Wrapper for createChatCompletion with caching
 */
export async function createChatCompletionWithCache(
  createChatCompletion: Function,
  messages: any[],
  options?: any
): Promise<any> {
  // Check cache first
  const cached = groqCache.get(messages);
  if (cached) {
    console.log('[Groq Cache] Cache hit');
    return cached;
  }

  console.log('[Groq Cache] Cache miss, calling API');
  const response = await createChatCompletion(messages, options);

  // Cache the response (1 hour TTL for signal validations)
  groqCache.set(messages, response, 3600000);

  return response;
}
