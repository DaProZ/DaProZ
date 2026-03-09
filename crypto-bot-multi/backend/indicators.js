const tulind = require('tulind');

/**
 * Wrap a tulind indicator call in a Promise.
 */
function runIndicator(name, inputs, options) {
  return new Promise((resolve, reject) => {
    tulind.indicators[name].indicator(inputs, options, (err, results) => {
      if (err) return reject(new Error(`tulind ${name}: ${err}`));
      resolve(results);
    });
  });
}

/**
 * Compute a set of common technical indicators from OHLCV data.
 *
 * @param {number[]} closes  - Array of closing prices
 * @param {number[]} highs   - Array of high prices
 * @param {number[]} lows    - Array of low prices
 * @returns {Promise<object>} Indicator values (latest value for each)
 */
async function compute(closes, highs, lows) {
  const [rsiResult] = await runIndicator('rsi', [closes], [14]);
  const [macdResult, macdSignalResult, macdHistResult] = await runIndicator(
    'macd',
    [closes],
    [12, 26, 9]
  );
  const [bbUpper, bbMiddle, bbLower] = await runIndicator('bbands', [closes], [20, 2]);
  const [ema20Result] = await runIndicator('ema', [closes], [20]);
  const [ema50Result] = await runIndicator('ema', [closes], [50]);
  const [atrResult] = await runIndicator('atr', [highs, lows, closes], [14]);

  const last = (arr) => arr[arr.length - 1];
  const prev = (arr, n = 2) => arr[arr.length - n];

  return {
    rsi: {
      value: last(rsiResult),
      prev: prev(rsiResult),
    },
    macd: {
      value: last(macdResult),
      signal: last(macdSignalResult),
      histogram: last(macdHistResult),
      prevHistogram: prev(macdHistResult),
    },
    bollinger: {
      upper: last(bbUpper),
      middle: last(bbMiddle),
      lower: last(bbLower),
      price: last(closes),
    },
    ema: {
      ema20: last(ema20Result),
      ema50: last(ema50Result),
    },
    atr: last(atrResult),
    price: last(closes),
  };
}

module.exports = { compute };
