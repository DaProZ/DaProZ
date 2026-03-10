require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const binance = require('./binance');
const indicators = require('./indicators');
const strategyEngine = require('./strategy-engine');
const riskManager = require('./risk-manager');
const claudeAnalysis = require('./claude-analysis');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Start Binance multi-timeframe streams on boot
binance.initStreams((pair, tf, candle) => {
  // Broadcast live candle updates to all dashboard clients
  broadcast({ type: 'candleUpdate', pair, tf, data: candle });
});

// Active bot state
const state = {
  running: false,
  symbol: 'BTCUSDT',
  strategy: 'RSI_MACD',
  trades: [],
  openPositions: [],
  stats: { totalPnl: 0, winRate: 0, totalTrades: 0 },
};

// Broadcast to all WS clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.send(JSON.stringify({ type: 'state', data: state }));

  ws.on('message', (msg) => {
    try {
      const { action, payload } = JSON.parse(msg);
      handleAction(action, payload, ws);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: e.message }));
    }
  });
});

async function handleAction(action, payload, ws) {
  switch (action) {
    case 'start':
      state.running = true;
      state.symbol = payload.symbol || state.symbol;
      state.strategy = payload.strategy || state.strategy;
      broadcast({ type: 'state', data: state });
      startTradingLoop();
      break;

    case 'stop':
      state.running = false;
      broadcast({ type: 'state', data: state });
      break;

    case 'getCandles': {
      const candles = await binance.getCandles(payload.symbol, payload.interval, payload.limit);
      ws.send(JSON.stringify({ type: 'candles', data: candles }));
      break;
    }

    case 'analyzeWithClaude': {
      const analysis = await claudeAnalysis.analyze(payload.symbol, payload.candles);
      broadcast({ type: 'claudeAnalysis', data: analysis });
      break;
    }

    case 'getMultiData': {
      const pair = payload.symbol || state.symbol;
      try {
        // 1. Fetch candles for all timeframes in parallel
        const [c5m, c15m, c1h, c4h, c1d] = await Promise.all([
          binance.getCachedCandles(pair, '5m'),
          binance.getCachedCandles(pair, '15m'),
          binance.getCachedCandles(pair, '1h'),
          binance.getCachedCandles(pair, '4h'),
          binance.getCachedCandles(pair, '1d'),
        ]);

        // 2. Broadcast raw candles so MultiChart renders immediately
        ws.send(JSON.stringify({
          type: 'multiCandles',
          data: { '5m': c5m, '15m': c15m, '1h': c1h, '4h': c4h, '1d': c1d },
        }));

        // 3. Compute indicators for each timeframe
        const [ind5m, ind15m, ind1h, ind4h, ind1d] = await Promise.all([
          indicators.getAll(c5m),
          indicators.getAll(c15m),
          indicators.getAll(c1h),
          indicators.getAll(c4h),
          indicators.getAll(c1d),
        ]);

        // 4. Detect trading mode
        const modeResult = strategyEngine.detectMode(ind5m, ind15m, ind1h, ind4h, ind1d);
        ws.send(JSON.stringify({ type: 'modeResult', data: modeResult }));

        // Also update indicators panel with the 1h data
        broadcast({ type: 'indicators', data: ind1h });

        // 5. Claude multi-timeframe analysis (cached 2 min per pair+mode)
        const allIndicators = { ind5m, ind15m, ind1h, ind4h, ind1d };
        const multiAnalysis = await claudeAnalysis.analyzeMultiMode(
          pair, modeResult, allIndicators, riskManager.DEFAULT_CONFIG
        );
        ws.send(JSON.stringify({ type: 'claudeMultiAnalysis', data: multiAnalysis }));
        console.log(`[MultiData] ${pair} → mode=${modeResult.mode} conf=${modeResult.confidence} cached=${multiAnalysis._cached}`);
      } catch (err) {
        console.error('[MultiData] Error:', err.message);
        ws.send(JSON.stringify({ type: 'error', message: `getMultiData: ${err.message}` }));
      }
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown action: ${action}` }));
  }
}

async function startTradingLoop() {
  let loopCount = 0;
  while (state.running) {
    try {
      const candles = await binance.getCachedCandles(state.symbol, '1h');
      const indis   = await indicators.getAll(candles);
      const signal  = strategyEngine.evaluate(state.strategy, indis);
      const approved = riskManager.approve(signal, state);

      broadcast({ type: 'indicators', data: indis });

      // Every 5 ticks (~5 min) refresh full multi-timeframe analysis
      if (loopCount % 5 === 0) {
        try {
          const [c5m, c15m, c4h, c1d] = await Promise.all([
            binance.getCachedCandles(state.symbol, '5m'),
            binance.getCachedCandles(state.symbol, '15m'),
            binance.getCachedCandles(state.symbol, '4h'),
            binance.getCachedCandles(state.symbol, '1d'),
          ]);
          broadcast({ type: 'multiCandles', data: { '5m': c5m, '15m': c15m, '1h': candles, '4h': c4h, '1d': c1d } });
          const [ind5m, ind15m, ind4h, ind1d] = await Promise.all([
            indicators.getAll(c5m), indicators.getAll(c15m),
            indicators.getAll(c4h), indicators.getAll(c1d),
          ]);
          const modeResult = strategyEngine.detectMode(ind5m, ind15m, indis, ind4h, ind1d);
          broadcast({ type: 'modeResult', data: modeResult });
          const multiAnalysis = await claudeAnalysis.analyzeMultiMode(
            state.symbol, modeResult, { ind5m, ind15m, ind1h: indis, ind4h, ind1d },
            riskManager.DEFAULT_CONFIG
          );
          broadcast({ type: 'claudeMultiAnalysis', data: multiAnalysis });
        } catch (mErr) {
          console.warn('[TradingLoop] multi-data refresh failed:', mErr.message);
        }
      }
      loopCount++;

      if (approved && signal.action !== 'hold') {
        const trade = {
          id: uuidv4(),
          symbol: state.symbol,
          action: signal.action,
          price: closes[closes.length - 1],
          quantity: riskManager.calcQuantity(signal, state),
          timestamp: Date.now(),
          reason: signal.reason,
        };

        // In paper-trading mode we don't place real orders
        if (process.env.PAPER_TRADING !== 'false') {
          state.trades.push(trade);
          state.stats.totalTrades++;
          broadcast({ type: 'trade', data: trade });
          console.log(`[PAPER] ${trade.action.toUpperCase()} ${trade.symbol} @ ${trade.price}`);
        } else {
          await binance.placeOrder(trade);
          state.trades.push(trade);
          state.stats.totalTrades++;
          broadcast({ type: 'trade', data: trade });
        }
      }

      broadcast({ type: 'signal', data: signal });
    } catch (err) {
      console.error('Trading loop error:', err.message);
      broadcast({ type: 'error', message: err.message });
    }

    // Wait 60 seconds before next iteration
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

// REST endpoints
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/state', (_req, res) => res.json(state));
app.get('/api/trades', (_req, res) => res.json(state.trades));

// Legacy query-param endpoint
app.get('/api/candles', async (req, res) => {
  const { symbol = 'BTCUSDT', interval = '1h', limit = 100 } = req.query;
  const candles = await binance.getCandles(symbol, interval, Number(limit));
  res.json(candles);
});

// Multi-timeframe endpoint: GET /api/candles/:pair/:timeframe
// Returns up to 300 cached candles from the in-memory store.
// Supported pairs: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT
// Supported timeframes: 5m, 15m, 1h, 4h, 1d
app.get('/api/candles/:pair/:timeframe', async (req, res) => {
  try {
    const { pair, timeframe } = req.params;
    const candles = await binance.getCachedCandles(pair, timeframe);
    res.json(candles);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/claude-analyze', async (req, res) => {
  const { symbol, candles } = req.body;
  const analysis = await claudeAnalysis.analyze(symbol, candles);
  res.json(analysis);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
