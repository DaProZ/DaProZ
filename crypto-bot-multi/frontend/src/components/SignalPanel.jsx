import {
  ComposedChart, Line, ReferenceLine, ReferenceArea,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { InfoIcon } from './Tooltip';

const SIGNAL_CFG = {
  compra: {
    label: 'COMPRA',
    icon: '↑',
    color: '#3fb950',
    bg: 'rgba(63,185,80,0.10)',
    border: 'rgba(63,185,80,0.40)',
    glow: '0 0 20px rgba(63,185,80,0.15)',
  },
  venta: {
    label: 'VENTA',
    icon: '↓',
    color: '#f85149',
    bg: 'rgba(248,81,73,0.10)',
    border: 'rgba(248,81,73,0.40)',
    glow: '0 0 20px rgba(248,81,73,0.15)',
  },
  neutro: {
    label: 'NEUTRO',
    icon: '→',
    color: '#8b949e',
    bg: 'rgba(139,148,158,0.06)',
    border: 'rgba(139,148,158,0.25)',
    glow: 'none',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcRR(señal, entry, sl, tp) {
  if (!entry || !sl || !tp) return null;
  const risk   = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk < 0.0001) return null;
  return reward / risk;
}

function fmtPrice(v) {
  if (v == null) return '—';
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: v > 100 ? 2 : 6,
  });
}

function rrColor(rr) {
  if (rr >= 2)   return '#3fb950';
  if (rr >= 1.5) return '#d29922';
  if (rr >= 1)   return '#f59e0b';
  return '#f85149';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LevelRow({ label, value, color, icon }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-brand-border last:border-0">
      <div className="flex items-center gap-1.5">
        {icon && <span style={{ color }} className="text-xs">{icon}</span>}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <span className="text-sm font-mono font-semibold tabular-nums" style={{ color }}>
        {fmtPrice(value)}
      </span>
    </div>
  );
}

