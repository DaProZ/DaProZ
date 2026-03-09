require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Ask Claude to analyze candlestick data and provide a market opinion.
 *
 * @param {string} symbol  - Trading pair e.g. 'BTCUSDT'
 * @param {object[]} candles - Array of { time, open, high, low, close, volume }
 * @returns {Promise<{ summary: string, sentiment: string, keyLevels: object }>}
 */
async function analyze(symbol, candles) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      summary: 'Claude analysis disabled: ANTHROPIC_API_KEY not set.',
      sentiment: 'neutral',
      keyLevels: {},
    };
  }

  const latest = candles.slice(-20);
  const priceData = latest.map(
    (c) => `${new Date(c.time * 1000).toISOString().slice(0, 16)} O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`
  ).join('\n');

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
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text, sentiment: 'neutral', keyLevels: {} };
  } catch {
    return { summary: text, sentiment: 'neutral', keyLevels: {} };
  }
}

module.exports = { analyze };
