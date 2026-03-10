const MODE_CFG = {
  SCALPING: {
    label: 'SCALPING',
    sub: 'Alta volatilidad',
    desc: 'Opera en 5m–15m con SL ajustado y TP rápido',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.35)',
    glow: '0 0 28px rgba(245,158,11,0.18)',
  },
  INTRADAY: {
    label: 'INTRADAY',
    sub: 'Momentum intradía',
    desc: 'RSI extremo en 1h · Marcos 1h–4h',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.08)',
    border: 'rgba(56,189,248,0.35)',
    glow: '0 0 28px rgba(56,189,248,0.18)',
  },
  SWING_CORTO: {
    label: 'SWING CORTO',
    sub: 'Cruce EMA en 1h',
    desc: 'EMA50/200 en 1h sin confirmar en marcos altos',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.35)',
    glow: '0 0 28px rgba(167,139,250,0.18)',
  },
  SWING_LARGO: {
    label: 'SWING LARGO',
    sub: 'Tendencia confirmada',
    desc: 'EMA50 × EMA200 en 4h y 1d confirmado',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.35)',
    glow: '0 0 28px rgba(52,211,153,0.18)',
  },
  NEUTRAL: {
    label: 'NEUTRAL',
    sub: 'Mercado lateral',
    desc: 'Bollinger estrecho en 1h y 4h · Sin tendencia',
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.05)',
    border: 'rgba(107,114,128,0.25)',
    glow: 'none',
  },
};

const MODE_ORDER = ['SCALPING', 'INTRADAY', 'SWING_CORTO', 'SWING_LARGO', 'NEUTRAL'];

function ConfidenceRing({ value, color }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative flex-shrink-0 w-16 h-16 flex items-center justify-center">
      <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#21262d" strokeWidth="4" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${circ * value} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums" style={{ color }}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function ScoreBar({ modeKey, score, maxScore, isActive }) {
  const cfg = MODE_CFG[modeKey] ?? MODE_CFG.NEUTRAL;
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="font-mono leading-none"
        style={{ fontSize: '8px', color: isActive ? cfg.color : '#374151' }}
      >
        {modeKey.replace('_', '\u00A0')}
      </span>
      <div className="w-full h-1 bg-brand-dark rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: isActive ? cfg.color : '#374151',
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <span
        className="font-mono leading-none"
        style={{ fontSize: '8px', color: isActive ? cfg.color : '#4b5563' }}
      >
        {score}
      </span>
    </div>
  );
}

export default function ModeSelector({ modeResult }) {
  if (!modeResult) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-lg p-5 flex items-center justify-center min-h-[148px]">
        <p className="text-xs text-gray-600 tracking-widest uppercase">Analizando mercado…</p>
      </div>
    );
  }

  const { mode, confidence, scores = {}, reasons = [] } = modeResult;
  const cfg = MODE_CFG[mode] ?? MODE_CFG.NEUTRAL;
  const maxScore = Math.max(...Object.values(scores), 1);

  return (
    <div
      className="rounded-lg p-4 transition-all duration-500"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: cfg.glow }}
    >
      {/* Top row: label + ring */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xl font-black tracking-widest uppercase leading-none"
              style={{ color: cfg.color }}
            >
              {cfg.label}
            </span>
            <span className="text-xs text-gray-500 bg-brand-dark border border-brand-border px-1.5 py-0.5 rounded-full">
              {cfg.sub}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-snug">{cfg.desc}</p>
        </div>
        <ConfidenceRing value={confidence} color={cfg.color} />
      </div>

      {/* Confidence bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">Confianza</span>
          <span className="font-semibold tabular-nums" style={{ color: cfg.color }}>
            {(confidence * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 bg-brand-dark rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${confidence * 100}%`,
              background: `linear-gradient(90deg, ${cfg.color}66, ${cfg.color})`,
              transition: 'width 0.8s ease',
            }}
          />
        </div>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {MODE_ORDER.map((m) => (
          <ScoreBar
            key={m}
            modeKey={m}
            score={scores[m] ?? 0}
            maxScore={maxScore}
            isActive={m === mode}
          />
        ))}
      </div>

      {/* Reasons */}
      {reasons.length > 0 && (
        <div className="space-y-1 border-t border-brand-border pt-2">
          {reasons.slice(0, 3).map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-gray-400 leading-snug">
              <span className="flex-shrink-0 mt-px" style={{ color: cfg.color }}>›</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
