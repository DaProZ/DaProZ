import { InfoIcon } from './Tooltip';

const STRATEGIES = ['RSI_MACD', 'BOLLINGER', 'EMA_CROSS', 'COMBINED'];
const SYMBOLS    = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];

const STRATEGY_INFO = {
  RSI_MACD:   'BUY cuando RSI < 40 y MACD cruza hacia arriba (oversold + momentum alcista). SELL cuando RSI > 60 y MACD cruza hacia abajo.',
  BOLLINGER:  'BUY cuando el precio toca la banda inferior de Bollinger (barato vs. promedio 20 velas). SELL en la banda superior.',
  EMA_CROSS:  'BUY cuando EMA21 supera EMA50 × 1.002 (tendencia alcista confirmada). SELL cuando cae por debajo × 0.998.',
  COMBINED:   'Solo da señal si RSI_MACD y BOLLINGER coinciden al mismo tiempo. Más conservador, menos señales pero más confiables.',
};

const sel = 'bg-brand-dark border border-brand-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-brand-blue disabled:opacity-40 transition-colors';

export default function BotControls({
  symbol, strategy, running,
  onSymbolChange, onStrategyChange,
  onStart, onStop, onAnalyze, onMultiAnalyze,
  loadingMulti = false, loadingAnalyze = false,
}) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-lg px-4 py-3 flex flex-wrap items-center gap-2">

      <div className="flex items-center gap-1.5">
        <select value={symbol} onChange={(e) => onSymbolChange(e.target.value)} disabled={running} className={sel}>
          {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <InfoIcon text="Par de trading a monitorear. No se puede cambiar con el bot activo." />
      </div>

      <div className="flex items-center gap-1.5">
        <select value={strategy} onChange={(e) => onStrategyChange(e.target.value)} disabled={running} className={sel}>
          {STRATEGIES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <InfoIcon text={STRATEGY_INFO[strategy] || 'Estrategia de señales de entrada/salida.'} />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <button
          onClick={onMultiAnalyze}
          disabled={loadingMulti}
          className="text-xs font-semibold px-3 py-1.5 rounded border transition-colors disabled:opacity-50 bg-brand-swingLargo/10 text-brand-swingLargo border-brand-swingLargo/30 hover:bg-brand-swingLargo/20"
        >
          {loadingMulti ? '⟳ Analizando…' : 'Multi Análisis'}
        </button>
        <InfoIcon text="Claude analiza los 5 timeframes (5m/15m/1h/4h/1d) y da una visión completa con entrada ideal, SL y TP sugeridos. Tarda ~3s." />
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onAnalyze}
          disabled={loadingAnalyze}
          className="text-xs font-semibold px-3 py-1.5 rounded border transition-colors disabled:opacity-50 bg-brand-blue/10 text-brand-blue border-brand-blue/30 hover:bg-brand-blue/20"
        >
          {loadingAnalyze ? '⟳ Analizando…' : 'Analyze 1h'}
        </button>
        <InfoIcon text="Análisis rápido de Claude sobre el gráfico de 1 hora. Útil para confirmar una señal puntual." />
      </div>

      <div className="flex items-center gap-1.5">
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
        <InfoIcon text={running
          ? 'Bot activo. Cada 60s: calcula indicadores → evalúa estrategia → si hay señal, Claude la confirma y la registra.'
          : 'Activa el loop de trading cada 60s. En PAPER registra señales virtuales de $100 y trackea si ganan o pierden.'
        } />
      </div>
    </div>
  );
}
