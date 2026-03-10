function Row({ label, value, color }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-brand-border last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-mono font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function rsiColor(v) {
  if (!v) return 'text-gray-400';
  if (v < 30) return 'text-brand-green';
  if (v > 70) return 'text-brand-red';
  return 'text-gray-200';
}

function macdHistColor(v) {
  if (v == null) return 'text-gray-400';
  return v >= 0 ? 'text-brand-green' : 'text-brand-red';
}

export default function IndicatorsPanel({ indicators }) {
  if (!indicators) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3 tracking-wide">Indicadores</h2>
        <p className="text-xs text-gray-600 text-center py-8">Esperando datos…</p>
      </div>
    );
  }

  const { rsi, macd, bollinger, ema, atr, price, volume } = indicators;
  const f = (n, d = 2) => (n != null ? Number(n).toFixed(d) : '—');

  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3 tracking-wide">Indicadores</h2>

      {/* Price */}
      <Row label="Precio"       value={f(price, 4)}              color="text-brand-blue" />

      {/* EMAs */}
      <div className="mt-1 mb-0.5 text-xs text-gray-600 uppercase tracking-widest">EMA</div>
      <Row label="EMA 9"        value={f(ema?.ema9,   4)}        color="text-brand-scalping" />
      <Row label="EMA 21"       value={f(ema?.ema21,  4)}        color="text-brand-intraday" />
      <Row label="EMA 50"       value={f(ema?.ema50,  4)}        color="text-brand-yellow" />
      <Row label="EMA 200"      value={f(ema?.ema200, 4)}        color="text-gray-400" />

      {/* RSI */}
      <div className="mt-1 mb-0.5 text-xs text-gray-600 uppercase tracking-widest">RSI</div>
      <Row label="RSI (14)"     value={f(rsi?.value, 1)}         color={rsiColor(rsi?.value)} />

      {/* MACD */}
      <div className="mt-1 mb-0.5 text-xs text-gray-600 uppercase tracking-widest">MACD</div>
      <Row label="MACD"         value={f(macd?.value,     4)}    color="text-gray-200" />
      <Row label="Señal"        value={f(macd?.signal,    4)}    color="text-gray-400" />
      <Row label="Histograma"   value={f(macd?.histogram, 4)}    color={macdHistColor(macd?.histogram)} />

      {/* Bollinger */}
      <div className="mt-1 mb-0.5 text-xs text-gray-600 uppercase tracking-widest">Bollinger</div>
      <Row label="Superior"     value={f(bollinger?.upper,  2)}  color="text-brand-red" />
      <Row label="Medio"        value={f(bollinger?.middle, 2)}  color="text-gray-300" />
      <Row label="Inferior"     value={f(bollinger?.lower,  2)}  color="text-brand-green" />
      <Row label="%B"           value={f(bollinger?.pctB,   3)}  color="text-gray-400" />

      {/* Volatility / Volume */}
      <div className="mt-1 mb-0.5 text-xs text-gray-600 uppercase tracking-widest">Vol / ATR</div>
      <Row label="ATR (14)"     value={f(atr, 4)}                color="text-gray-400" />
      <Row label="Vol SMA20"    value={f(volume?.sma20, 2)}      color="text-gray-400" />
      <Row label="Vol ratio"    value={f(volume?.ratio, 3)}      color={
        volume?.ratio > 1.5 ? 'text-brand-yellow' : 'text-gray-400'
      } />
    </div>
  );
}
