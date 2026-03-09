function Row({ label, value, color }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-brand-border last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function rsiColor(v) {
  if (!v) return 'text-gray-400';
  if (v < 30) return 'text-brand-green';
  if (v > 70) return 'text-brand-red';
  return 'text-gray-200';
}

export default function IndicatorsPanel({ indicators }) {
  if (!indicators) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Indicators</h2>
        <p className="text-gray-600 text-sm text-center py-8">Waiting for data...</p>
      </div>
    );
  }

  const { rsi, macd, bollinger, ema, atr, price } = indicators;
  const f = (n, d = 2) => (n != null ? n.toFixed(d) : '—');

  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">Indicators</h2>
      <Row label="Price" value={f(price, 4)} color="text-brand-blue" />
      <Row label="RSI (14)" value={f(rsi?.value, 1)} color={rsiColor(rsi?.value)} />
      <Row label="MACD" value={f(macd?.value, 4)} color="text-gray-200" />
      <Row label="MACD Signal" value={f(macd?.signal, 4)} color="text-gray-200" />
      <Row
        label="MACD Hist"
        value={f(macd?.histogram, 4)}
        color={macd?.histogram >= 0 ? 'text-brand-green' : 'text-brand-red'}
      />
      <Row label="BB Upper" value={f(bollinger?.upper, 2)} color="text-brand-red" />
      <Row label="BB Middle" value={f(bollinger?.middle, 2)} color="text-gray-200" />
      <Row label="BB Lower" value={f(bollinger?.lower, 2)} color="text-brand-green" />
      <Row label="EMA 20" value={f(ema?.ema20, 2)} color="text-brand-yellow" />
      <Row label="EMA 50" value={f(ema?.ema50, 2)} color="text-brand-yellow" />
      <Row label="ATR (14)" value={f(atr, 4)} color="text-gray-400" />
    </div>
  );
}
