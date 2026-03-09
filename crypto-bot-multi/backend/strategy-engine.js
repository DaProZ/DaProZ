/**
 * Strategy Engine
 * Evaluates technical indicators and returns a trading signal.
 *
 * signal: { action: 'buy' | 'sell' | 'hold', confidence: 0-1, reason: string }
 */

const strategies = {
  /**
   * RSI_MACD: Buy when RSI < 40 and MACD histogram crosses above 0.
   *           Sell when RSI > 60 and MACD histogram crosses below 0.
   */
  RSI_MACD(indis) {
    const { rsi, macd } = indis;
    const macdCrossUp = macd.prevHistogram < 0 && macd.histogram > 0;
    const macdCrossDown = macd.prevHistogram > 0 && macd.histogram < 0;

    if (rsi.value < 40 && macdCrossUp) {
      return {
        action: 'buy',
        confidence: 0.7,
        reason: `RSI oversold (${rsi.value.toFixed(1)}) + MACD cross up`,
      };
    }
    if (rsi.value > 60 && macdCrossDown) {
      return {
        action: 'sell',
        confidence: 0.7,
        reason: `RSI overbought (${rsi.value.toFixed(1)}) + MACD cross down`,
      };
    }
    return { action: 'hold', confidence: 0.5, reason: 'No clear signal' };
  },

  /**
   * BOLLINGER: Buy when price touches lower band; sell at upper band.
   */
  BOLLINGER(indis) {
    const { bollinger } = indis;
    const { price, lower, upper, middle } = bollinger;
    const bandwidth = upper - lower;
    const posInBand = (price - lower) / bandwidth;

    if (posInBand < 0.1) {
      return {
        action: 'buy',
        confidence: 0.65,
        reason: `Price near lower Bollinger band (${price.toFixed(2)} vs ${lower.toFixed(2)})`,
      };
    }
    if (posInBand > 0.9) {
      return {
        action: 'sell',
        confidence: 0.65,
        reason: `Price near upper Bollinger band (${price.toFixed(2)} vs ${upper.toFixed(2)})`,
      };
    }
    return { action: 'hold', confidence: 0.5, reason: 'Price within bands' };
  },

  /**
   * EMA_CROSS: Buy on golden cross (EMA20 > EMA50); sell on death cross.
   */
  EMA_CROSS(indis) {
    const { ema } = indis;
    if (ema.ema20 > ema.ema50 * 1.002) {
      return {
        action: 'buy',
        confidence: 0.6,
        reason: `Golden cross: EMA20 (${ema.ema20.toFixed(2)}) > EMA50 (${ema.ema50.toFixed(2)})`,
      };
    }
    if (ema.ema20 < ema.ema50 * 0.998) {
      return {
        action: 'sell',
        confidence: 0.6,
        reason: `Death cross: EMA20 (${ema.ema20.toFixed(2)}) < EMA50 (${ema.ema50.toFixed(2)})`,
      };
    }
    return { action: 'hold', confidence: 0.5, reason: 'EMAs converging' };
  },

  /**
   * COMBINED: Uses RSI_MACD + BOLLINGER and requires agreement from both.
   */
  COMBINED(indis) {
    const s1 = strategies.RSI_MACD(indis);
    const s2 = strategies.BOLLINGER(indis);

    if (s1.action === s2.action && s1.action !== 'hold') {
      return {
        action: s1.action,
        confidence: Math.min((s1.confidence + s2.confidence) / 2 + 0.1, 1),
        reason: `[Combined] ${s1.reason} | ${s2.reason}`,
      };
    }
    return { action: 'hold', confidence: 0.5, reason: 'Strategies disagree' };
  },
};

/**
 * Evaluate a strategy by name.
 * Falls back to RSI_MACD if unknown.
 */
function evaluate(strategyName, indicators) {
  const fn = strategies[strategyName] || strategies.RSI_MACD;
  return fn(indicators);
}

module.exports = { evaluate, strategies };
