require('dotenv').config();
const axios = require('axios');
const WebSocket = require('ws');
const Binance = require('node-binance-api');

const client = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY || '',
  APISECRET: process.env.BINANCE_API_SECRET || '',
  test: process.env.PAPER_TRADING !== 'false',
});

const BASE_URL = 'https://api.binance.com';
const WS_BASE = 'wss://stream.binance.com:9443/stream';

// ─── Multi-timeframe candle store ────────────────────────────────────────────

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'];
const MAX_CANDLES = 300;

// store[pair][timeframe] = Candle[]
const store = {};
for (const pair of PAIRS) {
  store[pair] = {};
  for (const tf of TIMEFRAMES) store[pair][tf] = [];
}

function parseKline(k) {
  return {
    time: Math.floor(k.t / 1000),
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: parseFloat(k.v),
    closed: k.x,
  };
}

function upsertCandle(pair, tf, candle) {
  const arr = store[pair][tf];
  const last = arr[arr.length - 1];

  if (last && last.time === candle.time) {
    arr[arr.length - 1] = candle; // update in-progress candle
  } else {
    arr.push(candle);
    if (arr.length > MAX_CANDLES) arr.shift();
  }
}

// ─── Seed historical candles from REST before streaming ──────────────────────

async function seedHistorical(pair, tf) {
  try {
    const { data } = await axios.get(`${BASE_URL}/api/v3/klines`, {
      params: { symbol: pair, interval: tf, limit: MAX_CANDLES },
    });
    store[pair][tf] = data.map(([t, o, h, l, c, v]) => ({
      time: Math.floor(t / 1000),
      open: parseFloat(o),
      high: parseFloat(h),
      low: parseFloat(l),
      close: parseFloat(c),
      volume: parseFloat(v),
      closed: true,
    }));
    console.log(`[seed] ${pair} ${tf}: ${store[pair][tf].length} candles`);
  } catch (err) {
    console.error(`[seed] Failed ${pair} ${tf}: ${err.message}`);
  }
}

// ─── Combined WebSocket stream ────────────────────────────────────────────────
// Binance allows up to 1024 streams per connection.
// 5 pairs × 5 timeframes = 25 streams — fits in one connection.

let wsKline = null;
let wsReconnectTimer = null;

function buildStreamNames() {
  const names = [];
  for (const pair of PAIRS) {
    for (const tf of TIMEFRAMES) {
      names.push(`${pair.toLowerCase()}@kline_${tf}`);
    }
  }
  return names;
}

function connectKlineStream(onUpdate) {
  if (wsKline) {
    wsKline.terminate();
    wsKline = null;
  }

  const streams = buildStreamNames().join('/');
  const url = `${WS_BASE}?streams=${streams}`;

  wsKline = new WebSocket(url);

  wsKline.on('open', () => {
    console.log('[ws] Binance kline stream connected (25 streams)');
    clearTimeout(wsReconnectTimer);
  });

  wsKline.on('message', (raw) => {
    try {
      const { data } = JSON.parse(raw); // combined stream wraps payload in { stream, data }
      if (!data || data.e !== 'kline') return;

      const pair = data.s;                // e.g. "BTCUSDT"
      const tf   = data.k.i;             // e.g. "5m"
      const candle = parseKline(data.k);

      if (store[pair] && store[pair][tf] !== undefined) {
        upsertCandle(pair, tf, candle);
        if (typeof onUpdate === 'function') onUpdate(pair, tf, candle);
      }
    } catch {
      // ignore parse errors
    }
  });

  wsKline.on('close', (code, reason) => {
    console.warn(`[ws] Kline stream closed (${code}). Reconnecting in 5s…`);
    wsReconnectTimer = setTimeout(() => connectKlineStream(onUpdate), 5_000);
  });

  wsKline.on('error', (err) => {
    console.error('[ws] Kline stream error:', err.message);
    // 'close' will fire after error, triggering reconnect
  });
}

