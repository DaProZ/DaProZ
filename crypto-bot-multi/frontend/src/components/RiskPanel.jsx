import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { InfoIcon } from './Tooltip';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function ProgressBar({ value, max, color, blocked }) {
  if (max <= 0) return null;
  const pct    = Math.min(100, Math.round((Math.abs(value) / max) * 100));
  const danger = pct >= 80;
  const barColor = blocked ? '#f85149' : danger ? '#d29922' : color;
  return (
    <div className="h-1.5 bg-brand-dark rounded-full overflow-hidden relative mt-1">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: barColor }}
      />
    </div>
  );
}

function RiskInput({ label, value, unit, min, max, step, onCommit, tip }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);

  function commit() {
    const v = parseFloat(local);
    if (!isNaN(v) && v >= min) onCommit(v);
    else setLocal(String(value));
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 flex-1 flex items-center gap-1">
        {label}
        <InfoIcon text={tip} />
      </span>
      <div className="flex items-center bg-brand-dark border border-brand-border rounded overflow-hidden">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="bg-transparent text-xs text-gray-200 px-2 py-1 w-16 focus:outline-none tabular-nums text-right"
        />
        {unit && <span className="text-xs text-gray-500 px-1.5 border-l border-brand-border">{unit}</span>}
      </div>
    </div>
  );
}

export default function RiskPanel({ riskConfig, onRiskConfigChange, pair = 'BTCUSDT', refreshTrigger = 0 }) {
  const [todayStats, setTodayStats] = useState({ pnl: 0, count: 0 });

  const fetchToday = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/signals/today`, { params: { pair } });
      setTodayStats(res.data);
    } catch { /* ignore */ }
  }, [pair]);

  useEffect(() => { fetchToday(); }, [fetchToday, refreshTrigger]);

  const cfg = riskConfig ?? { dailyLossLimit: 300, maxTradesPerDay: 10, minConfidence: 0.60 };

  const lossBlocked   = cfg.dailyLossLimit   > 0 && todayStats.pnl   <= -cfg.dailyLossLimit;
  const tradesBlocked = cfg.maxTradesPerDay  > 0 && todayStats.count  >= cfg.maxTradesPerDay;
  const isBlocked     = lossBlocked || tradesBlocked;

  function update(key, value) {
    onRiskConfigChange?.({ [key]: value });
  }

  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-gray-400 tracking-wide">Risk Manager</h2>
          <InfoIcon text="Límites automáticos de riesgo. Si se alcanza un límite, el bot no genera nuevas señales hasta el día siguiente. Los cambios se aplican inmediatamente." />
        </div>
        {isBlocked && (
          <span className="text-xs px-2 py-0.5 rounded border font-bold"
                style={{ color: '#f85149', borderColor: '#f8514944', background: '#f8514910' }}>
            🚫 PAUSADO
          </span>
        )}
      </div>

      {/* Blocked banner */}
      {isBlocked && (
        <div className="rounded px-3 py-2 text-xs leading-snug"
             style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.35)', color: '#f85149' }}>
          {lossBlocked   && <p>🛑 Límite de pérdida diaria alcanzado ({todayStats.pnl.toFixed(2)} USDT de {-cfg.dailyLossLimit} USDT)</p>}
          {tradesBlocked && <p>🛑 Máximo de operaciones del día alcanzado ({todayStats.count} de {cfg.maxTradesPerDay})</p>}
        </div>
      )}

      {/* Config inputs */}
      <div className="space-y-2">
        <RiskInput
          label="Pérdida máx/día"
          value={cfg.dailyLossLimit}
          unit="$"
          min={0}
          max={100000}
          step={50}
          onCommit={(v) => update('dailyLossLimit', v)}
          tip="Si el PnL del día cae a −X USDT, el bot para de operar hasta mañana. Ponelo en 0 para desactivar."
        />
        {cfg.dailyLossLimit > 0 && (
          <div className="pl-0">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Hoy: {todayStats.pnl >= 0 ? '+' : ''}{todayStats.pnl.toFixed(2)} USDT</span>
              <span style={{ color: lossBlocked ? '#f85149' : '#6b7280' }}>
                límite: −{cfg.dailyLossLimit}$
              </span>
            </div>
            <ProgressBar value={-todayStats.pnl} max={cfg.dailyLossLimit} color="#f59e0b" blocked={lossBlocked} />
          </div>
        )}

        <RiskInput
          label="Máx operaciones/día"
          value={cfg.maxTradesPerDay}
          unit="ops"
          min={0}
          max={100}
          step={1}
          onCommit={(v) => update('maxTradesPerDay', v)}
          tip="Número máximo de señales en un día. Evita sobre-operar. Ponelo en 0 para desactivar."
        />
        {cfg.maxTradesPerDay > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Hoy: {todayStats.count} operaciones</span>
              <span style={{ color: tradesBlocked ? '#f85149' : '#6b7280' }}>
                límite: {cfg.maxTradesPerDay}
              </span>
            </div>
            <ProgressBar value={todayStats.count} max={cfg.maxTradesPerDay} color="#58a6ff" blocked={tradesBlocked} />
          </div>
        )}

        <RiskInput
          label="Confianza mínima"
          value={Math.round(cfg.minConfidence * 100)}
          unit="%"
          min={0}
          max={100}
          step={5}
          onCommit={(v) => update('minConfidence', v / 100)}
          tip="Claude solo genera señal si su confianza supera este %. 60% es el mínimo recomendado. Subilo a 75-80% para señales más selectivas."
        />
      </div>
    </div>
  );
}
