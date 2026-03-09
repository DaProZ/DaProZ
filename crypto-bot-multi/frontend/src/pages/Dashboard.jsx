import { useState } from 'react';
import BotControls from '../components/BotControls';
import StatsCards from '../components/StatsCards';
import CandleChart from '../components/CandleChart';
import IndicatorsPanel from '../components/IndicatorsPanel';
import TradeLog from '../components/TradeLog';
import ClaudePanel from '../components/ClaudePanel';

export default function Dashboard({ connected, state, indicators, trades, signal, claudeAnalysis, candles, send }) {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [strategy, setStrategy] = useState('RSI_MACD');

  function handleStart() {
    send('start', { symbol, strategy });
    send('getCandles', { symbol, interval: '1h', limit: 100 });
  }

  function handleStop() {
    send('stop');
  }

  function handleAnalyze() {
    send('analyzeWithClaude', { symbol, candles });
  }

  return (
    <div className="min-h-screen bg-brand-dark text-gray-200 p-4">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-brand-blue">Crypto Bot Multi</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${connected ? 'bg-brand-green/20 text-brand-green' : 'bg-brand-red/20 text-brand-red'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {state && (
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${state.running ? 'bg-brand-green/20 text-brand-green' : 'bg-gray-700 text-gray-400'}`}>
            {state.running ? 'Running' : 'Stopped'}
          </span>
        )}
      </header>

      {/* Controls */}
      <BotControls
        symbol={symbol}
        strategy={strategy}
        running={state?.running}
        onSymbolChange={setSymbol}
        onStrategyChange={setStrategy}
        onStart={handleStart}
        onStop={handleStop}
        onAnalyze={handleAnalyze}
      />

      {/* Stats */}
      <StatsCards stats={state?.stats} signal={signal} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <CandleChart candles={candles} symbol={symbol} />
        </div>
        <div>
          <IndicatorsPanel indicators={indicators} />
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <TradeLog trades={trades} />
        <ClaudePanel analysis={claudeAnalysis} />
      </div>
    </div>
  );
}
