# Crypto Bot Multi

Bot de trading para Binance con dashboard en React + análisis con Claude AI.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js, Express, WebSocket (`ws`) |
| Exchange | `node-binance-api`, Binance REST API |
| Indicadores | `tulind` (RSI, MACD, BB, EMA, ATR) |
| AI Analysis | Claude API (`@anthropic-ai/sdk`) |
| Frontend | React 18 + Vite |
| Charts | Recharts |
| Estilos | Tailwind CSS |

## Estructura

```
crypto-bot-multi/
├── backend/
│   ├── server.js          # Express + WebSocket server, trading loop
│   ├── binance.js         # Binance API wrapper (candles, orders, streams)
│   ├── indicators.js      # Cálculo de indicadores técnicos via tulind
│   ├── strategy-engine.js # Estrategias: RSI_MACD, BOLLINGER, EMA_CROSS, COMBINED
│   ├── risk-manager.js    # Gestión de riesgo y sizing de posiciones
│   ├── claude-analysis.js # Análisis de mercado con Claude AI
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── hooks/
    │   │   └── useWebSocket.js
    │   ├── pages/
    │   │   └── Dashboard.jsx
    │   └── components/
    │       ├── BotControls.jsx    # Controles: símbolo, estrategia, start/stop
    │       ├── StatsCards.jsx     # P&L, Win Rate, Total Trades, Signal
    │       ├── CandleChart.jsx    # Gráfico de precios (Recharts)
    │       ├── IndicatorsPanel.jsx # RSI, MACD, BB, EMA, ATR en tiempo real
    │       ├── TradeLog.jsx       # Log de operaciones ejecutadas
    │       └── ClaudePanel.jsx    # Análisis AI (sentimiento, niveles clave)
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

## Instalación

### Backend

```bash
cd backend
cp .env.example .env
# Edita .env con tus claves
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`

## Variables de entorno (backend/.env)

| Variable | Descripción |
|----------|-------------|
| `BINANCE_API_KEY` | API Key de Binance |
| `BINANCE_API_SECRET` | Secret de Binance |
| `ANTHROPIC_API_KEY` | API Key de Anthropic (Claude) |
| `PAPER_TRADING` | `true` = sin dinero real (default) |
| `PORT` | Puerto del backend (default 3001) |

## Estrategias disponibles

| Estrategia | Lógica |
|------------|--------|
| `RSI_MACD` | Compra en RSI < 40 + cruce MACD al alza; vende en RSI > 60 + cruce a la baja |
| `BOLLINGER` | Compra en banda inferior, vende en banda superior |
| `EMA_CROSS` | Golden cross (EMA20 > EMA50) / Death cross |
| `COMBINED` | Acuerdo entre RSI_MACD y BOLLINGER |

## Gestión de riesgo

- Máximo de posiciones abiertas simultáneas: 3
- Riesgo por operación: 1% del portafolio
- Drawdown máximo antes de detener el bot: 10%
- Confianza mínima de señal para operar: 60%

## Paper Trading

Por defecto el bot opera en **modo simulación** (sin dinero real).
Para activar trading real, establece `PAPER_TRADING=false` en `.env` y proporciona claves API con permisos de trading.
