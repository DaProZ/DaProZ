// Inline EMA computation (no extra deps needed)
function calcEMA(prices, period) {
  if (!prices.length) return [];
  const k = 2 / (period + 1);
  const result = [];
  let ema = prices[0];
  for (const p of prices) {
    ema = p * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

// Timeframes highlighted per mode
const MODE_TF = {
  SCALPING:    ['5m', '15m'],
  INTRADAY:    ['15m', '1h'],
  SWING_CORTO: ['1h', '4h'],
  SWING_LARGO: ['4h', '1d'],
  NEUTRAL:     [],
};

const TF_LABELS = {
  '5m': '5 min',
  '15m': '15 min',
  '1h': '1 hora',
  '4h': '4 horas',
  '1d': '1 día',
};

// ─── Pure-SVG mini candlestick chart ─────────────────────────────────────────

function MiniCandleChart({ candles = [], highlight = false }) {
  const SLICE  = 60;
  const W      = 300;
  const H      = 96;
  const VOL_H  = 14;          // volume band height at bottom
  const PRICE_H = H - VOL_H;

  if (!candles.length) {
    return (
      <div className="flex items-center justify-center" style={{ height: H }}>
        <span className="text-xs text-gray-600">Sin datos</span>
      </div>
    );
  }

  const data    = candles.slice(-SLICE);
  const closes  = data.map((c) => c.close);
  const ema9    = calcEMA(closes, 9);
  const ema21   = calcEMA(closes, 21);

  const maxP   = Math.max(...data.map((c) => c.high));
  const minP   = Math.min(...data.map((c) => c.low));
  const pRange = maxP - minP || 1;

  const maxVol = Math.max(...data.map((c) => c.volume), 1);
  const cw     = W / data.length;

  // price → y coordinate (within the top PRICE_H pixels, with 3px padding)
  const toY = (price) => 3 + ((maxP - price) / pRange) * (PRICE_H - 6);

  const ema9pts  = ema9.map((v, i) => `${i * cw + cw / 2},${toY(v)}`).join(' ');
  const ema21pts = ema21.map((v, i) => `${i * cw + cw / 2},${toY(v)}`).join(' ');

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      {data.map((c, i) => {
        const x      = i * cw;
        const isUp   = c.close >= c.open;
        const col    = isUp ? '#3fb950' : '#f85149';
        const bTop   = toY(Math.max(c.open, c.close));
        const bBot   = toY(Math.min(c.open, c.close));
        const bH     = Math.max(bBot - bTop, 1);
        const mx     = x + cw / 2;
        const volH   = (c.volume / maxVol) * VOL_H;

        return (
          <g key={i}>
            {/* Wick */}
            <line
              x1={mx} x2={mx}
              y1={toY(c.high)} y2={toY(c.low)}
              stroke={col} strokeWidth={0.7}
            />
            {/* Body */}
            <rect
              x={x + 0.5} y={bTop}
              width={Math.max(cw - 1, 0.5)} height={bH}
              fill={col} fillOpacity={0.85}
            />
            {/* Volume bar */}
            <rect
              x={x + 0.5} y={H - volH}
              width={Math.max(cw - 1, 0.5)} height={volH}
              fill={col} fillOpacity={0.2}
            />
          </g>
        );
      })}

      {/* EMA9 — amber */}
      <polyline points={ema9pts}  fill="none" stroke="#f59e0b" strokeWidth={1}   opacity={0.85} />
      {/* EMA21 — sky */}
      <polyline points={ema21pts} fill="none" stroke="#38bdf8" strokeWidth={1}   opacity={0.85} />

      {/* Grid line between candles and volume */}
      <line x1="0" x2={W} y1={PRICE_H} y2={PRICE_H} stroke="#21262d" strokeWidth={0.5} />
    </svg>
  );
}

// ─── Single mini chart card ───────────────────────────────────────────────────

function ChartCard({ tf, candles = [], highlight }) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const pct  = last && prev && prev.close
    ? ((last.close - prev.close) / prev.close) * 100
    : null;

  const isUp = pct == null ? null : pct >= 0;

  return (
    <div
      className="rounded-md overflow-hidden transition-all duration-500"
      style={{
        border: highlight ? '1px solid rgba(88,166,255,0.4)' : '1px solid #21262d',
        background: highlight ? 'rgba(88,166,255,0.03)' : '#0a0d12',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5"
        style={{ borderBottom: '1px solid #21262d' }}
      >
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: highlight ? '#58a6ff' : '#6b7280' }}
        >
          {TF_LABELS[tf] ?? tf}
          {highlight && (
            <span className="ml-1 opacity-40" style={{ color: '#58a6ff' }}>●</span>
          )}
        </span>

        {last ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-300 tabular-nums">
              {last.close.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: last.close > 100 ? 2 : 4,
              })}
            </span>
            {pct !== null && (
              <span
                className="text-xs font-mono tabular-nums"
                style={{ color: isUp ? '#3fb950' : '#f85149' }}
              >
                {isUp ? '+' : ''}{pct.toFixed(2)}%
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </div>

      {/* Chart */}
      <div className="p-1">
        <MiniCandleChart candles={candles} highlight={highlight} />
      </div>

      {/* EMA legend */}
      <div
        className="flex items-center gap-3 px-2.5 pb-1.5 pt-0.5"
        style={{ borderTop: '1px solid #21262d' }}
      >
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <span className="inline-block w-3 border-t border-yellow-400" />
          EMA9
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <span className="inline-block w-3 border-t border-sky-400" />
          EMA21
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MultiChart({ multiCandles = {}, activeMode }) {
  const relevantTFs = MODE_TF[activeMode] ?? [];

  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400 tracking-wide">
          Multi-Timeframe
          {activeMode && (
            <span className="ml-2 text-xs text-gray-600 font-normal">
              · modo <span className="text-brand-blue">{activeMode}</span>
            </span>
          )}
        </h2>
        <span className="text-xs text-gray-600">
          {relevantTFs.length > 0 && (
            <>
              <span className="text-brand-blue">●</span>
              <span className="ml-1">timeframes activos</span>
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {['5m', '15m', '4h', '1d'].map((tf) => (
          <ChartCard
            key={tf}
            tf={tf}
            candles={multiCandles[tf] ?? []}
            highlight={relevantTFs.includes(tf)}
          />
        ))}
      </div>
    </div>
  );
}