// ─── Public initialiser ───────────────────────────────────────────────────────

/**
 * Seed historical candles for all pairs/timeframes, then open the combined
 * WebSocket stream to keep the store up-to-date in real time.
 *
 * @param {Function} onUpdate  Optional callback(pair, timeframe, candle)
 */
async function initStreams(onUpdate) {
  console.log('[binance] Seeding historical candles…');

  // Stagger requests to avoid rate-limit (max 1200 weight/min)
  // Each klines request = 2 weight; 25 requests = 50 weight — well within limits.
  const tasks = [];
  for (const pair of PAIRS) {
    for (const tf of TIMEFRAMES) {
      tasks.push(() => seedHistorical(pair, tf));
    }
  }

  // Run 5 at a time
  for (let i = 0; i < tasks.length; i += 5) {
    await Promise.all(tasks.slice(i, i + 5).map((fn) => fn()));
  }

  console.log('[binance] Historical seed complete. Opening WebSocket…');
  connectKlineStream(onUpdate);
}

// ─── Store accessors ──────────────────────────────────────────────────────────

/**
 * Return stored candles for a pair + timeframe.
 * Falls back to a REST fetch if the store is still empty.
 */
async function getCachedCandles(pair, tf) {
  const upper = pair.toUpperCase();
  if (!PAIRS.includes(upper)) throw new Error(`Unknown pair: ${pair}`);
  if (!TIMEFRAMES.includes(tf)) throw new Error(`Unknown timeframe: ${tf}`);

  if (store[upper][tf].length > 0) return store[upper][tf];

  // Fallback: fetch from REST (store not ready yet)
  return getCandles(upper, tf, MAX_CANDLES);
}

// ─── Original REST helpers (kept for backward-compat) ────────────────────────

async function getCandles(symbol = 'BTCUSDT', interval = '1h', limit = 100) {
  const { data } = await axios.get(`${BASE_URL}/api/v3/klines`, {
    params: { symbol, interval, limit },
  });
  return data.map(([t, o, h, l, c, v]) => ({
    time: Math.floor(t / 1000),
    open: parseFloat(o),
    high: parseFloat(h),
    low: parseFloat(l),
    close: parseFloat(c),
    volume: parseFloat(v),
    closed: true,
  }));
}

async function getPrice(symbol = 'BTCUSDT') {
  const { data } = await axios.get(`${BASE_URL}/api/v3/ticker/price`, {
    params: { symbol },
  });
  return parseFloat(data.price);
}

async function getBalances() {
  return new Promise((resolve, reject) => {
    client.balance((error, balances) => {
      if (error) return reject(new Error(error.body || error.message));
      const result = {};
      for (const [asset, info] of Object.entries(balances)) {
        if (parseFloat(info.available) > 0 || parseFloat(info.onOrder) > 0) {
          result[asset] = {
            available: parseFloat(info.available),
            onOrder: parseFloat(info.onOrder),
          };
        }
      }
      resolve(result);
    });
  });
}

async function placeOrder(trade) {
  return new Promise((resolve, reject) => {
    const fn = trade.action === 'buy' ? client.marketBuy : client.marketSell;
    fn(trade.symbol, trade.quantity, (error, response) => {
      if (error) return reject(new Error(error.body || error.message));
      resolve(response);
    });
  });
}

function subscribeToTrades(symbol, callback) {
  client.websockets.trades(symbol, (trades) => {
    callback({
      symbol: trades.s,
      price: parseFloat(trades.p),
      qty: parseFloat(trades.q),
      time: trades.T,
    });
  });
}

module.exports = {
  // Multi-timeframe streaming
  initStreams,
  getCachedCandles,
  store,
  PAIRS,
  TIMEFRAMES,
  // REST helpers
  getCandles,
  getPrice,
  getBalances,
  placeOrder,
  subscribeToTrades,
};
