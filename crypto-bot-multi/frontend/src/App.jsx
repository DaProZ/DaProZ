import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Dashboard from './pages/Dashboard';
import useWebSocket from './hooks/useWebSocket';

const WS_URL  = import.meta.env.VITE_WS_URL  || 'ws://localhost:3001';
const API_URL = import.meta.env.VITE_API_URL  || 'http://localhost:3001';

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
  // History of last 5 Claude multi-analyses (newest first)
  const [claudeHistory,     setClaudeHistory]     = useState([]);
  // Signal DB: bump to trigger TradeLog refresh
  const [signalRefresh, setSignalRefresh] = useState(0);
  // Real P&L/WinRate from SQLite (accurate, shown in StatsCards)
  const [dbStats, setDbStats] = useState(null);

  const fetchDbStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/signals/stats`);
      setDbStats(res.data);
    } catch { /* ignore */ }
  }, []);

  // Generic settings patcher — merges partial settings object
  const patchSettings = useCallback(async (settings) => {
    try {
      await axios.patch(`${API_URL}/api/settings`, settings);
    } catch (e) {
      console.error('patchSettings failed:', e.message);
    }
  }, []);

  const togglePaperTrading = useCallback((enabled) => patchSettings({ paperTrading: enabled }), [patchSettings]);
  const setTradeSize        = useCallback((size)    => patchSettings({ tradeSize: Number(size) }), [patchSettings]);
  const setRiskConfig       = useCallback((cfg)     => patchSettings({ riskConfig: cfg }), [patchSettings]);

  useEffect(() => {
    messages.forEach((msg) => {
      switch (msg.type) {
        case 'state':               setState(msg.data);                              break;
        case 'indicators':          setIndicators(msg.data);                         break;
        case 'trade':               setTrades((p) => [msg.data, ...p].slice(0,100)); break;
        case 'signal':              setSignal(msg.data);                             break;
        case 'claudeAnalysis':      setClaudeAnalysis(msg.data);                     break;
        case 'candles':             setCandles(msg.data);                            break;
        case 'modeResult':          setModeResult(msg.data);                         break;
        case 'multiCandles':        setMultiCandles(msg.data);                       break;
        case 'claudeMultiAnalysis':
          // Keep last 5 analyses (newest first) for history tabs in SignalPanel
          setClaudeHistory((prev) => [msg.data, ...prev].slice(0, 5));
          break;
        case 'signalLogged':
        case 'signalClosed':
          setSignalRefresh((n) => n + 1);
          fetchDbStats();
          break;
      }
    });
  }, [messages, fetchDbStats]);

  // Fetch stats once on connect
  useEffect(() => { if (connected) fetchDbStats(); }, [connected, fetchDbStats]);

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
      modeResult={modeResult}
      multiCandles={multiCandles}
      claudeHistory={claudeHistory}
      signalRefresh={signalRefresh}
      dbStats={dbStats}
      onTogglePaperTrading={togglePaperTrading}
      onTradeSizeChange={setTradeSize}
      onRiskConfigChange={setRiskConfig}
    />
  );
}
