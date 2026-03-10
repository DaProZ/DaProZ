require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Cache (2-minute TTL per pair+mode key) ───────────────────────────────────

const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map(); // key → { ts: number, data: object }

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { ts: Date.now(), data });
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmt = (n, d = 2) => (n == null ? 'N/A' : Number(n).toFixed(d));

function formatTF(label, ind) {
  if (!ind) return `${label}: sin datos`;
  return [
    `${label}:`,
    `  Precio=${fmt(ind.price, 4)}`,
    `  EMA9=${fmt(ind.ema?.ema9, 4)} EMA21=${fmt(ind.ema?.ema21, 4)} EMA50=${fmt(ind.ema?.ema50, 4)} EMA200=${fmt(ind.ema?.ema200, 4)}`,
    `  RSI=${fmt(ind.rsi?.value)} (ant=${fmt(ind.rsi?.prev)})`,
    `  MACD=${fmt(ind.macd?.value, 4)} señal=${fmt(ind.macd?.signal, 4)} hist=${fmt(ind.macd?.histogram, 4)} (ant=${fmt(ind.macd?.prevHistogram, 4)})`,
    `  BB_superior=${fmt(ind.bollinger?.upper, 4)} BB_medio=${fmt(ind.bollinger?.middle, 4)} BB_inferior=${fmt(ind.bollinger?.lower, 4)} %B=${fmt(ind.bollinger?.pctB, 3)}`,
    `  ATR=${fmt(ind.atr, 4)}`,
    `  Volumen=${fmt(ind.volume?.current, 2)} SMA20vol=${fmt(ind.volume?.sma20, 2)} ratio=${fmt(ind.volume?.ratio, 3)}`,
    `  Soporte=[${(ind.levels?.support ?? []).map((v) => fmt(v, 2)).join(', ')}]`,
    `  Resistencia=[${(ind.levels?.resistance ?? []).map((v) => fmt(v, 2)).join(', ')}]`,
  ].join('\n');
}

function buildSystemPrompt(pair, modeResult, riskCalc) {
  const {
    riskPerTrade = 0.01,
    portfolioValue = 1000,
    maxDrawdown = 0.1,
    minConfidence = 0.6,
  } = riskCalc ?? {};

  const modeDescriptions = {
    SCALPING:
      'alta volatilidad intradiaria. Opera en marcos cortos (5m-15m). Busca entradas precisas con SL ajustado y TP rápido. Duración típica: minutos a pocas horas.',
    INTRADAY:
      'momentum claro en el intradía (RSI extremo). Opera en 1h-4h. SL/TP moderados. Duración típica: horas.',
    SWING_CORTO:
      'cruce de medias en 1h sin confirmar en marcos altos. Opera en 1h-4h. Duración típica: 1-3 días.',
    SWING_LARGO:
      'tendencia confirmada en 4h y 1d (cruce EMA50/200). Opera en 4h-1d. Duración típica: días a semanas.',
    NEUTRAL:
      'mercado lateral (Bollinger estrecho). Evitar posiciones direccionales fuertes. Considerar opciones de rango.',
  };

  return `Eres un analista cuantitativo experto en trading de criptomonedas.
Par analizado: ${pair}
Modo detectado: ${modeResult.mode} — ${modeDescriptions[modeResult.mode] ?? 'modo desconocido'}
Confianza en el modo: ${(modeResult.confidence * 100).toFixed(0)}%
Razones del modo: ${modeResult.reasons.join(' | ')}

Parámetros de riesgo del portafolio:
  Valor del portafolio: ${portfolioValue} USDT
  Riesgo por operación: ${(riskPerTrade * 100).toFixed(1)}%  (${(portfolioValue * riskPerTrade).toFixed(2)} USDT)
  Max drawdown permitido: ${(maxDrawdown * 100).toFixed(0)}%
  Confianza mínima para operar: ${(minConfidence * 100).toFixed(0)}%

Reglas de respuesta:
1. Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.
2. stopLoss y takeProfit deben ser precios absolutos (no porcentajes).
3. entrada_ideal debe ser el precio exacto de entrada recomendado.
4. señal solo puede ser: "compra", "venta" o "neutro".
5. confianza es un número entre 0 y 1.
6. duracion_estimada debe expresarse en lenguaje natural (ej: "2-4 horas", "1-3 días").
7. puntos_clave y alertas deben ser arrays de strings concisos.
8. Ajusta SL/TP al modo: SCALPING usa rangos ajustados, SWING_LARGO usa rangos amplios.`;
}

