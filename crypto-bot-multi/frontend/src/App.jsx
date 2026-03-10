import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import useWebSocket from './hooks/useWebSocket';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export default function App() {
  const { messages, send, connected } = useWebSocket(WS_URL);

  const [state,             setState]             = useState(null);
  const [indicators,        setIndicators]        = useState(null);
  const [trades,            setTrades]            = useState([]);
  const [signal,            setSignal]            = useState(null);
  const [claudeAnalysis,    setClaudeAnalysis]    = useState(null);
  const [candles,           setCandles]           = useState([]);
  // Multi-timeframe data
  const [modeResult,        setModeResult]        = useState(null);
  const [multiCandles,      setMultiCandles]      = useState({});
  const [claudeMulti,       setClaudeMulti]       = useState(null);
  // Signal DB: bump to trigger TradeLog refresh
  const [signalRefresh,     setSignalRefresh]     = useState(0);

  useEffect(() => {
    messages.forEach((msg) => {
      switch (msg.type) {
        case 'state':
          setState(msg.data);
          break;
        case 'indicators':
          setIndicators(msg.data);
          break;
        case 'trade':
          setTrades((prev) => [msg.data, ...prev].slice(0, 100));
          break;
        case 'signal':
          setSignal(msg.data);
          break;
        case 'claudeAnalysis':
          setClaudeAnalysis(msg.data);
          break;
        case 'candles':
          setCandles(msg.data);
          break;
        // Multi-timeframe
        case 'modeResult':
          setModeResult(msg.data);
          break;
        case 'multiCandles':
          setMultiCandles(msg.data);
          break;
        case 'claudeMultiAnalysis':
          setClaudeMulti(msg.data);
          break;
        // Signal DB events → trigger TradeLog re-fetch
        case 'signalLogged':
        case 'signalClosed':
          setSignalRefresh((n) => n + 1);
          break;
      }
    });
  }, [messages]);

  return (
    <Dashboard
      connected={connected}
      state={state}
      indicators={indicators}
      trades={trades}
      signal={signal}
      claudeAnalysis={claudeAnalysis}
      candles={candles}
      send={send}
      // Multi-timeframe
      modeResult={modeResult}
      multiCandles={multiCandles}
      claudeMulti={claudeMulti}
      // Signal DB
      signalRefresh={signalRefresh}
    />
  );
}
