# Crypto Bot Multi — CLAUDE.md

## Project Overview

Trading bot multi-timeframe con análisis de IA usando Claude. Integra Binance (REST + WebSocket), indicadores técnicos, detección de modo de mercado, gestión de riesgo y un dashboard React en tiempo real.

## Architecture

```
crypto-bot-multi/
├── backend/
│   ├── server.js           # Express + WebSocket hub, trading loop (60s)
│   ├── binance.js          # Binance REST + WebSocket (25 streams: 5 pares × 5 TFs)
│   ├── indicators.js       # 8 indicadores técnicos via tulind (paralelo)
│   ├── strategy-engine.js  # Estrategias de señales + detección de modo mercado
│   ├── claude-analysis.js  # Análisis IA multi-timeframe con cache 2 min
│   ├── risk-manager.js     # Aprobación de trades, sizing, drawdown
│   ├── signal-db.js        # SQLite: historial de señales, auto-close SL/TP
│   └── signals.db          # Base de datos SQLite (ignorada en git)
└── frontend/
    └── src/
        ├── App.jsx                  # Root: WebSocket + estado global
        ├── pages/Dashboard.jsx      # Layout principal
        └── components/
            ├── BotControls.jsx      # Symbol/strategy selectors, Start/Stop
            ├── StatsCards.jsx       # KPIs: P&L, WinRate, Trades, Signal
            ├── ModeSelector.jsx     # Badge de modo de mercado
            ├── MultiChart.jsx       # Grid 5 timeframes (Recharts)
            ├── CandleChart.jsx      # Gráfico de precio
            ├── IndicatorsPanel.jsx  # Indicadores en tiempo real
            ├── SignalPanel.jsx      # Análisis Claude: entrada, SL, TP
            └── TradeLog.jsx         # Historial de señales (REST polling)
```

## Tech Stack

| Layer | Tecnología |
|-------|-----------|
| Backend | Node.js, Express 4, WebSocket (ws 8) |
| Exchange | node-binance-api, Binance REST + WS |
| Indicadores | tulind 0.8 (bindings nativos C) |
| IA | @anthropic-ai/sdk — Claude Haiku |
| Base de datos | better-sqlite3 (WAL mode) |
| Frontend | React 18, Vite 5, Recharts 2, Tailwind 3 |

## Running Locally

### Backend
```bash
cd backend
cp .env.example .env     # completar con tus API keys
npm install
npm start                # puerto 3001
# o en desarrollo:
npm run dev              # con nodemon
```

### Frontend
```bash
cd frontend
npm install
npm run dev              # puerto 5173
```

### Variables de entorno (backend `.env`)
```
BINANCE_API_KEY=
BINANCE_API_SECRET=
ANTHROPIC_API_KEY=
PAPER_TRADING=true          # false para trading real
PORT=3001
SIGNALS_DB_PATH=./signals.db
```

## API Reference

### WebSocket Actions (frontend → backend)
| Action | Payload | Descripción |
|--------|---------|-------------|
| `start` | `{ symbol, strategy }` | Iniciar bot |
| `stop` | — | Detener bot |
| `getCandles` | `{ symbol, interval, limit }` | Fetch candles |
| `analyzeWithClaude` | `{ symbol, candles }` | Análisis single-TF |
| `getMultiData` | `{ symbol }` | Pipeline completo multi-TF |

### WebSocket Events (backend → frontend)
| Event | Descripción |
|-------|-------------|
| `state` | Estado completo del bot |
| `indicators` | Indicadores técnicos actuales |
| `trade` | Trade ejecutado |
| `signal` | Señal de estrategia |
| `claudeMultiAnalysis` | Análisis IA multi-TF |
| `multiCandles` | Candles 5m/15m/1h/4h/1d |
| `modeResult` | Modo de mercado detectado |
| `candleUpdate` | Actualización de precio en vivo |
| `signalLogged` | Señal guardada en DB |
| `signalClosed` | Señal auto-cerrada (SL/TP hit) |

