/**
 * Scanner Monitoring & Health Check Utilities
 */

class ScannerMonitor {
  constructor(scannerName) {
    this.scannerName = scannerName;
    this.metrics = {
      scans_completed: 0,
      scans_failed: 0,
      signals_generated: 0,
      last_scan_duration_ms: 0,
      last_scan_time: null,
    };
  }

  /**
   * Record successful scan
   */
  recordScan(durationMs, signalsCount) {
    this.metrics.scans_completed++;
    this.metrics.signals_generated += signalsCount;
    this.metrics.last_scan_duration_ms = durationMs;
    this.metrics.last_scan_time = new Date().toISOString();

    console.log(`✅ [${this.scannerName}] Scan complete in ${durationMs}ms | ${signalsCount} signals`);
  }

  /**
   * Record failed scan
   */
  recordFailure(error) {
    this.metrics.scans_failed++;
    console.error(`❌ [${this.scannerName}] Scan failed:`, error.message);
  }

  /**
   * Log memory usage
   */
  logMemoryUsage() {
    const used = process.memoryUsage();
    console.log(`📊 [${this.scannerName}] Memory: ${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB`);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      scanner: this.scannerName,
      ...this.metrics,
      uptime_seconds: process.uptime(),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
  }

  /**
   * Log scanner status
   */
  logStatus() {
    const metrics = this.getMetrics();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 [${this.scannerName}] STATUS REPORT`);
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Scans Completed: ${metrics.scans_completed}`);
    console.log(`❌ Scans Failed: ${metrics.scans_failed}`);
    console.log(`📈 Total Signals: ${metrics.signals_generated}`);
    console.log(`⏱️  Last Scan: ${metrics.last_scan_duration_ms}ms`);
    console.log(`💾 Memory Usage: ${metrics.memory_mb}MB`);
    console.log(`⏰ Uptime: ${Math.round(metrics.uptime_seconds / 60)} minutes`);
    console.log(`${'='.repeat(60)}\n`);
  }
}

/**
 * Market Hours Checker
 */
class MarketHoursChecker {
  static isMarketOpen() {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    
    const day = istTime.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = istTime.getHours();
    const minute = istTime.getMinutes();

    // Market closed on weekends
    if (day === 0 || day === 6) {
      return false;
    }

    // Market hours: 9:15 AM - 3:30 PM IST
    if (hour < 9 || hour > 15) {
      return false;
    }

    if (hour === 9 && minute < 15) {
      return false;
    }

    if (hour === 15 && minute > 30) {
      return false;
    }

    return true;
  }

  static getNextMarketOpen() {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    
    let nextOpen = new Date(istTime);
    nextOpen.setHours(9, 15, 0, 0);

    // If past market close today, move to next day
    if (istTime.getHours() > 15 || (istTime.getHours() === 15 && istTime.getMinutes() > 30)) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }

    // Skip weekends
    while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }

    return nextOpen;
  }
}

/**
 * Rate Limiter
 */
class RateLimiter {
  constructor(maxRequestsPerSecond = 2) {
    this.maxRequests = maxRequestsPerSecond;
    this.requestCount = 0;
    this.windowStart = Date.now();
  }

  async waitForSlot() {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    // Reset window if 1 second passed
    if (elapsed >= 1000) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Wait if limit reached
    if (this.requestCount >= this.maxRequests) {
      const waitTime = 1000 - elapsed;
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = {
  ScannerMonitor,
  MarketHoursChecker,
  RateLimiter,
};
