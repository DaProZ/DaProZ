const STRATEGIES = ['RSI_MACD', 'BOLLINGER', 'EMA_CROSS', 'COMBINED'];
const SYMBOLS    = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];

const sel = 'bg-brand-dark border border-brand-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-brand-blue disabled:opacity-40 transition-colors';

export default function BotControls({
  symbol, strategy, running,
  onSymbolChange, onStrategyChange,
  onStart, onStop, onAnalyze, onMultiAnalyze,
}) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-lg px-4 py-3 flex flex-wrap items-center gap-2">
      <select value={symbol}   onChange={(e) => onSymbolChange(e.target.value)}   disabled={running} className={sel}>
        {SYMBOLS.map((s)    => <option key={s}>{s}</option>)}
      </select>
      <select value={strategy} onChange={(e) => onStrategyChange(e.target.value)} disabled={running} className={sel}>
        {STRATEGIES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <div className="flex-1" />
      <button onClick={onMultiAnalyze}
        className="text-xs font-semibold px-3 py-1.5 rounded border transition-colors bg-brand-swingLargo/10 text-brand-swingLargo border-brand-swingLargo/30 hover:bg-brand-swingLargo/20">
        Multi Análisis
      </button>
      <button onClick={onAnalyze}
        className="text-xs font-semibold px-3 py-1.5 rounded border transition-colors bg-brand-blue/10 text-brand-blue border-brand-blue/30 hover:bg-brand-blue/20">
        Analyze 1h
      </button>
      {!running ? (
        <button onClick={onStart}
          className="text-xs font-semibold px-4 py-1.5 rounded transition-colors bg-brand-green/90 hover:bg-brand-green text-white">
          ▶ Start Bot
        </button>
      ) : (
        <button onClick={onStop}
          className="text-xs font-semibold px-4 py-1.5 rounded transition-colors bg-brand-red/90 hover:bg-brand-red text-white">
          ■ Stop Bot
        </button>
      )}
    </div>
  );
}