### REST Endpoints
```
GET  /api/health
GET  /api/state
GET  /api/trades
GET  /api/candles?symbol=BTCUSDT&interval=1h&limit=100
GET  /api/candles/:pair/:timeframe
POST /api/claude-analyze
GET  /api/signals/history?pair=BTCUSDT&limit=50
GET  /api/signals/stats?pair=BTCUSDT
PATCH /api/signals/:id
```

## Core Modules

### indicators.js
Requiere ≥210 candles. Calcula en paralelo:
- EMA 9/21/50/200
- RSI 14 (valor + previo)
- MACD 12/26/9 (histograma + previo para crossover)
- Bollinger Bands 20/2σ + %B
- ATR 14
- Soporte/Resistencia (pivot, últimas 50 velas)
- Volumen (actual + SMA20 + ratio)

### strategy-engine.js
**Estrategias** (`evaluate(name, indicators)`):
- `RSI_MACD` — RSI < 40 + MACD cross arriba → BUY; RSI > 60 + cross abajo → SELL
- `BOLLINGER` — pctB < 0.1 → BUY; pctB > 0.9 → SELL
- `EMA_CROSS` — EMA21 > EMA50 × 1.002 → BUY; EMA21 < EMA50 × 0.998 → SELL
- `COMBINED` — RSI_MACD + BOLLINGER deben coincidir

**Modos de mercado** (`detectMode(ind5m, ind15m, ind1h, ind4h, ind1d)`):
- `NEUTRAL` — Bollinger bandwidth < 2% en 1h y 4h
- `SCALPING` — ATR 5m/15m > 150% del ATR 4h
- `SWING_LARGO` — EMA50/200 cross en 4h y confirmado en 1d
- `SWING_CORTO` — EMA50/200 cross en 1h, no confirmado en 4h/1d
- `INTRADAY` — RSI extremo en 1h (> 70 o < 30)

### claude-analysis.js
- Modelo: `claude-haiku-4-5-20251001` (velocidad)
- Cache de 2 minutos por `par:modo`
- Output JSON: `{ señal, confianza, entrada_ideal, stopLoss, takeProfit, duracion_estimada, resumen, puntos_clave, alertas }`
- Sin API key: retorna placeholder neutro

### risk-manager.js
Configuración por defecto:
- `maxPositions: 3` — posiciones simultáneas máximas
- `riskPerTrade: 0.01` — 1% del portfolio por trade
- `maxDrawdown: 0.1` — para el bot si drawdown > 10%
- `minConfidence: 0.6` — señales mínimo 60% confianza
- `portfolioValue: 1000` — USDT (paper trading)

### signal-db.js
SQLite en WAL mode. Schema: `id, timestamp, par, modo, señal, entrada, stopLoss, takeProfit, confianza, duracion_estimada, riskUSDT, resultado, pnl, closedAt`

Auto-cierre en cada tick via `checkAndCloseSignals(par, candle)`.

## Pares y Timeframes Soportados

**Pares**: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT
**Timeframes**: 5m, 15m, 1h, 4h, 1d
**Cache**: 300 velas por par/timeframe (in-memory)

## Common Issues

### `Cannot find module 'debug/src/index.js'` (Windows)
Módulo corrupto. Solución:
```bash
rm -rf node_modules package-lock.json
npm install
```
Si persiste, habilitar rutas largas en Windows:
```powershell
# PowerShell como Administrador
reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f
```

### 403 en seed de Binance
Binance bloquea IPs de cloud/VPS. En local funciona sin problemas.

### `EADDRINUSE :3001`
Puerto ocupado por instancia anterior:
```bash
# Linux/Mac
kill -9 $(lsof -ti:3001)
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

## Development Notes

- El trading loop corre cada 60s cuando `state.running === true`
- Cada 5 iteraciones del loop se refresca el análisis multi-timeframe completo
- El WebSocket de Binance usa un stream combinado (25 streams en una conexión)
- Auto-reconexión de WebSocket a los 5s en backend, 3s en frontend
- `PAPER_TRADING=true` es el default — no ejecuta órdenes reales
- Los archivos `*.db-shm` y `*.db-wal` son temporales de SQLite y están en `.gitignore`
