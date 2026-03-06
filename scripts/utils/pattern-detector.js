/**
 * Chart Pattern Detection Engine
 * Deterministic, rule-based pattern recognition for technical analysis
 * 
 * Performance: <50ms for pattern detection on 25-50 bar window
 * Memory: Lightweight, uses native arrays
 */

class PatternDetector {
  constructor() {
    this.patterns = [];
  }

  /**
   * Main entry point - detect all patterns for a given OHLCV dataset
   * @param {Array} candles - Array of {open, high, low, close, volume}
   * @returns {Object} - {patterns: [], strongest: {}, confidence: number}
   */
  detectAllPatterns(candles) {
    if (!candles || candles.length < 10) {
      return { patterns: [], strongest: null, confidence: 0 };
    }

    const patterns = [];

    // Candlestick patterns (last 1-3 bars)
    patterns.push(...this.detectCandlestickPatterns(candles));

    // Triangle patterns (15-30 bars)
    if (candles.length >= 15) {
      patterns.push(...this.detectTrianglePatterns(candles));
    }

    // Reversal patterns (30-60 bars)
    if (candles.length >= 30) {
      patterns.push(...this.detectReversalPatterns(candles));
    }

    // Continuation patterns (10-30 bars)
    if (candles.length >= 20) {
      patterns.push(...this.detectContinuationPatterns(candles));
    }

    // Calculate aggregate confidence
    const result = this.aggregatePatterns(patterns, candles);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // CANDLESTICK PATTERNS
  // ═══════════════════════════════════════════════════════════════

  detectCandlestickPatterns(candles) {
    const patterns = [];
    const len = candles.length;

    if (len < 2) return patterns;

    const curr = candles[len - 1];
    const prev = candles[len - 2];

    // Pre-compute common metrics
    const currBody = Math.abs(curr.close - curr.open);
    const currRange = curr.high - curr.low;
    const prevBody = Math.abs(prev.close - prev.open);

    // DOJI
    if (currBody / currRange < 0.1) {
      patterns.push({
        pattern: 'DOJI',
        direction: 'neutral',
        confidence: 60,
        type: 'candlestick',
        description: 'Indecision candle'
      });
    }

    // HAMMER (Bullish reversal)
    const lowerShadow = Math.min(curr.open, curr.close) - curr.low;
    const upperShadow = curr.high - Math.max(curr.open, curr.close);
    if (lowerShadow >= 2 * currBody && upperShadow <= 0.2 * currBody && currBody < 0.5 * currRange) {
      const inDowntrend = this.isInDowntrend(candles, len - 1);
      if (inDowntrend) {
        patterns.push({
          pattern: 'HAMMER',
          direction: 'bullish',
          confidence: 75,
          type: 'candlestick',
          description: 'Bullish reversal hammer'
        });
      }
    }

    // SHOOTING STAR (Bearish reversal)
    if (upperShadow >= 2 * currBody && lowerShadow <= 0.2 * currBody && currBody < 0.5 * currRange) {
      const inUptrend = this.isInUptrend(candles, len - 1);
      if (inUptrend) {
        patterns.push({
          pattern: 'SHOOTING_STAR',
          direction: 'bearish',
          confidence: 75,
          type: 'candlestick',
          description: 'Bearish reversal shooting star'
        });
      }
    }

    // BULLISH ENGULFING
    if (prev.close < prev.open && curr.close > curr.open) {
      if (curr.close > prev.open && curr.open < prev.close) {
        const volumeConfirm = curr.volume > prev.volume * 1.2;
        patterns.push({
          pattern: 'BULLISH_ENGULFING',
          direction: 'bullish',
          confidence: volumeConfirm ? 85 : 70,
          type: 'candlestick',
          description: 'Strong bullish reversal'
        });
      }
    }

    // BEARISH ENGULFING
    if (prev.close > prev.open && curr.close < curr.open) {
      if (curr.close < prev.open && curr.open > prev.close) {
        const volumeConfirm = curr.volume > prev.volume * 1.2;
        patterns.push({
          pattern: 'BEARISH_ENGULFING',
          direction: 'bearish',
          confidence: volumeConfirm ? 85 : 70,
          type: 'candlestick',
          description: 'Strong bearish reversal'
        });
      }
    }

    // HANGING MAN (Bearish reversal - same as hammer but in uptrend)
    if (lowerShadow >= 2 * currBody && upperShadow <= 0.2 * currBody && currBody < 0.5 * currRange) {
      const inUptrend = this.isInUptrend(candles, len - 1);
      if (inUptrend) {
        patterns.push({
          pattern: 'HANGING_MAN',
          direction: 'bearish',
          confidence: 70,
          type: 'candlestick',
          description: 'Bearish reversal hanging man'
        });
      }
    }

    // INVERTED HAMMER (Bullish reversal)
    if (upperShadow >= 2 * currBody && lowerShadow <= 0.2 * currBody && currBody < 0.5 * currRange) {
      const inDowntrend = this.isInDowntrend(candles, len - 1);
      if (inDowntrend && len >= 3) {
        const next = candles.length > len ? candles[len] : null;
        const needsConfirmation = !next || next.close > curr.close;
        if (needsConfirmation) {
          patterns.push({
            pattern: 'INVERTED_HAMMER',
            direction: 'bullish',
            confidence: 65,
            type: 'candlestick',
            description: 'Bullish reversal (needs confirmation)'
          });
        }
      }
    }

    // BULLISH HARAMI
    if (len >= 3) {
      const prevBearish = prev.close < prev.open;
      const currBullish = curr.close > curr.open;
      const prevLarge = prevBody > currRange * 0.7;
      const currSmall = currBody < prevBody * 0.5;
      const insideBody = curr.open >= prev.close && curr.close <= prev.open;

      if (prevBearish && currBullish && prevLarge && currSmall && insideBody) {
        patterns.push({
          pattern: 'BULLISH_HARAMI',
          direction: 'bullish',
          confidence: 70,
          type: 'candlestick',
          description: 'Bullish reversal harami'
        });
      }
    }

    // BEARISH HARAMI
    if (len >= 3) {
      const prevBullish = prev.close > prev.open;
      const currBearish = curr.close < curr.open;
      const prevLarge = prevBody > currRange * 0.7;
      const currSmall = currBody < prevBody * 0.5;
      const insideBody = curr.open <= prev.close && curr.close >= prev.open;

      if (prevBullish && currBearish && prevLarge && currSmall && insideBody) {
        patterns.push({
          pattern: 'BEARISH_HARAMI',
          direction: 'bearish',
          confidence: 70,
          type: 'candlestick',
          description: 'Bearish reversal harami'
        });
      }
    }

    // DARK CLOUD COVER (Bearish reversal)
    if (len >= 3) {
      const prevBullish = prev.close > prev.open;
      const currBearish = curr.close < curr.open;
      const opensAbove = curr.open > prev.high;
      const closesBelow = curr.close < (prev.open + prev.close) / 2;

      if (prevBullish && currBearish && opensAbove && closesBelow) {
        const inUptrend = this.isInUptrend(candles, len - 2);
        if (inUptrend) {
          patterns.push({
            pattern: 'DARK_CLOUD_COVER',
            direction: 'bearish',
            confidence: 75,
            type: 'candlestick',
            description: 'Bearish reversal dark cloud'
          });
        }
      }
    }

    // PIERCING PATTERN (Bullish reversal)
    if (len >= 3) {
      const prevBearish = prev.close < prev.open;
      const currBullish = curr.close > curr.open;
      const opensBelow = curr.open < prev.low;
      const closesAbove = curr.close > (prev.open + prev.close) / 2;

      if (prevBearish && currBullish && opensBelow && closesAbove) {
        const inDowntrend = this.isInDowntrend(candles, len - 2);
        if (inDowntrend) {
          patterns.push({
            pattern: 'PIERCING_PATTERN',
            direction: 'bullish',
            confidence: 75,
            type: 'candlestick',
            description: 'Bullish reversal piercing pattern'
          });
        }
      }
    }

    return patterns;
  }

  // ═══════════════════════════════════════════════════════════════
  // TRIANGLE PATTERNS
  // ═══════════════════════════════════════════════════════════════

  detectTrianglePatterns(candles) {
    const patterns = [];
    const lookback = Math.min(30, candles.length);
    const recentCandles = candles.slice(-lookback);

    // Find swing highs and lows
    const swingHighs = this.findSwingPoints(recentCandles, 'high');
    const swingLows = this.findSwingPoints(recentCandles, 'low');

    if (swingHighs.length < 2 || swingLows.length < 2) {
      return patterns;
    }

    // ASCENDING TRIANGLE
    const resistanceLevel = this.calculateResistanceLevel(swingHighs);
    const supportSlope = this.calculateSlope(swingLows);

    if (resistanceLevel && supportSlope > 0) {
      const resistanceFlat = this.isLevelFlat(swingHighs, resistanceLevel);
      if (resistanceFlat) {
        patterns.push({
          pattern: 'ASCENDING_TRIANGLE',
          direction: 'bullish',
          confidence: 75,
          type: 'triangle',
          description: 'Bullish continuation triangle',
          breakoutLevel: resistanceLevel * 1.005,
          target: resistanceLevel * 1.05
        });
      }
    }

    // DESCENDING TRIANGLE
    const supportLevel = this.calculateSupportLevel(swingLows);
    const resistanceSlope = this.calculateSlope(swingHighs);

    if (supportLevel && resistanceSlope < 0) {
      const supportFlat = this.isLevelFlat(swingLows, supportLevel);
      if (supportFlat) {
        patterns.push({
          pattern: 'DESCENDING_TRIANGLE',
          direction: 'bearish',
          confidence: 75,
          type: 'triangle',
          description: 'Bearish continuation triangle',
          breakoutLevel: supportLevel * 0.995,
          target: supportLevel * 0.95
        });
      }
    }

    // SYMMETRICAL TRIANGLE
    if (resistanceSlope < 0 && supportSlope > 0) {
      // Both lines converging
      const convergencePoint = this.findConvergencePoint(swingHighs, swingLows, resistanceSlope, supportSlope);
      if (convergencePoint && convergencePoint > recentCandles.length) {
        const trend = this.isInUptrend(candles, candles.length - 1) ? 'bullish' : 'bearish';
        const midpoint = (recentCandles[recentCandles.length - 1].high + recentCandles[recentCandles.length - 1].low) / 2;
        
        patterns.push({
          pattern: 'SYMMETRICAL_TRIANGLE',
          direction: trend,
          confidence: 70,
          type: 'triangle',
          description: 'Neutral triangle - follows trend',
          breakoutLevel: midpoint * (trend === 'bullish' ? 1.005 : 0.995),
          target: midpoint * (trend === 'bullish' ? 1.08 : 0.92)
        });
      }
    }

    return patterns;
  }

  // ═══════════════════════════════════════════════════════════════
  // REVERSAL PATTERNS
  // ═══════════════════════════════════════════════════════════════

  detectReversalPatterns(candles) {
    const patterns = [];
    const lookback = Math.min(60, candles.length);
    const recentCandles = candles.slice(-lookback);

    // DOUBLE TOP
    const peaks = this.findPeaks(recentCandles);
    if (peaks.length >= 2) {
      const [peak1, peak2] = peaks.slice(-2);
      const priceDiff = Math.abs(peak1.price - peak2.price) / peak1.price;
      
      if (priceDiff < 0.02) { // Within 2%
        const trough = this.findTroughBetween(recentCandles, peak1.index, peak2.index);
        if (trough && (peak1.price - trough.price) / peak1.price > 0.05) {
          patterns.push({
            pattern: 'DOUBLE_TOP',
            direction: 'bearish',
            confidence: 80,
            type: 'reversal',
            description: 'Bearish double top reversal',
            breakoutLevel: trough.price * 0.995,
            target: trough.price * 0.90
          });
        }
      }
    }

    // DOUBLE BOTTOM
    const troughs = this.findTroughs(recentCandles);
    if (troughs.length >= 2) {
      const [trough1, trough2] = troughs.slice(-2);
      const priceDiff = Math.abs(trough1.price - trough2.price) / trough1.price;
      
      if (priceDiff < 0.02) {
        const peak = this.findPeakBetween(recentCandles, trough1.index, trough2.index);
        if (peak && (peak.price - trough1.price) / trough1.price > 0.05) {
          patterns.push({
            pattern: 'DOUBLE_BOTTOM',
            direction: 'bullish',
            confidence: 80,
            type: 'reversal',
            description: 'Bullish double bottom reversal',
            breakoutLevel: peak.price * 1.005,
            target: peak.price * 1.10
          });
        }
      }
    }

    // HEAD AND SHOULDERS
    if (peaks.length >= 3) {
      const [left, head, right] = peaks.slice(-3);
      const leftHeadDiff = Math.abs(left.price - head.price) / head.price;
      const rightHeadDiff = Math.abs(right.price - head.price) / head.price;
      const shouldersDiff = Math.abs(left.price - right.price) / left.price;

      if (head.price > left.price && head.price > right.price && shouldersDiff < 0.03) {
        const neckline = Math.min(
          this.findTroughBetween(recentCandles, left.index, head.index)?.price || Infinity,
          this.findTroughBetween(recentCandles, head.index, right.index)?.price || Infinity
        );

        if (neckline < Infinity) {
          const patternHeight = head.price - neckline;
          patterns.push({
            pattern: 'HEAD_AND_SHOULDERS',
            direction: 'bearish',
            confidence: 85,
            type: 'reversal',
            description: 'Bearish head and shoulders reversal',
            breakoutLevel: neckline * 0.995,
            target: neckline - patternHeight,
            neckline: neckline
          });
        }
      }
    }

    // INVERSE HEAD AND SHOULDERS
    if (troughs.length >= 3) {
      const [left, head, right] = troughs.slice(-3);
      const leftHeadDiff = Math.abs(left.price - head.price) / head.price;
      const rightHeadDiff = Math.abs(right.price - head.price) / head.price;
      const shouldersDiff = Math.abs(left.price - right.price) / left.price;

      if (head.price < left.price && head.price < right.price && shouldersDiff < 0.03) {
        const neckline = Math.max(
          this.findPeakBetween(recentCandles, left.index, head.index)?.price || 0,
          this.findPeakBetween(recentCandles, head.index, right.index)?.price || 0
        );

        if (neckline > 0) {
          const patternHeight = neckline - head.price;
          patterns.push({
            pattern: 'INVERSE_HEAD_AND_SHOULDERS',
            direction: 'bullish',
            confidence: 85,
            type: 'reversal',
            description: 'Bullish inverse head and shoulders',
            breakoutLevel: neckline * 1.005,
            target: neckline + patternHeight,
            neckline: neckline
          });
        }
      }
    }

    // CUP AND HANDLE
    if (recentCandles.length >= 40) {
      const cupCandles = recentCandles.slice(0, -10);
      const handleCandles = recentCandles.slice(-10);
      
      const cupStart = cupCandles[0].close;
      const cupBottom = Math.min(...cupCandles.map(c => c.low));
      const cupEnd = cupCandles[cupCandles.length - 1].close;
      
      const cupDepth = (cupStart - cupBottom) / cupStart;
      const cupRecovery = Math.abs(cupEnd - cupStart) / cupStart;
      
      if (cupDepth > 0.12 && cupDepth < 0.50 && cupRecovery < 0.05) {
        const handleHigh = Math.max(...handleCandles.map(c => c.high));
        const handleLow = Math.min(...handleCandles.map(c => c.low));
        const handleDepth = (handleHigh - handleLow) / handleHigh;
        
        if (handleDepth < cupDepth * 0.5 && handleDepth > 0.05) {
          patterns.push({
            pattern: 'CUP_AND_HANDLE',
            direction: 'bullish',
            confidence: 80,
            type: 'reversal',
            description: 'Bullish cup and handle continuation',
            breakoutLevel: handleHigh * 1.005,
            target: handleHigh * (1 + cupDepth)
          });
        }
      }
    }

    return patterns;
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTINUATION PATTERNS
  // ═══════════════════════════════════════════════════════════════

  detectContinuationPatterns(candles) {
    const patterns = [];
    const lookback = Math.min(30, candles.length);

    // BULL FLAG
    const poleGain = this.detectFlagpole(candles, lookback, 'bullish');
    if (poleGain && poleGain > 0.10) { // 10% gain in pole
      const flagAngle = this.detectFlagConsolidation(candles, 'bearish');
      if (flagAngle && flagAngle < 0) { // Downward drift
        const retracement = this.calculateRetracement(candles, lookback);
        if (retracement > 0.20 && retracement < 0.60) {
          patterns.push({
            pattern: 'BULL_FLAG',
            direction: 'bullish',
            confidence: 85,
            type: 'continuation',
            description: 'Bullish flag continuation',
            poleGain: poleGain,
            retracement: retracement
          });
        }
      }
    }

    // BEAR FLAG
    const poleDrop = this.detectFlagpole(candles, lookback, 'bearish');
    if (poleDrop && poleDrop > 0.10) {
      const flagAngle = this.detectFlagConsolidation(candles, 'bullish');
      if (flagAngle && flagAngle > 0) { // Upward drift
        const retracement = this.calculateRetracement(candles, lookback);
        if (retracement > 0.20 && retracement < 0.60) {
          patterns.push({
            pattern: 'BEAR_FLAG',
            direction: 'bearish',
            confidence: 85,
            type: 'continuation',
            description: 'Bearish flag continuation',
            poleDrop: poleDrop,
            retracement: retracement
          });
        }
      }
    }

    // BULL PENNANT
    const bullPennant = this.detectPennant(candles, lookback, 'bullish');
    if (bullPennant) {
      patterns.push({
        pattern: 'BULL_PENNANT',
        direction: 'bullish',
        confidence: 80,
        type: 'continuation',
        description: 'Bullish pennant continuation',
        poleGain: bullPennant.poleGain,
        apex: bullPennant.apex
      });
    }

    // RISING WEDGE (Bearish reversal despite rising trend)
    const risingWedge = this.detectWedge(candles, lookback, 'rising');
    if (risingWedge) {
      patterns.push({
        pattern: 'RISING_WEDGE',
        direction: 'bearish',
        confidence: 75,
        type: 'continuation',
        description: 'Bearish reversal wedge',
        breakoutLevel: risingWedge.supportLevel * 0.995,
        target: risingWedge.supportLevel * 0.92
      });
    }

    // FALLING WEDGE (Bullish reversal)
    const fallingWedge = this.detectWedge(candles, lookback, 'falling');
    if (fallingWedge) {
      patterns.push({
        pattern: 'FALLING_WEDGE',
        direction: 'bullish',
        confidence: 75,
        type: 'continuation',
        description: 'Bullish reversal wedge',
        breakoutLevel: fallingWedge.resistanceLevel * 1.005,
        target: fallingWedge.resistanceLevel * 1.08
      });
    }

    return patterns;
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════

  isInUptrend(candles, endIndex, lookback = 20) {
    const start = Math.max(0, endIndex - lookback);
    const prices = candles.slice(start, endIndex + 1).map(c => c.close);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return candles[endIndex].close > avg;
  }

  isInDowntrend(candles, endIndex, lookback = 20) {
    return !this.isInUptrend(candles, endIndex, lookback);
  }

  findSwingPoints(candles, type = 'high') {
    const points = [];
    const key = type === 'high' ? 'high' : 'low';
    const compareFn = type === 'high' 
      ? (a, b, c) => b > a && b > c
      : (a, b, c) => b < a && b < c;

    for (let i = 1; i < candles.length - 1; i++) {
      if (compareFn(candles[i-1][key], candles[i][key], candles[i+1][key])) {
        points.push({ index: i, price: candles[i][key] });
      }
    }

    return points;
  }

  findPeaks(candles) {
    return this.findSwingPoints(candles, 'high');
  }

  findTroughs(candles) {
    return this.findSwingPoints(candles, 'low');
  }

  findTroughBetween(candles, startIdx, endIdx) {
    let minPrice = Infinity;
    let minIndex = -1;

    for (let i = startIdx; i <= endIdx && i < candles.length; i++) {
      if (candles[i].low < minPrice) {
        minPrice = candles[i].low;
        minIndex = i;
      }
    }

    return minIndex >= 0 ? { index: minIndex, price: minPrice } : null;
  }

  findPeakBetween(candles, startIdx, endIdx) {
    let maxPrice = -Infinity;
    let maxIndex = -1;

    for (let i = startIdx; i <= endIdx && i < candles.length; i++) {
      if (candles[i].high > maxPrice) {
        maxPrice = candles[i].high;
        maxIndex = i;
      }
    }

    return maxIndex >= 0 ? { index: maxIndex, price: maxPrice } : null;
  }

  calculateResistanceLevel(swingHighs) {
    if (swingHighs.length < 2) return null;
    const recent = swingHighs.slice(-3);
    return recent.reduce((sum, p) => sum + p.price, 0) / recent.length;
  }

  calculateSupportLevel(swingLows) {
    if (swingLows.length < 2) return null;
    const recent = swingLows.slice(-3);
    return recent.reduce((sum, p) => sum + p.price, 0) / recent.length;
  }

  calculateSlope(points) {
    if (points.length < 2) return 0;
    const recent = points.slice(-3);
    const n = recent.length;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += recent[i].price;
      sumXY += i * recent[i].price;
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  isLevelFlat(points, level, tolerance = 0.01) {
    const recent = points.slice(-3);
    return recent.every(p => Math.abs(p.price - level) / level < tolerance);
  }

  detectFlagpole(candles, lookback, direction) {
    const poleStart = Math.max(0, candles.length - lookback);
    const poleEnd = Math.max(0, candles.length - Math.floor(lookback / 2));
    
    const startPrice = candles[poleStart].close;
    const endPrice = candles[poleEnd].close;
    
    const change = (endPrice - startPrice) / startPrice;
    
    if (direction === 'bullish' && change > 0.10) return change;
    if (direction === 'bearish' && change < -0.10) return Math.abs(change);
    
    return null;
  }

  detectFlagConsolidation(candles, expectedDirection) {
    const flagCandles = candles.slice(-15);
    if (flagCandles.length < 5) return null;
    
    const prices = flagCandles.map(c => c.close);
    const n = prices.length;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += prices[i];
      sumXY += i * prices[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const angle = Math.atan(slope / prices[0]) * (180 / Math.PI);
    
    return angle;
  }

  calculateRetracement(candles, lookback) {
    const poleStart = Math.max(0, candles.length - lookback);
    const poleEnd = Math.max(0, candles.length - Math.floor(lookback / 2));
    const flagStart = poleEnd;
    const flagEnd = candles.length - 1;
    
    const poleRange = Math.abs(candles[poleEnd].close - candles[poleStart].close);
    const flagRetracement = Math.abs(candles[flagEnd].close - candles[poleEnd].close);
    
    return poleRange > 0 ? flagRetracement / poleRange : 0;
  }

  findConvergencePoint(highs, lows, resistanceSlope, supportSlope) {
    // Estimate bars until trendlines converge
    if (Math.abs(resistanceSlope - supportSlope) < 0.001) return null;
    
    const lastHigh = highs[highs.length - 1];
    const lastLow = lows[lows.length - 1];
    
    const priceDiff = lastHigh.price - lastLow.price;
    const slopeDiff = supportSlope - resistanceSlope;
    
    if (slopeDiff === 0) return null;
    
    const barsToConvergence = priceDiff / Math.abs(slopeDiff);
    return barsToConvergence;
  }

  detectPennant(candles, lookback, direction) {
    // Pennant is like a flag but with symmetrical triangle consolidation
    const poleGain = this.detectFlagpole(candles, lookback, direction);
    if (!poleGain || poleGain < 0.08) return null;
    
    const pennantCandles = candles.slice(-15);
    const highs = pennantCandles.map(c => c.high);
    const lows = pennantCandles.map(c => c.low);
    
    const highVolatility = Math.max(...highs) - Math.min(...lows);
    const recentVolatility = Math.max(...highs.slice(-5)) - Math.min(...lows.slice(-5));
    
    const volatilityCompression = recentVolatility / highVolatility;
    
    if (volatilityCompression < 0.5) {
      return { poleGain, apex: pennantCandles.length };
    }
    
    return null;
  }

  detectWedge(candles, lookback, type) {
    const wedgeCandles = candles.slice(-lookback);
    if (wedgeCandles.length < 20) return null;
    
    const swingHighs = this.findSwingPoints(wedgeCandles, 'high');
    const swingLows = this.findSwingPoints(wedgeCandles, 'low');
    
    if (swingHighs.length < 3 || swingLows.length < 3) return null;
    
    const highSlope = this.calculateSlope(swingHighs);
    const lowSlope = this.calculateSlope(swingLows);
    
    if (type === 'rising') {
      // Both trending up but converging (low slope > high slope)
      if (highSlope > 0 && lowSlope > 0 && lowSlope > highSlope) {
        const supportLevel = swingLows[swingLows.length - 1].price;
        return { supportLevel, resistanceLevel: swingHighs[swingHighs.length - 1].price };
      }
    } else if (type === 'falling') {
      // Both trending down but converging (high slope < low slope, both negative)
      if (highSlope < 0 && lowSlope < 0 && highSlope < lowSlope) {
        const resistanceLevel = swingHighs[swingHighs.length - 1].price;
        return { supportLevel: swingLows[swingLows.length - 1].price, resistanceLevel };
      }
    }
    
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // CONFIDENCE SCORING & AGGREGATION
  // ═══════════════════════════════════════════════════════════════

  aggregatePatterns(patterns, candles) {
    if (patterns.length === 0) {
      return { patterns: [], strongest: null, confidence: 0, confluence: false };
    }

    // Sort by confidence
    patterns.sort((a, b) => b.confidence - a.confidence);
    const strongest = patterns[0];

    // Check for confluence (multiple patterns same direction)
    const sameDirection = patterns.filter(p => p.direction === strongest.direction);
    const confluence = sameDirection.length >= 2;

    // Boost confidence if confluence
    let aggregateConfidence = strongest.confidence;
    if (confluence) {
      aggregateConfidence = Math.min(100, aggregateConfidence * 1.1);
    }

    // Add volume confirmation boost
    const lastCandle = candles[candles.length - 1];
    const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    const volumeRatio = lastCandle.volume / avgVolume;
    
    if (volumeRatio > 1.5) {
      aggregateConfidence = Math.min(100, aggregateConfidence * 1.05);
    }

    return {
      patterns: patterns,
      strongest: strongest,
      confidence: Math.round(aggregateConfidence),
      confluence: confluence,
      totalPatterns: patterns.length
    };
  }
}

module.exports = { PatternDetector };
