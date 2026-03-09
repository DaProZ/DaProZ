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

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown action: ${action}` }));
  }
}

async function startTradingLoop() {
  while (state.running) {
    try {
      const candles = await binance.getCandles(state.symbol, '1h', 100);
      const closes = candles.map((c) => c.close);
      const highs = candles.map((c) => c.high);
      const lows = candles.map((c) => c.low);

      const indis = await indicators.compute(closes, highs, lows);
      const signal = strategyEngine.evaluate(state.strategy, indis);
      const approved = riskManager.approve(signal, state);

      broadcast({ type: 'indicators', data: indis });

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

app.get('/api/candles', async (req, res) => {
  const { symbol = 'BTCUSDT', interval = '1h', limit = 100 } = req.query;
  const candles = await binance.getCandles(symbol, interval, Number(limit));
  res.json(candles);
});

app.post('/api/claude-analyze', async (req, res) => {
  const { symbol, candles } = req.body;
  const analysis = await claudeAnalysis.analyze(symbol, candles);
  res.json(analysis);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
