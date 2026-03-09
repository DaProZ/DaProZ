require('dotenv').config();
const axios = require('axios');
const Binance = require('node-binance-api');

const client = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY || '',
  APISECRET: process.env.BINANCE_API_SECRET || '',
  test: process.env.PAPER_TRADING !== 'false',
});

const BASE_URL = 'https://api.binance.com';

/**
 * Fetch OHLCV candles from Binance REST API.
 * Returns an array of { time, open, high, low, close, volume }.
 */
async function getCandles(symbol = 'BTCUSDT', interval = '1h', limit = 100) {
  const { data } = await axios.get(`${BASE_URL}/api/v3/klines`, {
    params: { symbol, interval, limit },
  });

  return data.map(([time, open, high, low, close, volume]) => ({
    time: Math.floor(time / 1000),
    open: parseFloat(open),
    high: parseFloat(high),
    low: parseFloat(low),
    close: parseFloat(close),
    volume: parseFloat(volume),
  }));
}

/**
 * Get current ticker price for a symbol.
 */
async function getPrice(symbol = 'BTCUSDT') {
  const { data } = await axios.get(`${BASE_URL}/api/v3/ticker/price`, {
    params: { symbol },
  });
  return parseFloat(data.price);
}

/**
 * Get account balances (requires valid API keys).
 */
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

/**
 * Place a market order.
 * trade: { symbol, action ('buy'|'sell'), quantity }
 */
async function placeOrder(trade) {
  return new Promise((resolve, reject) => {
    const fn = trade.action === 'buy' ? client.marketBuy : client.marketSell;
    fn(trade.symbol, trade.quantity, (error, response) => {
      if (error) return reject(new Error(error.body || error.message));
      resolve(response);
    });
  });
}

/**
 * Subscribe to live trade stream via WebSocket.
 * callback receives { symbol, price, qty, time }
 */
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

module.exports = { getCandles, getPrice, getBalances, placeOrder, subscribeToTrades };
