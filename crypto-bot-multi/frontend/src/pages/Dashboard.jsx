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

export default function Dashboard({
  connected, state, indicators, trades, signal, claudeAnalysis, candles, send,
  modeResult, multiCandles, claudeMulti, signalRefresh,
}) {
  const [symbol,   setSymbol]   = useState('BTCUSDT');
  const [strategy, setStrategy] = useState('RSI_MACD');

  function handleStart() {
    send('start',        { symbol, strategy });
    send('getCandles',   { symbol, interval: '1h', limit: 100 });
    send('getMultiData', { symbol });
  }
  function handleStop()          { send('stop'); }
  function handleAnalyze()       { send('analyzeWithClaude', { symbol, candles }); }
  function handleMultiAnalyze()  { send('getMultiData', { symbol }); }

  const candles1h = multiCandles?.['1h'] ?? candles;

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
            : 'bg-brand-red/10 text-brand-red border-brand-red/30'}`}>
            {connected ? '● WS' : '○ OFF'}
          </span>
        </div>
        {state && (
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${state.running
            ? 'bg-brand-green/10 text-brand-green border-brand-green/30'
            : 'bg-brand-border/40 text-gray-500 border-brand-border'}`}>
            {state.running ? '▶ RUNNING' : '■ STOPPED'}
          </span>
        )}
      </header>

      {/* Controls */}
      <BotControls
        symbol={symbol} strategy={strategy} running={state?.running}
        onSymbolChange={setSymbol} onStrategyChange={setStrategy}
        onStart={handleStart} onStop={handleStop}
        onAnalyze={handleAnalyze} onMultiAnalyze={handleMultiAnalyze}
      />

      {/* Mode badge + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <ModeSelector modeResult={modeResult} />
        </div>
        <div className="lg:col-span-3">
          <StatsCards stats={state?.stats} signal={signal} />
        </div>
      </div>

      {/* Multi-timeframe candlestick charts */}
      <MultiChart multiCandles={multiCandles} activeMode={modeResult?.mode} />

      {/* Claude signal + indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SignalPanel analysis={claudeMulti ?? claudeAnalysis} candles1h={candles1h} />
        <IndicatorsPanel indicators={indicators} />
      </div>

      {/* Price chart */}
      <CandleChart candles={candles} symbol={symbol} />

      {/* Signal history (full width — it has its own scroll) */}
      <TradeLog pair={symbol} refreshTrigger={signalRefresh} />

      {/* Legacy Claude panel (fallback when no multi-analysis yet) */}
      {claudeAnalysis && !claudeMulti && <ClaudePanel analysis={claudeAnalysis} />}
    </div>
  );
}
