/**
 * Shared Technical Indicators Calculator
 * Used by all scanners (NSE Equity, BSE Equity, F&O)
 */

class TechnicalIndicators {
  /**
   * Calculate Exponential Moving Average
   */
  static calculateEMA(prices, period = 20, adaptive = true) {
    if (!prices || prices.length === 0) return null;

    const actualPeriod = adaptive
      ? Math.min(period, prices.length)
      : period;

    if (prices.length < actualPeriod) return null;

    const multiplier = 2 / (actualPeriod + 1);
    let ema =
      prices.slice(0, actualPeriod).reduce((sum, price) => sum + price, 0) /
      actualPeriod;

    for (let i = actualPeriod; i < prices.length; i++) {
      ema = prices[i] * multiplier + ema * (1 - multiplier);
    }

    return ema;
  }

  /**
   * Calculate Relative Strength Index
   */
  static calculateRSI(prices, period = 14, adaptive = true) {
    if (!prices || prices.length < 2) return null;

    const actualPeriod = adaptive
      ? Math.min(period, Math.max(5, prices.length - 1))
      : period;

    if (prices.length < actualPeriod + 1) return null;

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const recentChanges = changes.slice(-actualPeriod);
    const gains = recentChanges.map((change) => (change > 0 ? change : 0));
    const losses = recentChanges.map((change) =>
      change < 0 ? Math.abs(change) : 0
    );

    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / actualPeriod;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / actualPeriod;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return rsi;
  }

  /**
   * Calculate Simple Moving Average
   */
  static calculateSMA(prices, period = 50) {
    if (!prices || prices.length < period) return null;
    const recentPrices = prices.slice(-period);
    return recentPrices.reduce((sum, price) => sum + price, 0) / period;
  }

  /**
   * Find recent swing low (for stop loss / support)
   */
  static findRecentSwingLow(candles, lookback = 10) {
    if (!candles || candles.length < lookback) return null;
    const recentCandles = candles.slice(-lookback);
    return Math.min(...recentCandles.map((c) => parseFloat(c.low)));
  }

  /**
   * Find recent swing high (for resistance)
   */
  static findRecentSwingHigh(candles, lookback = 10) {
    if (!candles || candles.length < lookback) return null;
    const recentCandles = candles.slice(-lookback);
    return Math.max(...recentCandles.map((c) => parseFloat(c.high)));
  }

  /**
   * Calculate weekly volatility percentage
   */
  static calculateWeeklyVolatility(dailyCandles) {
    const last7Days = dailyCandles.slice(-7);
    if (last7Days.length < 7) return 0;

    const high = Math.max(...last7Days.map((c) => parseFloat(c.high)));
    const low = Math.min(...last7Days.map((c) => parseFloat(c.low)));

    return ((high - low) / low) * 100;
  }

  /**
   * Calculate volume ratio compared to yearly average
   */
  static calculateYearlyVolumeRatio(dailyCandles) {
    const yearlyCandles = dailyCandles.slice(-365);
    if (yearlyCandles.length === 0) return 0;

    const avgVolume =
      yearlyCandles.reduce((sum, c) => sum + parseInt(c.volume || 0), 0) /
      yearlyCandles.length;

    const currentVolume = parseInt(
      dailyCandles[dailyCandles.length - 1]?.volume || 0
    );

    return avgVolume > 0 ? currentVolume / avgVolume : 0;
  }

  /**
   * Check if volume is at least 2x yearly average
   */
  static checkYearlyVolume(dailyCandles) {
    const ratio = this.calculateYearlyVolumeRatio(dailyCandles);
    return ratio >= 2; // 2x yearly average
  }

  /**
   * Detect bullish crossover (short EMA crosses above long EMA)
   */
  static isBullishCrossover(prices, shortPeriod = 20, longPeriod = 50) {
    if (prices.length < longPeriod + 1) return false;

    const currentShortEMA = this.calculateEMA(prices, shortPeriod);
    const currentLongEMA = this.calculateEMA(prices, longPeriod);

    const prevShortEMA = this.calculateEMA(prices.slice(0, -1), shortPeriod);
    const prevLongEMA = this.calculateEMA(prices.slice(0, -1), longPeriod);

    if (!currentShortEMA || !currentLongEMA || !prevShortEMA || !prevLongEMA) {
      return false;
    }

    return prevShortEMA <= prevLongEMA && currentShortEMA > currentLongEMA;
  }

  /**
   * Detect bearish crossover (short EMA crosses below long EMA)
   */
  static isBearishCrossover(prices, shortPeriod = 20, longPeriod = 50) {
    if (prices.length < longPeriod + 1) return false;

    const currentShortEMA = this.calculateEMA(prices, shortPeriod);
    const currentLongEMA = this.calculateEMA(prices, longPeriod);

    const prevShortEMA = this.calculateEMA(prices.slice(0, -1), shortPeriod);
    const prevLongEMA = this.calculateEMA(prices.slice(0, -1), longPeriod);

    if (!currentShortEMA || !currentLongEMA || !prevShortEMA || !prevLongEMA) {
      return false;
    }

    return prevShortEMA >= prevLongEMA && currentShortEMA < currentLongEMA;
  }
}

module.exports = { TechnicalIndicators };
