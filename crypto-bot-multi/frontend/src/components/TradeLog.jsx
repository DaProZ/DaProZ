import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtPrice = (v) =>
  v == null ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: v > 100 ? 2 : 4 });

const fmtPnl = (v) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;

const fmtTime = (ms) =>
  new Date(ms).toLocaleString('es', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, color }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded bg-brand-dark border border-brand-border min-w-0">
      <span className="text-xs text-gray-600 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function ResultBadge({ resultado }) {
  if (!resultado) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded border border-brand-border text-gray-500 font-semibold">
        OPEN
      </span>
    );
  }
  const cfg = {
    win:       { label: 'WIN',   cls: 'bg-brand-green/15 text-brand-green border-brand-green/40' },
    loss:      { label: 'LOSS',  cls: 'bg-brand-red/15   text-brand-red   border-brand-red/40' },
    breakeven: { label: 'B/E',   cls: 'bg-brand-yellow/15 text-brand-yellow border-brand-yellow/40' },
  }[resultado] ?? { label: resultado.toUpperCase(), cls: 'text-gray-400 border-brand-border' };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function SignalBadge({ señal }) {
  const cfg = {
    compra: { label: '↑ COMPRA', cls: 'bg-brand-green/15 text-brand-green border-brand-green/30' },
    venta:  { label: '↓ VENTA',  cls: 'bg-brand-red/15   text-brand-red   border-brand-red/30'   },
    neutro: { label: '→ NEUTRO', cls: 'text-gray-500 border-brand-border' },
  }[señal] ?? { label: señal, cls: 'text-gray-400 border-brand-border' };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function ModeBadge({ modo }) {
  const colors = {
    SCALPING:    '#f59e0b',
    INTRADAY:    '#38bdf8',
    SWING_CORTO: '#a78bfa',
    SWING_LARGO: '#34d399',
    NEUTRAL:     '#6b7280',
  };
  const color = colors[modo] ?? '#6b7280';
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded border font-mono whitespace-nowrap"
      style={{ color, borderColor: color + '40', background: color + '12' }}
    >
      {(modo ?? '—').replace('_', ' ')}
    </span>
  );
}

