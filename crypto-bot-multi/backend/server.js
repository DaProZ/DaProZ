require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const binance        = require('./binance');
const indicators     = require('./indicators');
const strategyEngine = require('./strategy-engine');
const riskManager    = require('./risk-manager');
const claudeAnalysis = require('./claude-analysis');
const signalDb       = require('./signal-db');

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

// Paper trade size in USDT (amount simulated per operation, runtime-configurable)
const PAPER_TRADE_SIZE = 100;

// Active bot state
const state = {
  running: false,
  symbol: 'BTCUSDT',
  strategy: 'RSI_MACD',
  paperTrading: process.env.PAPER_TRADING !== 'false', // true by default
  tradeSize: PAPER_TRADE_SIZE,  // USDT per operation (configurable from UI)
  riskConfig: {
    dailyLossLimit:  300,   // USDT — 0 = disabled
    maxTradesPerDay: 10,    // 0 = disabled
    minConfidence:   0.60,  // 0.0–1.0
  },
  trades: [],
  openPositions: [],
  stats: { totalPnl: 0, winRate: 0, totalTrades: 0 },
};

// ─── Daily risk check ────────────────────────────────────────────────────────
function checkDailyLimits(par) {
  const cfg = state.riskConfig;
  const todayStats = signalDb.getTodayStats(par);

  if (cfg.dailyLossLimit > 0 && todayStats.pnl <= -cfg.dailyLossLimit) {
    return { blocked: true, reason: `Límite de pérdida diaria alcanzado (${todayStats.pnl.toFixed(2)} USDT)` };
  }
  if (cfg.maxTradesPerDay > 0 && todayStats.count >= cfg.maxTradesPerDay) {
    return { blocked: true, reason: `Máximo de operaciones del día alcanzado (${todayStats.count})` };
  }
  return { blocked: false };
}

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

        // Persist actionable signals (skip neutrals and cached repeats)
        if (multiAnalysis.señal !== 'neutro' && !multiAnalysis._cached && multiAnalysis.entrada_ideal) {
          // Daily risk gate
          const dailyCheck = checkDailyLimits(pair);
          if (dailyCheck.blocked) {
            console.log(`[SignalDB] Blocked by daily limit: ${dailyCheck.reason}`);
            ws.send(JSON.stringify({ type: 'riskBlocked', reason: dailyCheck.reason }));
          } else if (multiAnalysis.confianza < state.riskConfig.minConfidence) {
            console.log(`[SignalDB] Blocked: confidence ${multiAnalysis.confianza} < ${state.riskConfig.minConfidence}`);
          } else {
          const riskUSDT = state.tradeSize;
          const sigId = signalDb.insertSignal({
            par:              pair,
            modo:             multiAnalysis.modo              ?? modeResult.mode,
            señal:            multiAnalysis.señal,
            entrada:          multiAnalysis.entrada_ideal,
            stopLoss:         multiAnalysis.stopLoss,
            takeProfit:       multiAnalysis.takeProfit,
            confianza:        multiAnalysis.confianza,
            duracion_estimada: multiAnalysis.duracion_estimada,
            riskUSDT,
          });
          const logged = signalDb.getHistory(pair, 1)[0];
          broadcast({ type: 'signalLogged', data: logged });
          console.log(`[SignalDB] Logged ${multiAnalysis.señal} ${pair} id=${sigId}`);
          } // end risk gate
        }
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
      const dailyOk  = !checkDailyLimits(state.symbol).blocked;
      const confOk   = (signal.confidence ?? 1) >= state.riskConfig.minConfidence;
      const approved = dailyOk && confOk && riskManager.approve(signal, state);

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

      // Check if any open signals hit SL/TP this tick
      const latestCandle = candles[candles.length - 1];
      const closedSigs   = signalDb.checkAndCloseSignals(state.symbol, latestCandle);
      for (const s of closedSigs) {
        broadcast({ type: 'signalClosed', data: s });
        console.log(`[SignalDB] Auto-closed ${s.id} → ${s.resultado} pnl=${s.pnl}`);
      }

      if (approved && signal.action !== 'hold') {
        const price = indis.price;
        const trade = {
          id: uuidv4(),
          symbol: state.symbol,
          action: signal.action,
          price,
          quantity: riskManager.calcQuantity(signal, state),
          timestamp: Date.now(),
          reason: signal.reason,
        };

        // In paper-trading mode we don't place real orders
        if (state.paperTrading) {
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

// PATCH /api/settings — update runtime settings
app.patch('/api/settings', (req, res) => {
  const { paperTrading, tradeSize, riskConfig } = req.body;

  if (typeof paperTrading === 'boolean') {
    state.paperTrading = paperTrading;
    console.log(`[Settings] paperTrading → ${state.paperTrading}`);
  }
  if (typeof tradeSize === 'number' && tradeSize >= 1 && tradeSize <= 100_000) {
    state.tradeSize = tradeSize;
    console.log(`[Settings] tradeSize → ${state.tradeSize}`);
  }
  if (riskConfig && typeof riskConfig === 'object') {
    if (typeof riskConfig.dailyLossLimit  === 'number') state.riskConfig.dailyLossLimit  = riskConfig.dailyLossLimit;
    if (typeof riskConfig.maxTradesPerDay === 'number') state.riskConfig.maxTradesPerDay = riskConfig.maxTradesPerDay;
    if (typeof riskConfig.minConfidence   === 'number') state.riskConfig.minConfidence   = riskConfig.minConfidence;
    console.log('[Settings] riskConfig →', state.riskConfig);
  }

  broadcast({ type: 'state', data: state });
  res.json({ paperTrading: state.paperTrading, tradeSize: state.tradeSize, riskConfig: state.riskConfig });
});

// ── Signal history ────────────────────────────────────────────────────────────
// GET /api/signals/history?pair=BTCUSDT&limit=50
app.get('/api/signals/history', (req, res) => {
  const { pair, limit = 50 } = req.query;
  try {
    const rows = signalDb.getHistory(pair || null, Number(limit));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/signals/today?pair=BTCUSDT  — today's pnl + trade count for risk panel
app.get('/api/signals/today', (req, res) => {
  const { pair } = req.query;
  try {
    res.json(signalDb.getTodayStats(pair || null));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/signals/stats?pair=BTCUSDT
app.get('/api/signals/stats', (req, res) => {
  const { pair } = req.query;
  try {
    res.json(signalDb.getStats(pair || null));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/signals/:id  — manual close (result + pnl override)
app.patch('/api/signals/:id', (req, res) => {
  const { resultado, pnl } = req.body;
  if (!resultado) return res.status(400).json({ error: 'resultado required' });
  try {
    signalDb.closeSignal(req.params.id, resultado, pnl ?? 0);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
