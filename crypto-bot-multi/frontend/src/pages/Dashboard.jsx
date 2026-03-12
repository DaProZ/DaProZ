import { useState } from 'react';
import BotControls     from '../components/BotControls';
import StatsCards      from '../components/StatsCards';
import CandleChart     from '../components/CandleChart';
import IndicatorsPanel from '../components/IndicatorsPanel';
import TradeLog        from '../components/TradeLog';
import ClaudePanel     from '../components/ClaudePanel';
import ModeSelector    from '../components/ModeSelector';
import MultiChart      from '../components/MultiChart';
import SignalPanel     from '../components/SignalPanel';
import RiskPanel       from '../components/RiskPanel';

export default function Dashboard({
  connected, state, indicators, trades, signal, claudeAnalysis, candles, send,
  modeResult, multiCandles, claudeHistory = [], signalRefresh,
  dbStats, onTogglePaperTrading, onTradeSizeChange, onRiskConfigChange,
}) {
  const [symbol,        setSymbol]        = useState('BTCUSDT');
  const [strategy,      setStrategy]      = useState('RSI_MACD');
  const [loadingMulti,  setLoadingMulti]  = useState(false);
  const [loadingAnalyze,setLoadingAnalyze]= useState(false);

  async function handleStart() {
    send('start',        { symbol, strategy });
    send('getCandles',   { symbol, interval: '1h', limit: 100 });
    setLoadingMulti(true);
    send('getMultiData', { symbol });
    setTimeout(() => setLoadingMulti(false), 4000);
  }
  function handleStop() { send('stop'); }

  function handleAnalyze() {
    setLoadingAnalyze(true);
    send('analyzeWithClaude', { symbol, candles });
    setTimeout(() => setLoadingAnalyze(false), 5000);
  }

  function handleMultiAnalyze() {
    setLoadingMulti(true);
    send('getMultiData', { symbol });
    setTimeout(() => setLoadingMulti(false), 5000);
  }

  const candles1h  = multiCandles?.['1h'] ?? candles;
  const isPaper    = state?.paperTrading !== false; // default true
  const tradeSize  = state?.tradeSize ?? 100;
  const riskConfig = state?.riskConfig ?? null;

  return (
    <div className="min-h-screen bg-brand-dark text-gray-200 p-3 lg:p-4 space-y-3">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black tracking-wider text-brand-blue uppercase">
            DaProZ · Trading Terminal
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${connected
            ? 'bg-brand-green/10 text-brand-green border-brand-green/30'
            : 'bg-brand-red/10 text-brand-red border-brand-red/40'}`}>
            {connected ? '● WS' : '○ OFF'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Paper trading toggle */}
          <button
            onClick={() => onTogglePaperTrading?.(!isPaper)}
            title={isPaper ? 'Modo PAPER: click para activar trading real' : 'Modo REAL: click para volver a paper'}
            className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${
              isPaper
                ? 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/40 hover:bg-brand-yellow/20'
                : 'bg-brand-red/10 text-brand-red border-brand-red/40 hover:bg-brand-red/20'
            }`}
          >
            {isPaper ? '📄 PAPER' : '⚡ REAL'}
          </button>
          {state && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${state.running
              ? 'bg-brand-green/10 text-brand-green border-brand-green/30'
              : 'bg-brand-border/40 text-gray-500 border-brand-border'}`}>
              {state.running ? '▶ RUNNING' : '■ STOPPED'}
            </span>
          )}
        </div>
      </header>

      {/* Controls */}
      <BotControls
        symbol={symbol} strategy={strategy} running={state?.running}
        tradeSize={tradeSize}
        onSymbolChange={setSymbol} onStrategyChange={setStrategy}
        onStart={handleStart} onStop={handleStop}
        onAnalyze={handleAnalyze} onMultiAnalyze={handleMultiAnalyze}
        onTradeSizeChange={onTradeSizeChange}
        loadingMulti={loadingMulti} loadingAnalyze={loadingAnalyze}
      />

      {/* Mode badge + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <ModeSelector modeResult={modeResult} />
        </div>
        <div className="lg:col-span-3">
          <StatsCards dbStats={dbStats} signal={signal} />
        </div>
      </div>

      {/* Multi-timeframe candlestick charts */}
      <MultiChart multiCandles={multiCandles} activeMode={modeResult?.mode} />

      {/* Claude signal + indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SignalPanel history={claudeHistory} candles1h={candles1h} isPaper={isPaper} />
        <IndicatorsPanel indicators={indicators} />
      </div>

      {/* Risk Manager */}
      <RiskPanel
        riskConfig={riskConfig}
        onRiskConfigChange={onRiskConfigChange}
        pair={symbol}
        refreshTrigger={signalRefresh}
      />

      {/* Price chart */}
      <CandleChart candles={candles} symbol={symbol} />

      {/* Signal history — paper or real, clearly labeled */}
      <TradeLog pair={symbol} refreshTrigger={signalRefresh} isPaper={isPaper} />

      {/* Legacy Claude panel (fallback for single-TF analysis when no multi yet) */}
      {claudeAnalysis && claudeHistory.length === 0 && <ClaudePanel analysis={claudeAnalysis} />}
    </div>
  );
}
