export default function TradeLog({ trades = [] }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">Trade Log</h2>
      {trades.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-8">No trades yet</p>
      ) : (
        <div className="overflow-y-auto max-h-64 space-y-2">
          {trades.map((t) => (
            <div key={t.id} className="flex items-start gap-2 text-xs bg-brand-dark rounded p-2">
              <span className={`font-bold uppercase px-1.5 py-0.5 rounded text-white ${t.action === 'buy' ? 'bg-brand-green' : 'bg-brand-red'}`}>
                {t.action}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <span className="text-brand-blue font-semibold">{t.symbol}</span>
                  <span className="text-gray-500">{new Date(t.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-gray-400 truncate mt-0.5">{t.reason}</div>
              </div>
              <span className="font-mono text-gray-200 whitespace-nowrap">${t.price?.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
