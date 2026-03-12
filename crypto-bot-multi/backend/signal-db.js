const Database = require('better-sqlite3');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');

// ─── Open / init ──────────────────────────────────────────────────────────────

const DB_PATH = process.env.SIGNALS_DB_PATH || path.join(__dirname, 'signals.db');
const db = new Database(DB_PATH);

// Performance tuning
db.pragma('journal_mode = WAL');
db.pragma('synchronous  = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS signals (
    id                TEXT    PRIMARY KEY,
    timestamp         INTEGER NOT NULL,
    par               TEXT    NOT NULL,
    modo              TEXT,
    señal             TEXT,
    entrada           REAL,
    stopLoss          REAL,
    takeProfit        REAL,
    confianza         REAL,
    duracion_estimada TEXT,
    riskUSDT          REAL    DEFAULT 10,
    resultado         TEXT,
    pnl               REAL,
    closedAt          INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_signals_par ON signals(par);
  CREATE INDEX IF NOT EXISTS idx_signals_ts  ON signals(timestamp DESC);
`);

// ─── Prepared statements ──────────────────────────────────────────────────────

const stmtInsert = db.prepare(`
  INSERT INTO signals
    (id, timestamp, par, modo, señal, entrada, stopLoss, takeProfit,
     confianza, duracion_estimada, riskUSDT, resultado, pnl, closedAt)
  VALUES
    (@id, @timestamp, @par, @modo, @señal, @entrada, @stopLoss, @takeProfit,
     @confianza, @duracion_estimada, @riskUSDT, NULL, NULL, NULL)
`);

const stmtClose = db.prepare(`
  UPDATE signals
  SET resultado = @resultado, pnl = @pnl, closedAt = @closedAt
  WHERE id = @id
`);

const stmtOpenByPar = db.prepare(`
  SELECT * FROM signals
  WHERE par = ? AND resultado IS NULL
    AND entrada IS NOT NULL AND stopLoss IS NOT NULL AND takeProfit IS NOT NULL
  ORDER BY timestamp DESC
`);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a new AI signal.  Returns the generated UUID.
 */
function insertSignal({
  par, modo, señal, entrada, stopLoss, takeProfit,
  confianza, duracion_estimada, riskUSDT = 10,
}) {
  const id = uuidv4();
  stmtInsert.run({
    id,
    timestamp: Date.now(),
    par,
    modo:              modo              ?? null,
    señal:             señal             ?? null,
    entrada:           entrada           ?? null,
    stopLoss:          stopLoss          ?? null,
    takeProfit:        takeProfit        ?? null,
    confianza:         confianza         ?? null,
    duracion_estimada: duracion_estimada ?? null,
    riskUSDT,
  });
  return id;
}

/**
 * Mark a signal as closed with result and PnL.
 */
function closeSignal(id, resultado, pnl) {
  stmtClose.run({ id, resultado, pnl: +pnl.toFixed(4), closedAt: Date.now() });
}

/**
 * Get all open signals for a pair (not yet closed).
 */
function getOpenSignals(par) {
  return stmtOpenByPar.all(par);
}

/**
 * Check if any open signals for `par` hit SL or TP given the latest candle.
 * Uses candle.high and candle.low for realistic hit detection.
 * Returns an array of closed signal objects (with resultado/pnl set).
 */
function checkAndCloseSignals(par, candle) {
  const open   = getOpenSignals(par);
  const closed = [];

  for (const sig of open) {
    let resultado  = null;
    let exitPrice  = null;

    if (sig.señal === 'compra') {
      // Check SL before TP (conservative — loss takes priority)
      if (candle.low  <= sig.stopLoss)  { resultado = 'loss'; exitPrice = sig.stopLoss;  }
      else if (candle.high >= sig.takeProfit) { resultado = 'win';  exitPrice = sig.takeProfit; }
    } else if (sig.señal === 'venta') {
      if (candle.high >= sig.stopLoss)  { resultado = 'loss'; exitPrice = sig.stopLoss;  }
      else if (candle.low  <= sig.takeProfit) { resultado = 'win';  exitPrice = sig.takeProfit; }
    }

    if (!resultado) continue;

    // PnL: riskUSDT × R/R on win, −riskUSDT on loss
    const riskDist  = Math.abs(sig.entrada - sig.stopLoss)  || 1;
    const rewardDist = Math.abs(sig.takeProfit - sig.entrada) || 0;
    const rr    = rewardDist / riskDist;
    const pnl   = resultado === 'win' ? sig.riskUSDT * rr : -sig.riskUSDT;

    closeSignal(sig.id, resultado, pnl);
    closed.push({ ...sig, resultado, pnl: +pnl.toFixed(4), exitPrice, closedAt: Date.now() });
  }

  return closed;
}

/**
 * Return paginated signal history, optionally filtered by par.
 */
function getHistory(par, limit = 50) {
  if (par) {
    return db.prepare(
      'SELECT * FROM signals WHERE par = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(par, limit);
  }
  return db.prepare(
    'SELECT * FROM signals ORDER BY timestamp DESC LIMIT ?'
  ).all(limit);
}

/**
 * Aggregate stats for a pair (or all pairs).
 */
function getStats(par) {
  const rows = par
    ? db.prepare('SELECT resultado, pnl FROM signals WHERE par = ?').all(par)
    : db.prepare('SELECT resultado, pnl FROM signals').all();

  const total  = rows.length;
  const closed = rows.filter((r) => r.resultado !== null);
  const wins   = closed.filter((r) => r.resultado === 'win').length;
  const pnls   = closed.map((r) => r.pnl ?? 0);
  const totalPnl  = pnls.reduce((s, v) => s + v, 0);
  const bestTrade  = pnls.length ? Math.max(...pnls) : 0;
  const worstTrade = pnls.length ? Math.min(...pnls) : 0;
  const openCount  = rows.filter((r) => r.resultado === null).length;

  return {
    total,
    closed:     closed.length,
    open:       openCount,
    winRate:    closed.length ? wins / closed.length : 0,
    totalPnl:   +totalPnl.toFixed(4),
    bestTrade:  +bestTrade.toFixed(4),
    worstTrade: +worstTrade.toFixed(4),
  };
}

/**
 * Stats for signals closed TODAY (since midnight local time).
 * Used for daily loss limit and max-trades-per-day checks.
 */
function getTodayStats(par) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();

  const rows = par
    ? db.prepare(
        'SELECT pnl FROM signals WHERE par = ? AND resultado IS NOT NULL AND closedAt >= ?'
      ).all(par, startMs)
    : db.prepare(
        'SELECT pnl FROM signals WHERE resultado IS NOT NULL AND closedAt >= ?'
      ).all(startMs);

  // Also count open signals created today (for maxTradesPerDay)
  const openToday = par
    ? db.prepare(
        'SELECT COUNT(*) as cnt FROM signals WHERE par = ? AND timestamp >= ?'
      ).get(par, startMs).cnt
    : db.prepare(
        'SELECT COUNT(*) as cnt FROM signals WHERE timestamp >= ?'
      ).get(startMs).cnt;

  const pnl   = rows.reduce((sum, r) => sum + (r.pnl ?? 0), 0);
  const count = openToday; // total signals created today (open + closed)

  return { pnl: +pnl.toFixed(4), count };
}

module.exports = { insertSignal, closeSignal, getOpenSignals, checkAndCloseSignals, getHistory, getStats, getTodayStats };
