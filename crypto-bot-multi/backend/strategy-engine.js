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
    const { bollinger, price } = indis;
    const { pctB, lower, upper } = bollinger;

    if (pctB < 0.1) {
      return {
        action: 'buy',
        confidence: 0.65,
        reason: `Price near lower Bollinger band (${price.toFixed(2)} vs ${lower.toFixed(2)})`,
      };
    }
    if (pctB > 0.9) {
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
    if (ema.ema21 > ema.ema50 * 1.002) {
      return {
        action: 'buy',
        confidence: 0.6,
        reason: `Golden cross: EMA21 (${ema.ema21.toFixed(2)}) > EMA50 (${ema.ema50.toFixed(2)})`,
      };
    }
    if (ema.ema21 < ema.ema50 * 0.998) {
      return {
        action: 'sell',
        confidence: 0.6,
        reason: `Death cross: EMA21 (${ema.ema21.toFixed(2)}) < EMA50 (${ema.ema50.toFixed(2)})`,
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

// ─── Mode constants ───────────────────────────────────────────────────────────

const MODE = Object.freeze({
  SCALPING:     'SCALPING',
  INTRADAY:     'INTRADAY',
  SWING_CORTO:  'SWING_CORTO',
  SWING_LARGO:  'SWING_LARGO',
  NEUTRAL:      'NEUTRAL',
});

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/**
 * BB bandwidth relative to mid-price.
 * Narrow < 2 % → lateral market.
 */
function bbBandwidth(bollinger) {
  if (!bollinger || bollinger.middle === 0) return 0;
  return (bollinger.upper - bollinger.lower) / bollinger.middle;
}

/**
 * Returns true when EMA50 has clearly crossed above/below EMA200.
 * Uses a 0.3 % threshold to avoid noise.
 * direction: 'above' | 'below'
 */
function emaCrossed(ema, direction) {
  if (!ema) return false;
  const margin = 0.003;
  return direction === 'above'
    ? ema.ema50 > ema.ema200 * (1 + margin)
    : ema.ema50 < ema.ema200 * (1 - margin);
}

// ─── detectMode ──────────────────────────────────────────────────────────────

/**
 * Analyse indicators across five timeframes and return the optimal trading mode.
 *
 * Each timeframe object is the output of indicators.getAll(), so it has:
 *   { price, ema, rsi, macd, bollinger, atr, volume, levels }
 *
 * Priority chain (first rule that fires wins):
 *   1. NEUTRAL   — market is ranging (BB bandwidth narrow on 1 h AND 4 h)
 *   2. SCALPING  — high volatility: ATR on 5 m > 150 % of its own 4 h ATR
 *   3. SWING_LARGO  — EMA50 crosses EMA200 on 4 h AND confirmed on 1 d
 *   4. SWING_CORTO  — EMA50 crosses EMA200 on 1 h but NOT on 4 h/1 d
 *   5. INTRADAY  — RSI extreme (>70 or <30) on 1 h
 *   6. NEUTRAL   — fallback
 *
 * @param {object} ind5m   indicators for 5-minute candles
 * @param {object} ind15m  indicators for 15-minute candles
 * @param {object} ind1h   indicators for 1-hour candles
 * @param {object} ind4h   indicators for 4-hour candles
 * @param {object} ind1d   indicators for 1-day candles
 * @returns {{ mode: string, confidence: number, reasons: string[] }}
 */
function detectMode(ind5m, ind15m, ind1h, ind4h, ind1d) {
  const reasons = [];
  const scores  = {
    [MODE.SCALPING]:    0,
    [MODE.INTRADAY]:    0,
    [MODE.SWING_CORTO]: 0,
    [MODE.SWING_LARGO]: 0,
    [MODE.NEUTRAL]:     0,
  };

  // ── 1. Lateral / NEUTRAL — narrow Bollinger on 1 h AND 4 h ─────────────────
  const bw1h = bbBandwidth(ind1h?.bollinger);
  const bw4h = bbBandwidth(ind4h?.bollinger);
  const NARROW_THRESHOLD = 0.02; // < 2 % band width

  if (bw1h < NARROW_THRESHOLD && bw4h < NARROW_THRESHOLD) {
    scores[MODE.NEUTRAL] += 3;
    reasons.push(
      `BB estrecho en 1h (${(bw1h * 100).toFixed(2)}%) y 4h (${(bw4h * 100).toFixed(2)}%) → mercado lateral`
    );
  } else if (bw1h < NARROW_THRESHOLD) {
    scores[MODE.NEUTRAL] += 1;
    reasons.push(`BB estrecho en 1h (${(bw1h * 100).toFixed(2)}%)`);
  } else if (bw4h < NARROW_THRESHOLD) {
    scores[MODE.NEUTRAL] += 1;
    reasons.push(`BB estrecho en 4h (${(bw4h * 100).toFixed(2)}%)`);
  }

  // ── 2. SCALPING — ATR 5 m > 150 % of ATR 4 h ──────────────────────────────
  if (ind5m?.atr && ind4h?.atr && ind4h.atr > 0) {
    const atrRatio = ind5m.atr / ind4h.atr;
    if (atrRatio > 1.5) {
      scores[MODE.SCALPING] += 3;
      reasons.push(
        `ATR 5m (${ind5m.atr.toFixed(4)}) > 150% del ATR 4h (${ind4h.atr.toFixed(4)}) → alta volatilidad`
      );
    } else if (atrRatio > 1.2) {
      scores[MODE.SCALPING] += 1;
      reasons.push(`ATR 5m/4h ratio ${(atrRatio * 100).toFixed(0)}% (volatilidad elevada)`);
    }
  }

  // Also check 15 m ATR vs 4 h as secondary volatility signal
  if (ind15m?.atr && ind4h?.atr && ind4h.atr > 0) {
    const atrRatio15 = ind15m.atr / ind4h.atr;
    if (atrRatio15 > 1.5) {
      scores[MODE.SCALPING] += 1;
      reasons.push(`ATR 15m/4h ratio ${(atrRatio15 * 100).toFixed(0)}% (confirma alta volatilidad)`);
    }
  }

  // ── 3. SWING_LARGO — EMA50 x EMA200 en 4 h, confirmado en 1 d ────────────
  const swing4hAbove = emaCrossed(ind4h?.ema, 'above');
  const swing4hBelow = emaCrossed(ind4h?.ema, 'below');
  const swing1dAbove = emaCrossed(ind1d?.ema, 'above');
  const swing1dBelow = emaCrossed(ind1d?.ema, 'below');

  if (swing4hAbove && swing1dAbove) {
    scores[MODE.SWING_LARGO] += 4;
    reasons.push('EMA50 > EMA200 en 4h y 1d → tendencia alcista confirmada (swing largo)');
  } else if (swing4hBelow && swing1dBelow) {
    scores[MODE.SWING_LARGO] += 4;
    reasons.push('EMA50 < EMA200 en 4h y 1d → tendencia bajista confirmada (swing largo)');
  } else if (swing4hAbove || swing4hBelow) {
    scores[MODE.SWING_LARGO] += 2;
    reasons.push(`Cruce EMA50/EMA200 en 4h (${swing4hAbove ? 'alcista' : 'bajista'}), sin confirmar en 1d`);
  }

  // ── 4. SWING_CORTO — EMA50 x EMA200 en 1 h sin confirmación superior ──────
  const swing1hAbove = emaCrossed(ind1h?.ema, 'above');
  const swing1hBelow = emaCrossed(ind1h?.ema, 'below');

  if ((swing1hAbove || swing1hBelow) && !swing4hAbove && !swing4hBelow) {
    scores[MODE.SWING_CORTO] += 3;
    reasons.push(
      `Cruce EMA50/EMA200 en 1h (${swing1hAbove ? 'alcista' : 'bajista'}) sin cruce en 4h → swing corto`
    );
  } else if (swing1hAbove || swing1hBelow) {
    scores[MODE.SWING_CORTO] += 1;
    reasons.push(`Cruce EMA50/EMA200 en 1h (${swing1hAbove ? 'alcista' : 'bajista'})`);
  }

  // ── 5. INTRADAY — RSI extremo en 1 h ─────────────────────────────────────
  const rsi1h = ind1h?.rsi?.value;
  if (rsi1h !== undefined) {
    if (rsi1h > 70) {
      scores[MODE.INTRADAY] += 3;
      reasons.push(`RSI 1h sobrecomprado (${rsi1h.toFixed(1)}) → oportunidad intraday bajista`);
    } else if (rsi1h < 30) {
      scores[MODE.INTRADAY] += 3;
      reasons.push(`RSI 1h sobrevendido (${rsi1h.toFixed(1)}) → oportunidad intraday alcista`);
    } else if (rsi1h > 60 || rsi1h < 40) {
      scores[MODE.INTRADAY] += 1;
      reasons.push(`RSI 1h en zona de tendencia (${rsi1h.toFixed(1)})`);
    }
  }

  // ── 6. Extra: MACD 15 m confirma intraday ────────────────────────────────
  if (ind15m?.macd) {
    const { histogram, prevHistogram } = ind15m.macd;
    if ((prevHistogram < 0 && histogram > 0) || (prevHistogram > 0 && histogram < 0)) {
      scores[MODE.INTRADAY] += 1;
      reasons.push(`Cruce MACD en 15m confirma momentum intraday`);
    }
  }

  // ── Determine winner ──────────────────────────────────────────────────────
  let bestMode  = MODE.NEUTRAL;
  let bestScore = 0;

  for (const [mode, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestMode  = mode;
    }
  }

  // Normalise confidence to [0.5, 0.95]
  const maxPossible = 8;
  const confidence  = parseFloat(
    Math.min(0.5 + (bestScore / maxPossible) * 0.45, 0.95).toFixed(2)
  );

  return { mode: bestMode, confidence, scores, reasons };
}

module.exports = { evaluate, strategies, detectMode, MODE };
