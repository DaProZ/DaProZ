const STRATEGIES = ['RSI_MACD', 'BOLLINGER', 'EMA_CROSS', 'COMBINED'];
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];

export default function BotControls({ symbol, strategy, running, onSymbolChange, onStrategyChange, onStart, onStop, onAnalyze }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4 flex flex-wrap items-center gap-3">
      <select
        value={symbol}
        onChange={(e) => onSymbolChange(e.target.value)}
        disabled={running}
        className="bg-brand-dark border border-brand-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-brand-blue disabled:opacity-50"
      >
        {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
      </select>

      <select
        value={strategy}
        onChange={(e) => onStrategyChange(e.target.value)}
        disabled={running}
        className="bg-brand-dark border border-brand-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-brand-blue disabled:opacity-50"
      >
        {STRATEGIES.map((s) => <option key={s}>{s}</option>)}
      </select>

      {!running ? (
        <button
          onClick={onStart}
          className="bg-brand-green/90 hover:bg-brand-green text-white text-sm font-semibold px-4 py-1.5 rounded transition-colors"
        >
          Start Bot
        </button>
      ) : (
        <button
          onClick={onStop}
          className="bg-brand-red/90 hover:bg-brand-red text-white text-sm font-semibold px-4 py-1.5 rounded transition-colors"
        >
          Stop Bot
        </button>
      )}

      <button
        onClick={onAnalyze}
        className="bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue text-sm font-semibold px-4 py-1.5 rounded border border-brand-blue/40 transition-colors"
      >
        Analyze with Claude
      </button>
    </div>
  );
}
