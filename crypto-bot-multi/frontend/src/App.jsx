import { useEffect, useRef, useState } from 'react';
import Dashboard from './pages/Dashboard';
import useWebSocket from './hooks/useWebSocket';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export default function App() {
  const { messages, send, connected } = useWebSocket(WS_URL);
  const [state, setState] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [trades, setTrades] = useState([]);
  const [signal, setSignal] = useState(null);
  const [claudeAnalysis, setClaudeAnalysis] = useState(null);
  const [candles, setCandles] = useState([]);

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
    />
  );
}