function SignalRow({ sig }) {
  const isWin  = sig.resultado === 'win';
  const isLoss = sig.resultado === 'loss';
  const isOpen = !sig.resultado;

  const rr = sig.entrada && sig.stopLoss && sig.takeProfit
    ? (Math.abs(sig.takeProfit - sig.entrada) / Math.abs(sig.entrada - sig.stopLoss)).toFixed(2)
    : null;

  return (
    <div
      className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 px-3 py-2 rounded transition-colors hover:bg-brand-dark/60"
      style={{
        borderLeft: `3px solid ${isWin ? '#3fb950' : isLoss ? '#f85149' : isOpen ? '#58a6ff44' : '#374151'}`,
        background: isWin  ? 'rgba(63,185,80,0.03)'  :
                    isLoss ? 'rgba(248,81,73,0.03)' : 'transparent',
      }}
    >
      {/* Signal + mode */}
      <div className="flex flex-col gap-1">
        <SignalBadge señal={sig.señal} />
        <ModeBadge   modo={sig.modo} />
      </div>

      {/* Pair + levels */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-bold text-brand-blue">{sig.par}</span>
          <span className="text-xs text-gray-600">{fmtTime(sig.timestamp)}</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-mono">
          <span className="text-gray-400">E <span className="text-gray-200">{fmtPrice(sig.entrada)}</span></span>
          <span className="text-brand-red">SL <span>{fmtPrice(sig.stopLoss)}</span></span>
          <span className="text-brand-green">TP <span>{fmtPrice(sig.takeProfit)}</span></span>
          {rr && <span className="text-gray-500">R/R 1:{rr}</span>}
        </div>
      </div>

      {/* Confidence */}
      <div className="flex flex-col items-center gap-0.5 min-w-[36px]">
        <span className="text-xs text-gray-600">conf</span>
        <span className="text-xs font-semibold tabular-nums text-gray-300">
          {sig.confianza != null ? `${(sig.confianza * 100).toFixed(0)}%` : '—'}
        </span>
      </div>

      {/* Result badge */}
      <ResultBadge resultado={sig.resultado} />

      {/* PnL */}
      <span
        className="text-sm font-bold font-mono tabular-nums min-w-[52px] text-right"
        style={{ color: isWin ? '#3fb950' : isLoss ? '#f85149' : isOpen ? '#58a6ff' : '#6b7280' }}
      >
        {sig.pnl != null ? `${fmtPnl(sig.pnl)}$` : isOpen ? '…' : '—'}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TradeLog({ pair = 'BTCUSDT', refreshTrigger = 0, isPaper = true }) {
  const [signals, setSignals] = useState([]);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('all'); // all | open | win | loss

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [histRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/signals/history`, { params: { pair, limit: 100 } }),
        axios.get(`${API}/api/signals/stats`,   { params: { pair } }),
      ]);
      setSignals(histRes.data);
      setStats(statsRes.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [pair]);

  useEffect(() => { fetchData(); }, [fetchData, refreshTrigger]);

  const filtered = signals.filter((s) => {
    if (filter === 'open') return !s.resultado;
    if (filter === 'win')  return s.resultado === 'win';
    if (filter === 'loss') return s.resultado === 'loss';
    return true;
  });

  const pnlColor = !stats || stats.totalPnl === 0 ? 'text-gray-400'
    : stats.totalPnl > 0 ? 'text-brand-green' : 'text-brand-red';

  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-400 tracking-wide">
            {isPaper
              ? <span>📄 <span className="text-brand-yellow">Paper Trading</span> — Historial</span>
              : <span>⚡ <span className="text-brand-red">Real Trading</span> — Historial</span>
            }
          </h2>
          <span className="text-xs font-normal text-brand-blue">{pair}</span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs text-gray-600 hover:text-gray-300 transition-colors disabled:opacity-40"
          title="Actualizar"
        >
          {loading ? '⟳' : '↺'}
        </button>
      </div>

      {/* Stats pills */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          <StatPill
            label="Win Rate"
            value={`${(stats.winRate * 100).toFixed(1)}%`}
            color={stats.winRate >= 0.5 ? 'text-brand-green' : 'text-brand-red'}
          />
          <StatPill
            label="PnL Total"
            value={`${fmtPnl(stats.totalPnl)}$`}
            color={pnlColor}
          />
          <StatPill
            label="Mejor"
            value={`${fmtPnl(stats.bestTrade)}$`}
            color="text-brand-green"
          />
          <StatPill
            label="Peor"
            value={`${fmtPnl(stats.worstTrade)}$`}
            color="text-brand-red"
          />
          <StatPill
            label="Abiertas"
            value={stats.open}
            color={stats.open > 0 ? 'text-brand-blue' : 'text-gray-500'}
          />
          <StatPill
            label="Total"
            value={stats.total}
            color="text-gray-400"
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1">
        {['all', 'open', 'win', 'loss'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              filter === f
                ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue/30'
                : 'text-gray-600 hover:text-gray-300 border border-transparent'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'open' ? 'Abiertas' : f.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-600 self-center">
          {filtered.length} señales
        </span>
      </div>

      {/* Signal list */}
      {error ? (
        <p className="text-xs text-brand-red text-center py-4">Error: {error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-6">
          {loading ? 'Cargando…' : 'No hay señales aún. Ejecuta un análisis Multi.'}
        </p>
      ) : (
        <div className="overflow-y-auto max-h-[420px] space-y-0.5 pr-0.5">
          {filtered.map((sig) => (
            <SignalRow key={sig.id} sig={sig} />
          ))}
        </div>
      )}
    </div>
  );
}