function buildUserPrompt(allIndicators) {
  const { ind5m, ind15m, ind1h, ind4h, ind1d } = allIndicators;
  return [
    'Indicadores técnicos por timeframe (calculados sobre las últimas velas):',
    '',
    formatTF('5 minutos', ind5m),
    '',
    formatTF('15 minutos', ind15m),
    '',
    formatTF('1 hora', ind1h),
    '',
    formatTF('4 horas', ind4h),
    '',
    formatTF('1 día', ind1d),
    '',
    'Basándote en todos los timeframes y el modo de mercado detectado, devuelve tu análisis en este JSON exacto:',
    '{',
    '  "señal": "compra|venta|neutro",',
    '  "confianza": 0.0,',
    '  "modo": "SCALPING|INTRADAY|SWING_CORTO|SWING_LARGO|NEUTRAL",',
    '  "timeframe_principal": "5m|15m|1h|4h|1d",',
    '  "entrada_ideal": 0.0,',
    '  "stopLoss": 0.0,',
    '  "takeProfit": 0.0,',
    '  "duracion_estimada": "...",',
    '  "resumen": "...",',
    '  "puntos_clave": ["...", "..."],',
    '  "alertas": ["..."]',
    '}',
  ].join('\n');
}

// ─── Fallback when API key is not set ────────────────────────────────────────

function buildFallback(pair, modeResult) {
  return {
    señal: 'neutro',
    confianza: 0,
    modo: modeResult.mode,
    timeframe_principal: '1h',
    entrada_ideal: null,
    stopLoss: null,
    takeProfit: null,
    duracion_estimada: 'N/A',
    resumen: 'Análisis Claude desactivado: ANTHROPIC_API_KEY no configurada.',
    puntos_clave: [],
    alertas: ['Configura ANTHROPIC_API_KEY para habilitar análisis AI.'],
    _cached: false,
    _source: 'fallback',
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Analyse a trading pair across all timeframes using Claude Haiku.
 * Results are cached 2 minutes per pair+mode key to avoid calling
 * the API on every tick.
 *
 * @param {string} pair           - e.g. 'BTCUSDT'
 * @param {{ mode, confidence, reasons, scores }} modeResult
 *        - output of detectMode()
 * @param {{ ind5m, ind15m, ind1h, ind4h, ind1d }} allIndicators
 *        - each value is output of indicators.getAll()
 * @param {object} [riskCalc]     - risk-manager config or computed risk values
 * @returns {Promise<object>}     - structured analysis object
 */
async function analyzeMultiMode(pair, modeResult, allIndicators, riskCalc = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallback(pair, modeResult);
  }

  const cacheKey = `${pair}:${modeResult.mode}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return { ...cached, _cached: true };
  }

  const systemPrompt = buildSystemPrompt(pair, modeResult, riskCalc);
  const userPrompt   = buildUserPrompt(allIndicators);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content[0]?.text ?? '';

  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    parsed = null;
  }

  if (!parsed) {
    console.warn('[claude-analysis] Failed to parse JSON response:', text.slice(0, 200));
    parsed = {
      señal: 'neutro',
      confianza: 0,
      modo: modeResult.mode,
      timeframe_principal: '1h',
      entrada_ideal: null,
      stopLoss: null,
      takeProfit: null,
      duracion_estimada: 'N/A',
      resumen: text,
      puntos_clave: [],
      alertas: ['Error al parsear respuesta del modelo.'],
    };
  }

  const result = {
    ...parsed,
    _cached: false,
    _source: 'claude-haiku-4-5-20251001',
    _ts: new Date().toISOString(),
  };

  cacheSet(cacheKey, result);
  return result;
}

// ─── Backward-compat (used by server.js and WS handler) ──────────────────────

async function analyze(symbol, candles) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      summary: 'Claude analysis disabled: ANTHROPIC_API_KEY not set.',
      sentiment: 'neutral',
      keyLevels: {},
    };
  }

  const latest = candles.slice(-20);
  const priceData = latest
    .map(
      (c) =>
        `${new Date(c.time * 1000).toISOString().slice(0, 16)} O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`
    )
    .join('\n');

  const prompt = `You are an expert crypto technical analyst. Analyze the following ${symbol} candlestick data (last 20 candles, 1-hour timeframe) and provide:

1. A brief market summary (2-3 sentences)
2. Overall sentiment: "bullish", "bearish", or "neutral"
3. Key support and resistance levels

Candlestick data:
${priceData}

Respond in JSON format:
{
  "summary": "...",
  "sentiment": "bullish|bearish|neutral",
  "keyLevels": {
    "support": [number, ...],
    "resistance": [number, ...]
  },
  "recommendation": "..."
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { summary: text, sentiment: 'neutral', keyLevels: {} };
  } catch {
    return { summary: text, sentiment: 'neutral', keyLevels: {} };
  }
}

module.exports = { analyzeMultiMode, analyze };
