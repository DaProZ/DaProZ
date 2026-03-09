const tulind = require('tulind');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function run(name, inputs, options) {
  return new Promise((resolve, reject) => {
    tulind.indicators[name].indicator(inputs, options, (err, results) => {
      if (err) return reject(new Error(`tulind[${name}]: ${err}`));
      resolve(results);
    });
  });
}

const last  = (arr) => arr[arr.length - 1];
const prev  = (arr, n = 2) => arr[arr.length - n];

// ─── Support / Resistance ─────────────────────────────────────────────────────
// Finds the N most prominent swing highs / lows in the last `lookback` candles
// using a simple pivot algorithm (each point higher/lower than its neighbours).

function calcSupportResistance(highs, lows, lookback = 50, neighbours = 2) {
  const h = highs.slice(-lookback);
  const l = lows.slice(-lookback);
  const len = h.length;

  const resistances = [];
  const supports    = [];

  for (let i = neighbours; i < len - neighbours; i++) {
    // Pivot high
    let isHigh = true;
    for (let j = i - neighbours; j <= i + neighbours; j++) {
      if (j !== i && h[j] >= h[i]) { isHigh = false; break; }
    }
    if (isHigh) resistances.push(parseFloat(h[i].toFixed(4)));

    // Pivot low
    let isLow = true;
    for (let j = i - neighbours; j <= i + neighbours; j++) {
      if (j !== i && l[j] <= l[i]) { isLow = false; break; }
    }
    if (isLow) supports.push(parseFloat(l[i].toFixed(4)));
  }

  // Return the strongest levels: most recent 3 of each
  return {
    resistance: resistances.slice(-3).sort((a, b) => b - a),
    support:    supports.slice(-3).sort((a, b) => b - a),
  };
}

// ─── Volume SMA ───────────────────────────────────────────────────────────────

function calcVolumeSma(volumes, period = 20) {
  if (volumes.length < period) return null;
  const slice = volumes.slice(-period);
  return parseFloat((slice.reduce((s, v) => s + v, 0) / period).toFixed(4));
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Compute all indicators from a candles array.
 *
 * @param {Array<{open,high,low,close,volume}>} candles
 * @returns {Promise<object>}
 */
async function getAll(candles) {
  if (!candles || candles.length < 210) {
    throw new Error(`Need at least 210 candles, got ${candles?.length ?? 0}`);
  }

  const closes  = candles.map((c) => c.close);
  const highs   = candles.map((c) => c.high);
  const lows    = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);

  // Run all tulind computations in parallel
  const [
    [ema9Raw],
    [ema21Raw],
    [ema50Raw],
    [ema200Raw],
    [rsiRaw],
    [macdRaw, macdSigRaw, macdHistRaw],
    [bbUpperRaw, bbMidRaw, bbLowerRaw],
    [atrRaw],
  ] = await Promise.all([
    run('ema',    [closes],                [9]),
    run('ema',    [closes],                [21]),
    run('ema',    [closes],                [50]),
    run('ema',    [closes],                [200]),
    run('rsi',    [closes],                [14]),
    run('macd',   [closes],                [12, 26, 9]),
    run('bbands', [closes],                [20, 2]),
    run('atr',    [highs, lows, closes],   [14]),
  ]);

  const price = last(closes);

  // Bollinger %B: position of price within the band (0 = lower, 1 = upper)
  const bbUpper = last(bbUpperRaw);
  const bbLower = last(bbLowerRaw);
  const bbPctB  = bbUpper !== bbLower
    ? parseFloat(((price - bbLower) / (bbUpper - bbLower)).toFixed(4))
    : 0.5;

  const macdVal  = last(macdRaw);
  const macdSig  = last(macdSigRaw);
  const macdHist = last(macdHistRaw);

  const levels = calcSupportResistance(highs, lows);
  const volSma  = calcVolumeSma(volumes, 20);
  const volLast  = parseFloat(last(volumes).toFixed(4));

  return {
    price,

    ema: {
      ema9:   parseFloat(last(ema9Raw).toFixed(4)),
      ema21:  parseFloat(last(ema21Raw).toFixed(4)),
      ema50:  parseFloat(last(ema50Raw).toFixed(4)),
      ema200: parseFloat(last(ema200Raw).toFixed(4)),
    },

    rsi: {
      value: parseFloat(last(rsiRaw).toFixed(2)),
      prev:  parseFloat(prev(rsiRaw).toFixed(2)),
    },

    macd: {
      value:        parseFloat(macdVal.toFixed(4)),
      signal:       parseFloat(macdSig.toFixed(4)),
      histogram:    parseFloat(macdHist.toFixed(4)),
      prevHistogram: parseFloat(prev(macdHistRaw).toFixed(4)),
    },

    bollinger: {
      upper:  parseFloat(bbUpper.toFixed(4)),
      middle: parseFloat(last(bbMidRaw).toFixed(4)),
      lower:  parseFloat(bbLower.toFixed(4)),
      pctB:   bbPctB,
    },

    atr: parseFloat(last(atrRaw).toFixed(4)),

    volume: {
      current: volLast,
      sma20:   volSma,
      ratio:   volSma ? parseFloat((volLast / volSma).toFixed(3)) : null,
    },

    levels,
  };
}

// ─── Backward-compat wrapper (used by strategy-engine / server) ───────────────

async function compute(closes, highs, lows) {
  const candles = closes.map((c, i) => ({
    close:  c,
    high:   highs[i],
    low:    lows[i],
    volume: 0,
  }));

  // compute() was called with arbitrary arrays; pad to 210 if needed
  if (candles.length < 210) {
    const dummy = { close: closes[0], high: highs[0], low: lows[0], volume: 0 };
    while (candles.length < 210) candles.unshift(dummy);
  }

  return getAll(candles);
}

module.exports = { getAll, compute };