function ConfidenceBar({ value, color }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">Confianza del análisis</span>
        <span className="font-semibold tabular-nums" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 bg-brand-dark rounded-full overflow-hidden relative">
        {/* Graduated tick marks */}
        {[25, 50, 75].map((t) => (
          <div
            key={t}
            className="absolute top-0 bottom-0 w-px bg-brand-border"
            style={{ left: `${t}%` }}
          />
        ))}
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}55, ${color})`,
            transition: 'width 0.8s ease',
          }}
        />
      </div>
    </div>
  );
}

// Custom tooltip for the price chart
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-brand-card border border-brand-border rounded px-2.5 py-1.5 text-xs">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="font-mono text-brand-blue">{fmtPrice(payload[0]?.value)}</p>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function SignalPanel({ analysis, candles1h = [], isPaper = true }) {
  if (!analysis) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-lg p-4 flex items-center justify-center min-h-[220px]">
        <p className="text-xs text-gray-600 tracking-widest uppercase">Esperando señal de Claude…</p>
      </div>
    );
  }

  const {
    señal = 'neutro',
    confianza = 0,
    timeframe_principal,
    entrada_ideal,
    stopLoss,
    takeProfit,
    duracion_estimada,
    resumen,
    puntos_clave = [],
    alertas = [],
    _cached,
    _ts,
    _source,
  } = analysis;

  const cfg = SIGNAL_CFG[señal] ?? SIGNAL_CFG.neutro;
  const rr  = calcRR(señal, entrada_ideal, stopLoss, takeProfit);

  // Chart data: last 50 1h candles
  const chartData = candles1h.slice(-50).map((c) => ({
    t:     new Date(c.time * 1000).toLocaleDateString('es', { month: 'numeric', day: 'numeric' }),
    close: c.close,
  }));

  // Y-axis domain that always includes SL/TP
  const prices = chartData.map((d) => d.close);
  const rawMin = Math.min(...prices, stopLoss ?? Infinity, entrada_ideal ?? Infinity);
  const rawMax = Math.max(...prices, takeProfit ?? -Infinity, entrada_ideal ?? -Infinity);
  const pad    = (rawMax - rawMin) * 0.08;
  const yMin   = isFinite(rawMin) ? rawMin - pad : 'auto';
  const yMax   = isFinite(rawMax) ? rawMax + pad : 'auto';

  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-gray-400 tracking-wide">Señal Claude AI</h2>
          <InfoIcon text="Análisis generado por claude-haiku. Combina indicadores técnicos de 5 timeframes para dar una recomendación con entrada, SL y TP sugeridos." />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          {_cached && (
            <span className="px-1.5 py-0.5 rounded border border-brand-border bg-brand-dark">
              CACHE
            </span>
          )}
          {_ts && <span>{new Date(_ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
      </div>

      {/* Paper / Real notice */}
      {isPaper ? (
        <div className="flex items-start gap-2 rounded px-2.5 py-2 text-xs leading-snug"
             style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.25)', color: '#8b949e' }}>
          <span style={{ color: '#eab308' }} className="flex-shrink-0">📄</span>
          <span>
            <span style={{ color: '#eab308' }} className="font-semibold">PAPER ($100/op) — </span>
            El bot simula <strong className="text-gray-300">$100 por señal</strong>, monitorea
            SL/TP en cada vela y registra WIN/LOSS automáticamente.
            <strong className="text-gray-300"> Sin dinero real.</strong>
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded px-2.5 py-2 text-xs leading-snug"
             style={{ background: 'rgba(248,81,73,0.07)', border: '1px solid rgba(248,81,73,0.35)', color: '#8b949e' }}>
          <span className="text-brand-red flex-shrink-0">⚡</span>
          <span>
            <span className="text-brand-red font-semibold">TRADING REAL — </span>
            El bot ejecuta <strong className="text-gray-300">market orders reales en Binance</strong>.
            SL/TP se monitorean en software (no son órdenes stop en Binance todavía).
          </span>
        </div>
      )}

      {/* Signal badge + levels */}
      <div className="grid grid-cols-5 gap-3">
        {/* Badge — spans 2 cols */}
        <div
          className="col-span-2 rounded-lg p-3 flex flex-col items-center justify-center gap-1.5"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: cfg.glow }}
        >
          <span className="text-4xl leading-none font-black" style={{ color: cfg.color }}>
            {cfg.icon}
          </span>
          <span className="text-base font-black tracking-widest" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          {timeframe_principal && (
            <span className="text-xs text-gray-500 bg-brand-dark border border-brand-border px-2 py-0.5 rounded-full">
              {timeframe_principal}
            </span>
          )}
          {duracion_estimada && (
            <span className="text-xs text-gray-500 text-center leading-tight">
              ⏱ {duracion_estimada}
            </span>
          )}
        </div>

        {/* Level rows — spans 3 cols */}
        <div className="col-span-3">
          <LevelRow label="Entrada"     value={entrada_ideal} color="#58a6ff" icon="→" />
          <LevelRow label="Stop Loss ⚑" value={stopLoss}      color="#f85149" icon="✕" />
          <LevelRow label="Take Profit ✦" value={takeProfit}  color="#3fb950" icon="✓" />
          {rr !== null && (
            <div className="flex items-center justify-between pt-1.5 mt-0.5 border-t border-brand-border">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Ratio R/R</span>
                <InfoIcon text="Relación riesgo/recompensa. 1:2 significa que ganás 2 por cada 1 que arriesgás. Idealmente >= 1.5. Rojo < 1, amarillo 1-2, verde >= 2." />
              </div>
              <span className="text-sm font-bold font-mono tabular-nums" style={{ color: rrColor(rr) }}>
                1:{rr.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      <ConfidenceBar value={confianza} color={cfg.color} />

      {/* Price chart with SL / Entry / TP lines */}
      {chartData.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-600">1h · últimas {chartData.length} velas</p>
            <div className="flex items-center gap-3 text-xs text-gray-600">
              {entrada_ideal && (
                <span className="flex items-center gap-1">
                  <span className="w-3 border-t-2 border-dashed border-brand-blue inline-block" />E
                </span>
              )}
              {takeProfit && (
                <span className="flex items-center gap-1">
                  <span className="w-3 border-t-2 border-dashed border-brand-green inline-block" />TP
                </span>
              )}
              {stopLoss && (
                <span className="flex items-center gap-1">
                  <span className="w-3 border-t-2 border-dashed border-brand-red inline-block" />SL
                </span>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <ComposedChart data={chartData} margin={{ top: 2, right: 40, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#21262d" />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 9, fill: '#4b5563' }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 9, fill: '#4b5563' }}
                width={60}
                tickFormatter={fmtPrice}
              />
              <Tooltip content={<ChartTooltip />} />

              {/* Shaded risk/reward area */}
              {stopLoss && takeProfit && (
                <ReferenceArea
                  y1={stopLoss}
                  y2={takeProfit}
                  fill={señal === 'compra' ? '#3fb950' : señal === 'venta' ? '#f85149' : '#8b949e'}
                  fillOpacity={0.04}
                />
              )}

              <Line
                type="monotone"
                dataKey="close"
                stroke="#58a6ff"
                dot={false}
                strokeWidth={1.5}
                name="Precio"
              />

              {/* Entry */}
              {entrada_ideal && (
                <ReferenceLine
                  y={entrada_ideal}
                  stroke="#58a6ff"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                  label={{ value: 'E', position: 'right', fill: '#58a6ff', fontSize: 10 }}
                />
              )}
              {/* Take Profit */}
              {takeProfit && (
                <ReferenceLine
                  y={takeProfit}
                  stroke="#3fb950"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: 'TP', position: 'right', fill: '#3fb950', fontSize: 10 }}
                />
              )}
              {/* Stop Loss */}
              {stopLoss && (
                <ReferenceLine
                  y={stopLoss}
                  stroke="#f85149"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: 'SL', position: 'right', fill: '#f85149', fontSize: 10 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary */}
      {resumen && (
        <p className="text-sm text-gray-300 leading-relaxed border-l-2 pl-3"
           style={{ borderColor: cfg.color + '88' }}>
          {resumen}
        </p>
      )}

      {/* Key points */}
      {puntos_clave.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
            Puntos clave
          </p>
          <ul className="space-y-1">
            {puntos_clave.map((p, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5 leading-snug">
                <span className="text-brand-blue mt-px flex-shrink-0">›</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alerts */}
      {alertas.length > 0 && (
        <div className="space-y-1.5">
          {alertas.map((a, i) => (
            <div
              key={i}
              className="text-xs flex items-start gap-1.5 rounded px-2.5 py-1.5 leading-snug"
              style={{
                background: 'rgba(210,153,34,0.08)',
                border: '1px solid rgba(210,153,34,0.30)',
                color: '#d29922',
              }}
            >
              <span className="flex-shrink-0">⚠</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {_source && (
        <p className="text-xs text-gray-600 text-right">
          via {_source}
        </p>
      )}
    </div>
  );
}
