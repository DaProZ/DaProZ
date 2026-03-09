function Card({ label, value, color }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

export default function StatsCards({ stats, signal }) {
  const pnl = stats?.totalPnl ?? 0;
  const winRate = stats?.winRate ?? 0;
  const totalTrades = stats?.totalTrades ?? 0;

  const signalColor =
    signal?.action === 'buy' ? 'text-brand-green' :
    signal?.action === 'sell' ? 'text-brand-red' :
    'text-gray-400';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
      <Card
        label="Total P&L"
        value={`${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`}
        color={pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}
      />
      <Card
        label="Win Rate"
        value={`${(winRate * 100).toFixed(1)}%`}
        color="text-brand-blue"
      />
      <Card
        label="Total Trades"
        value={totalTrades}
        color="text-gray-200"
      />
      <Card
        label="Last Signal"
        value={signal ? `${signal.action.toUpperCase()} (${(signal.confidence * 100).toFixed(0)}%)` : '—'}
        color={signalColor}
      />
    </div>
  );
}
